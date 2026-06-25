// tests/e2e/fixtures/fixtures.smoke.test.js
'use strict';
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '../../..');
const FIXTURES = path.join(__dirname);

describe('Layer 1 fixtures smoke tests', () => {
  let tmp;
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-fixture-smoke-'));
  });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('RELEASE_PLAN.md fixture exists and is non-empty', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'RELEASE_PLAN.md'), 'utf8');
    expect(content.length).toBeGreaterThan(500);
    expect(content).toContain('EPIC-T001');
    expect(content).toContain('E2E-Fixture:');
  });

  it('BUGS.md fixture has 5 bugs covering all status values', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'BUGS.md'), 'utf8');
    expect(content).toContain('Status: Fixed');
    expect(content).toContain('Status: Open');
    expect(content).toContain('Status: In Progress');
    expect(content).toContain('Status: WontFix');
  });

  it('LESSONS.md fixture has @agent: tags on their own lines', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'LESSONS.md'), 'utf8');
    expect(content).toMatch(/^@agent: \w/m);
    expect(content).not.toMatch(/## L-.*@agent:/);
  });

  it('sdlc-status-init.json is valid canonical shape', () => {
    const json = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'sdlc-status-init.json'), 'utf8'));
    expect(json).toHaveProperty('tasks');
    expect(json).toHaveProperty('log');
    expect(json).toHaveProperty('programme.phases');
    expect(json.programme.phases).toHaveLength(7);
    expect(Object.keys(json.tasks)).toHaveLength(0);
  });

  it('generate-plan.js accepts the fixture RELEASE_PLAN.md without errors', () => {
    // Copy fixture into tmp, run generate-plan pointing at it
    fs.copyFileSync(path.join(FIXTURES, 'RELEASE_PLAN.md'), path.join(tmp, 'RELEASE_PLAN.md'));
    // generate-plan reads from process.cwd() by default — run from tmp
    expect(() =>
      execSync(`node "${path.join(ROOT, 'tools/generate-plan.js')}"`, {
        cwd: tmp,
        stdio: 'pipe',
        timeout: 30000,
      }),
    ).not.toThrow();
  });
});
