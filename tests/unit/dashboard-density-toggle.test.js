'use strict';

/**
 * US-0186: Density toggle pill, persistence, and refresh-cache regression tests.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const CANONICAL_PHASES = [
  { id: 1, name: 'Blueprint', agents: ['Compass'], deliverables: ['refined ACs'] },
  { id: 2, name: 'Architect', agents: ['Keystone'], deliverables: ['scaffold'] },
  { id: 3, name: 'Build', agents: ['Pixel'], deliverables: ['code'] },
  { id: 4, name: 'Integration', agents: ['Pixel'], deliverables: ['wired'] },
  { id: 5, name: 'Test', agents: ['Sentinel'], deliverables: ['report'] },
  { id: 6, name: 'Polish', agents: ['Pixel'], deliverables: ['fixes'] },
];

const AGENT_NAMES = ['Conductor', 'Compass', 'Keystone', 'Lens', 'Palette', 'Forge', 'Pixel', 'Sentinel', 'Circuit'];

function makeFixture() {
  const agents = {};
  AGENT_NAMES.forEach((name) => {
    agents[name] = { status: 'idle', currentTask: null, tasksCompleted: 0 };
  });
  agents.Pixel = { status: 'active', currentTask: 'US-0186', tasksCompleted: 1 };
  return {
    project: { name: 'X', description: '', repoUrl: '', startDate: '2026-04-15' },
    cycles: [],
    currentPhase: 3,
    phases: CANONICAL_PHASES.map((p, i) => ({
      ...p,
      status: i < 2 ? 'complete' : i === 2 ? 'in-progress' : 'pending',
    })),
    agents,
    epics: {},
    stories: {},
    metrics: {
      storiesCompleted: 0,
      storiesTotal: 0,
      tasksCompleted: 0,
      tasksTotal: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsTotal: 0,
      bugsOpen: 0,
      bugsFixed: 0,
      coveragePercent: 85,
      reviewsApproved: 0,
      reviewsBlocked: 0,
    },
    log: [],
  };
}

function html() {
  const { generateHTML } = require('../../tools/generate-dashboard.js');
  return generateHTML(makeFixture());
}

describe('Density toggle pill HTML', () => {
  test('emits .pv-density-toggle container in mc-topbar-right', () => {
    const out = html();
    expect(out).toMatch(/<div class="mc-topbar-right">[\s\S]*<div class="pv-density-toggle"/);
  });

  test('emits S, M, L buttons with data-density attributes', () => {
    const out = html();
    expect(out).toMatch(/data-density="S"[^>]*>S</);
    expect(out).toMatch(/data-density="M"[^>]*>M</);
    expect(out).toMatch(/data-density="L"[^>]*>L</);
  });

  test('emits setTaskDensity and initTaskDensity in script block', () => {
    const out = html();
    expect(out).toContain('function setTaskDensity(');
    expect(out).toContain('function initTaskDensity(');
  });

  test('emits localStorage key pv-task-density', () => {
    const out = html();
    expect(out).toContain("'pv-task-density'");
  });

  test('emits _pvLastStatus cache assignment in refresh loop', () => {
    const out = html();
    expect(out).toMatch(/window\._pvLastStatus\s*=/);
  });

  test('default density falls back to L when no localStorage value', () => {
    const out = html();
    expect(out).toMatch(/saved === 'S'[\s\S]+saved === 'M'[\s\S]+saved === 'L'/);
  });
});

describe('Review-gate CSS', () => {
  test('contains .pv-rev-chip styles using theme tokens', () => {
    const out = html();
    expect(out).toContain('.pv-rev-chip');
    expect(out).toMatch(/\.pv-rev-chip\.ok/);
    expect(out).toMatch(/\.pv-rev-chip\.warn/);
    expect(out).toMatch(/\.pv-rev-chip\.risk/);
    expect(out).toMatch(/\.pv-rev-chip\.review/);
    expect(out).toContain('var(--ok)');
    expect(out).toContain('var(--warn)');
    expect(out).toContain('var(--risk)');
    expect(out).toContain('var(--live-accent)');
  });

  test('contains .pv-rev-line and .pv-rev-icon styles', () => {
    const out = html();
    expect(out).toContain('.pv-rev-line');
    expect(out).toContain('.pv-rev-icon');
  });

  test('contains .pv-density-toggle styles', () => {
    const out = html();
    expect(out).toContain('.pv-density-toggle');
    expect(out).toContain('.pv-density-toggle button');
    expect(out).toContain('.pv-density-toggle button.active');
  });
});
