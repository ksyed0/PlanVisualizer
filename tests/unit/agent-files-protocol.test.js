'use strict';
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', '..', 'docs', 'agents');

function read(file) {
  return fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
}

// NOTE TO MAINTAINERS: these section names are the protocol's public API.
// Renames require coordinated updates across all listed files AND this test.
// Brittleness is intentional.

describe('agent-files protocol contract', () => {
  test('DM_AGENT.md contains ## Pre-Dispatch Spec & Plan Orchestration', () => {
    expect(read('DM_AGENT.md')).toMatch(/^## Pre-Dispatch Spec & Plan Orchestration$/m);
  });

  test('PO_AGENT.md contains ## Spec Brainstorming Protocol', () => {
    expect(read('PO_AGENT.md')).toMatch(/^## Spec Brainstorming Protocol$/m);
  });

  test('PO_AGENT.md contains ## Spec Output Schema', () => {
    expect(read('PO_AGENT.md')).toMatch(/^## Spec Output Schema$/m);
  });

  test('ARCHITECT_AGENT.md contains ## Plan Writing Protocol', () => {
    expect(read('ARCHITECT_AGENT.md')).toMatch(/^## Plan Writing Protocol$/m);
  });

  test('ARCHITECT_AGENT.md contains ## Self-Review Checklist', () => {
    expect(read('ARCHITECT_AGENT.md')).toMatch(/^## Self-Review Checklist$/m);
  });

  test('UI_DESIGNER_AGENT.md contains ## Spec Contribution Protocol', () => {
    expect(read('UI_DESIGNER_AGENT.md')).toMatch(/^## Spec Contribution Protocol$/m);
  });

  test('FE_DEV_AGENT.md contains ## UI Mockup Protocol', () => {
    expect(read('FE_DEV_AGENT.md')).toMatch(/^## UI Mockup Protocol$/m);
  });

  test('CODE_REVIEWER_AGENT.md contains ## Spec/Plan Review Protocol', () => {
    expect(read('CODE_REVIEWER_AGENT.md')).toMatch(/^## Spec\/Plan Review Protocol$/m);
  });

  test('CODE_REVIEWER_AGENT.md contains canonical @persona list', () => {
    const text = read('CODE_REVIEWER_AGENT.md');
    expect(text).toContain('@compass');
    expect(text).toContain('@palette');
    expect(text).toContain('@pixel');
    expect(text).toContain('@keystone');
    expect(text).toContain('@lens');
    expect(text).toContain('@plan-author');
  });
});
