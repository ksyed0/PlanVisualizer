'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const migration = require('../../../tools/lib/migrations/data_001-normalise-fenced-blocks');
const { SerializerStabilityError } = require('../../../tools/lib/repository/errors');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0243-mig-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

const SAMPLE_PLAN = `# Plan\n\n\`\`\`\nUS-0001 (EPIC-0001): A\nPriority: High (P1)\nEstimate: M\nStatus: To Do\n\`\`\`\n`;

describe('US-0243 / AC-0950..0952: Migration 001', () => {
  let root;
  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  it('declares touches[] for the snapshot mechanism', () => {
    expect(Array.isArray(migration.touches)).toBe(true);
    expect(migration.touches).toContain('docs/RELEASE_PLAN.md');
    expect(migration.touches).toContain('docs/BUGS.md');
    expect(migration.touches).toContain('docs/LESSONS.md');
    expect(migration.touches).toContain('docs/TEST_CASES.md');
  });

  it('AC-0951: second run is a true no-op (no rewrite when pass2 === input)', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'RELEASE_PLAN.md');
    fs.writeFileSync(filePath, SAMPLE_PLAN);
    // First run
    await migration.up({ root });
    const mtimeBefore = fs.statSync(filePath).mtimeMs;
    await new Promise((r) => setTimeout(r, 10));
    // Second run (should be no-op)
    await migration.up({ root });
    const mtimeAfter = fs.statSync(filePath).mtimeMs;
    // The file should NOT be rewritten (no mtime change).
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it('AC-0950: non-canonical file is normalised (rewritten with serializer output)', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'RELEASE_PLAN.md');
    fs.writeFileSync(filePath, SAMPLE_PLAN);
    await migration.up({ root });
    const after = fs.readFileSync(filePath, 'utf8');
    const { parseReleasePlan } = require('../../../tools/lib/parse-release-plan');
    expect(parseReleasePlan(after).stories).toHaveLength(1);
    expect(parseReleasePlan(after).stories[0].id).toBe('US-0001');
    expect(parseReleasePlan(after).stories[0].status).toBe('To Do');
  });

  it('AC-0950: snapshots pre-mutation copy to /tmp/docs-pre-norm/', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'RELEASE_PLAN.md');
    fs.writeFileSync(filePath, SAMPLE_PLAN);
    const snapPath = '/tmp/docs-pre-norm/RELEASE_PLAN.md';
    if (fs.existsSync(snapPath)) fs.unlinkSync(snapPath);
    await migration.up({ root });
    expect(fs.existsSync(snapPath)).toBe(true);
    expect(fs.readFileSync(snapPath, 'utf8')).toBe(SAMPLE_PLAN);
  });

  it('throws SerializerStabilityError when pass1 !== pass2 (simulated via mocked serializer)', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'RELEASE_PLAN.md');
    fs.writeFileSync(filePath, SAMPLE_PLAN);
    const storySer = require('../../../tools/lib/repository/serializers/story-serializer');
    const real = storySer.serialize;
    let calls = 0;
    storySer.serialize = (s) => {
      calls++;
      if (calls === 2) return real(s) + '# fake-second-pass-divergence\n';
      return real(s);
    };
    try {
      await expect(migration.up({ root })).rejects.toThrow(SerializerStabilityError);
    } finally {
      storySer.serialize = real;
    }
  });

  it('renderBugs: normalises BUGS.md', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'BUGS.md');
    const SAMPLE_BUGS = `# Bugs\n\nBUG-0001: Sample bug\nSeverity: Low\nStatus: Open\n`;
    fs.writeFileSync(filePath, SAMPLE_BUGS);
    await migration.up({ root });
    const after = fs.readFileSync(filePath, 'utf8');
    expect(after).toContain('BUG-0001');
    expect(after).toContain('Status: Open');
  });

  it('renderLessons: normalises LESSONS.md', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'LESSONS.md');
    const SAMPLE_LESSONS = `# Lessons\n\n## L-0001 — Sample lesson\n\n**Rule:** be careful\n`;
    fs.writeFileSync(filePath, SAMPLE_LESSONS);
    await migration.up({ root });
    const after = fs.readFileSync(filePath, 'utf8');
    expect(after).toContain('## L-0001');
    expect(after).toContain('**Rule:** be careful');
  });

  it('renderTestCases: normalises TEST_CASES.md', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'TEST_CASES.md');
    const SAMPLE_TCS = `# Test Cases\n\nTC-0001: Sample\nType: unit\nStatus: [ ] Not Run\n`;
    fs.writeFileSync(filePath, SAMPLE_TCS);
    await migration.up({ root });
    const after = fs.readFileSync(filePath, 'utf8');
    expect(after).toContain('TC-0001');
  });

  // Security regression: writeFileNoFollow must refuse to follow a hostile
  // symlink at the snapshot path. CodeQL (js/insecure-temporary-file) flagged
  // the original fs.writeFileSync on /tmp/docs-pre-norm/<basename>; the
  // O_NOFOLLOW wrapper closes the symlink-clobber attack vector.
  it('refuses to write through a hostile symlink at the snapshot path (ELOOP)', async () => {
    root = mkRoot();
    const filePath = path.join(root, 'docs', 'RELEASE_PLAN.md');
    fs.writeFileSync(filePath, SAMPLE_PLAN);

    const snapPath = '/tmp/docs-pre-norm/RELEASE_PLAN.md';
    // Pre-clean any existing snapshot, then plant a symlink to a sensitive
    // target. The migration's writeFileNoFollow MUST throw ELOOP rather than
    // overwrite the symlink target.
    fs.mkdirSync('/tmp/docs-pre-norm', { recursive: true });
    if (fs.existsSync(snapPath) || fs.lstatSync(snapPath, { throwIfNoEntry: false })) {
      fs.unlinkSync(snapPath);
    }
    const hostileTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'sensitive-')) + '/secret.txt';
    fs.writeFileSync(hostileTarget, 'original-secret-contents');
    fs.symlinkSync(hostileTarget, snapPath);

    await expect(migration.up({ root })).rejects.toThrow(/ELOOP|symbolic link/i);

    // The symlink target must be untouched.
    expect(fs.readFileSync(hostileTarget, 'utf8')).toBe('original-secret-contents');

    // Clean up so subsequent tests aren't affected.
    fs.unlinkSync(snapPath);
    fs.rmSync(path.dirname(hostileTarget), { recursive: true, force: true });
  });
});
