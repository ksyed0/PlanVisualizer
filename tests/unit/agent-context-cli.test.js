'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseArgs, dispatch } = require('../../tools/agent-context');

function mkProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-context-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  return root;
}

function writeFile(root, rel, contents) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, contents);
  return p;
}

describe('agent-context CLI — parseArgs', () => {
  test('parses generate command with all required flags', () => {
    const opts = parseArgs([
      'node',
      'cli',
      'generate',
      '--story',
      'US-0184',
      '--agent',
      'Forge',
      '--task-id',
      'task-abc',
    ]);
    expect(opts).toEqual({ cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: 'task-abc' });
  });
});

describe('agent-context CLI — dispatch', () => {
  test('exits 1 when --story missing', () => {
    const root = mkProject();
    writeFile(root, 'docs/sdlc-status.json', JSON.stringify({ tasks: {} }));
    const err = [];
    const rc = dispatch(
      { cmd: 'generate', agent: 'Forge', taskId: 'task-x' },
      { root, stdout: () => {}, stderr: (s) => err.push(s) },
    );
    expect(rc).toBe(1);
    expect(err.join('\n')).toMatch(/--story required/);
  });

  test('exits 1 when --agent is not in canonical list', () => {
    const root = mkProject();
    writeFile(root, 'docs/sdlc-status.json', JSON.stringify({ tasks: {} }));
    const err = [];
    const rc = dispatch(
      { cmd: 'generate', story: 'US-0184', agent: 'Bogus', taskId: 'task-x' },
      { root, stdout: () => {}, stderr: (s) => err.push(s) },
    );
    expect(rc).toBe(1);
    expect(err.join('\n')).toMatch(/unknown agent/i);
  });

  test('exits 1 when task-id not found in sdlc-status', () => {
    const root = mkProject();
    writeFile(root, 'docs/sdlc-status.json', JSON.stringify({ tasks: {} }));
    const err = [];
    const rc = dispatch(
      { cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: 'task-missing' },
      { root, stdout: () => {}, stderr: (s) => err.push(s) },
    );
    expect(rc).toBe(1);
    expect(err.join('\n')).toMatch(/not found/i);
  });

  test('happy path writes payload to stdout, exit 0, no stderr', () => {
    const root = mkProject();
    writeFile(
      root,
      'docs/sdlc-status.json',
      JSON.stringify({
        stories: {
          'US-0184': {
            specPhase: { specPath: 'docs/spec.md' },
            planPhase: { planPath: 'docs/plan.md' },
          },
        },
        tasks: {
          'task-abc': {
            id: 'task-abc',
            story: 'US-0184',
            agent: 'Forge',
            description: 'Do the thing',
            state: 'in_progress',
            planTaskIndex: 1,
            summary: null,
          },
        },
      }),
    );
    writeFile(root, 'docs/spec.md', '## Acceptance Criteria\n\n- AC-0720: First\n- AC-0721: Second\n');
    writeFile(root, 'docs/plan.md', '## Task 1: Do it\n\nSteps:\n1. step one\n');
    writeFile(root, 'docs/LESSONS.md', '## L-0001 — Foo\n@agent: Forge\n\nbody\n');

    const out = [];
    const err = [];
    const rc = dispatch(
      { cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: 'task-abc' },
      { root, stdout: (s) => out.push(s), stderr: (s) => err.push(s) },
    );
    expect(rc).toBe(0);
    expect(err).toEqual([]);
    const payload = out.join('');
    expect(payload).toContain('## Context for Forge — US-0184 (Task 1/1)');
    expect(payload).toContain('Do the thing');
    expect(payload).toContain('AC-0720: First');
    expect(payload).toContain('### Plan excerpt');
    expect(payload).toContain('- **L-0001**');
  });

  test('missing spec doc → ACs section suppressed, exit 0', () => {
    const root = mkProject();
    writeFile(
      root,
      'docs/sdlc-status.json',
      JSON.stringify({
        stories: { 'US-0184': { planPhase: { planPath: 'docs/plan.md' } } },
        tasks: {
          'task-abc': {
            id: 'task-abc',
            story: 'US-0184',
            agent: 'Forge',
            description: 'task',
            state: 'in_progress',
            planTaskIndex: 1,
          },
        },
      }),
    );
    writeFile(root, 'docs/plan.md', '## Task 1: x\n\nstuff\n');
    writeFile(root, 'docs/LESSONS.md', '');

    const out = [];
    const rc = dispatch(
      { cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: 'task-abc' },
      { root, stdout: (s) => out.push(s), stderr: () => {} },
    );
    expect(rc).toBe(0);
    expect(out.join('')).not.toContain('Story acceptance criteria');
  });
});
