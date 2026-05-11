'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('child_process');
jest.mock('../../tools/lib/memory-migrator');
jest.mock('../../tools/lib/memory-validator');

const { execFileSync } = require('child_process');
const { migrateMemory } = require('../../tools/lib/memory-migrator');
const { validateMemory } = require('../../tools/lib/memory-validator');
const { runMigrateCommit } = require('../../tools/lib/memory-commit-orchestrator');

function setupRoot(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mco-'));
  fs.writeFileSync(path.join(tmp, 'MEMORY.md'), '# MEMORY.md\n\n## Some Section\n\nbody\n');
  if (!opts.skipClaude) {
    fs.writeFileSync(
      path.join(tmp, 'CLAUDE.md'),
      [
        '# CLAUDE.md',
        '',
        '## Mandatory Session Startup',
        '',
        '1. Read `AGENTS.md`.',
        '2. Read `MEMORY.md` and all linked topic files.',
        '3. Read `PROMPT_LOG.md`.',
        '',
        '## Session Close Checklist',
        '',
        '- [ ] All committed',
        '- [ ] `MEMORY.md` updated with new learnings',
      ].join('\n'),
    );
  }
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'docs', 'LESSONS.md'), '# LESSONS.md\n');
  fs.writeFileSync(path.join(tmp, 'docs', 'ID_REGISTRY.md'), '| Lesson | L-0055 | L-0054 |\n');
  return tmp;
}

beforeEach(() => {
  jest.clearAllMocks();
  execFileSync.mockImplementation((cmd, args) => {
    if (cmd === 'git') {
      if (args.includes('status')) return '';
      if (args.includes('symbolic-ref')) return 'feature/test-branch\n';
      if (args.includes('commit')) return '';
      if (args.includes('push')) return '';
    }
    if (cmd === 'npx') return '';
    if (cmd === 'gh') return JSON.stringify([{ number: 995 }]);
    return '';
  });
  migrateMemory.mockReturnValue({
    skipped: false,
    topicFiles: [{ category: 'topics' }, { category: 'sessions' }],
    archiveOps: [{}],
    lessonOrphans: [],
  });
  validateMemory.mockReturnValue({ ok: true, diff: '' });
});

describe('runMigrateCommit pre-flight', () => {
  test('aborts on dirty working tree', () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args.includes('status')) return 'M tools/foo.js\n';
      return '';
    });
    const tmp = setupRoot();
    const code = runMigrateCommit({ root: tmp });
    expect(code).toBe(1);
    expect(migrateMemory).not.toHaveBeenCalled();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('aborts on develop branch', () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args.includes('status')) return '';
      if (cmd === 'git' && args.includes('symbolic-ref')) return 'develop\n';
      return '';
    });
    const tmp = setupRoot();
    const code = runMigrateCommit({ root: tmp });
    expect(code).toBe(1);
    expect(migrateMemory).not.toHaveBeenCalled();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('aborts if topics/ already exists and non-empty without --force', () => {
    const tmp = setupRoot();
    fs.mkdirSync(path.join(tmp, 'docs/memory/topics'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'docs/memory/topics/x.md'), '# X\n');
    const code = runMigrateCommit({ root: tmp });
    expect(code).toBe(1);
    expect(migrateMemory).not.toHaveBeenCalled();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('runMigrateCommit pipeline', () => {
  test('aborts when migrateMemory throws', () => {
    migrateMemory.mockImplementation(() => {
      throw new Error('migrate failed');
    });
    const tmp = setupRoot();
    const code = runMigrateCommit({ root: tmp });
    expect(code).toBe(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('aborts when jest exits non-zero', () => {
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args.includes('status')) return '';
      if (cmd === 'git' && args.includes('symbolic-ref')) return 'feature/test\n';
      if (cmd === 'npx' && args.includes('jest')) {
        const e = new Error('jest failed');
        e.status = 1;
        throw e;
      }
      return '';
    });
    const tmp = setupRoot();
    const code = runMigrateCommit({ root: tmp });
    expect(code).toBe(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('aborts when validate returns not ok', () => {
    validateMemory.mockReturnValue({ ok: false, diff: '--- MEMORY.md' });
    const tmp = setupRoot();
    const code = runMigrateCommit({ root: tmp });
    expect(code).toBe(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('happy path (no flags) reaches commit, no push', () => {
    const tmp = setupRoot();
    const code = runMigrateCommit({ root: tmp });
    expect(code).toBe(0);
    const pushCalls = execFileSync.mock.calls.filter(([, args]) => args && args.includes('push'));
    expect(pushCalls).toHaveLength(0);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('--push flag calls git push', () => {
    const tmp = setupRoot();
    runMigrateCommit({ root: tmp, push: true });
    const pushCalls = execFileSync.mock.calls.filter(([cmd, args]) => cmd === 'git' && args.includes('push'));
    expect(pushCalls.length).toBeGreaterThan(0);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('--dry prints summary, nothing committed', () => {
    const tmp = setupRoot();
    const code = runMigrateCommit({ root: tmp, dry: true });
    expect(code).toBe(0);
    const commitCalls = execFileSync.mock.calls.filter(([cmd, args]) => cmd === 'git' && args.includes('commit'));
    expect(commitCalls).toHaveLength(0);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
