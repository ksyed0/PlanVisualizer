'use strict';

/**
 * Baseline regression harness for tools/generate-dashboard.js (US-0124).
 *
 * Covers AC-0424 through AC-0429 — exercises generateHTML() with a healthy
 * fixture (6 canonical phases, 9 agents, no BLOCKED state) plus a blocked
 * variant, and asserts structural invariants that every subsequent
 * EPIC-0016 story must preserve.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'agents.config.json'), 'utf8'));

// Canonical phases mirror tools/update-sdlc-status.js PHASE_DEFS.
const CANONICAL_PHASES = [
  { id: 1, name: 'Blueprint', agents: ['Compass'], deliverables: ['refined ACs', 'priority list'] },
  { id: 2, name: 'Architect', agents: ['Keystone'], deliverables: ['scaffold', 'types', 'service stubs'] },
  { id: 3, name: 'Build', agents: ['Pixel', 'Forge', 'Palette'], deliverables: ['implementation', 'unit tests'] },
  { id: 4, name: 'Integration', agents: ['Pixel'], deliverables: ['wired services', 'e2e flows'] },
  { id: 5, name: 'Test', agents: ['Sentinel', 'Circuit'], deliverables: ['test report', 'coverage'] },
  { id: 6, name: 'Polish', agents: ['Pixel', 'Forge'], deliverables: ['bug fixes', 'demo prep'] },
];

const AGENT_NAMES = ['Conductor', 'Compass', 'Keystone', 'Lens', 'Palette', 'Forge', 'Pixel', 'Sentinel', 'Circuit'];

function makeHealthyFixture() {
  const agents = {};
  AGENT_NAMES.forEach((name) => {
    agents[name] = { status: 'idle', currentTask: null, tasksCompleted: 0 };
  });
  // One active non-Conductor agent so the spotlight and grid both render
  // something other than the "no active" fallback path.
  agents.Pixel = { status: 'active', currentTask: 'US-0124 test harness', tasksCompleted: 1 };

  return {
    hackathon: {
      name: 'SDLC Dashboard',
      date: '2026-04-15',
      startTime: '09:00',
      endTime: '17:00',
    },
    currentPhase: 3,
    phases: CANONICAL_PHASES.map((p, i) => ({
      ...p,
      status: i < 2 ? 'complete' : i === 2 ? 'in-progress' : 'pending',
    })),
    agents,
    epics: {
      'EPIC-0016': 'Agentic Dashboard Mission Control Redesign',
    },
    stories: {
      'US-0124': {
        title: 'Baseline test harness for generate-dashboard.js',
        status: 'In Progress',
        epic: 'EPIC-0016',
      },
    },
    metrics: {
      storiesCompleted: 0,
      storiesTotal: 1,
      tasksCompleted: 0,
      tasksTotal: 1,
      testsPassed: 6,
      testsFailed: 0,
      testsTotal: 6,
      bugsOpen: 0,
      bugsFixed: 0,
      coveragePercent: 85,
      reviewsApproved: 0,
      reviewsBlocked: 0,
    },
    log: [{ time: '09:00', agent: 'Conductor', message: 'Session started' }],
  };
}

describe('generate-dashboard.js baseline harness (US-0124)', () => {
  // AC-0424: module imports cleanly — no side-effects, generateHTML exported.
  test('AC-0424: imports generateHTML without executing the pipeline', () => {
    expect(() => require('../../tools/generate-dashboard.js')).not.toThrow();
    const mod = require('../../tools/generate-dashboard.js');
    expect(typeof mod.generateHTML).toBe('function');
  });

  // AC-0425: healthy fixture produces non-empty HTML that starts with DOCTYPE.
  test('AC-0425: generateHTML(healthyFixture) returns a non-empty HTML document', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const html = generateHTML(makeHealthyFixture());
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  // AC-0426: every agent name from the fixture appears in the output.
  test('AC-0426: rendered HTML includes every agent name', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const html = generateHTML(makeHealthyFixture());
    AGENT_NAMES.forEach((name) => {
      expect(html).toContain(name);
    });
  });

  // AC-0427: every canonical phase name appears in the output.
  test('AC-0427: rendered HTML includes every canonical phase name', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const html = generateHTML(makeHealthyFixture());
    CANONICAL_PHASES.forEach((p) => {
      // Match as a phase-name value inside the pipeline block, not just a
      // stray substring, so future renaming can't silently pass via the
      // agent list or deliverable text.
      expect(html).toMatch(new RegExp(`<div class="phase-name">${p.name}</div>`));
    });
  });

  // AC-0428: when an agent is blocked, the output surfaces it as a blocked
  // indicator (current renderer emits the raw status string inside the
  // agent-status pill — that is the existing blocked-alert markup).
  test('AC-0428: blocked agent status surfaces blocked markup in the output', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    fixture.agents.Lens = {
      status: 'blocked',
      currentTask: 'awaiting clarification',
      tasksCompleted: 0,
    };

    const html = generateHTML(fixture);
    // The healthy fixture uses only idle/active/complete — the literal token
    // "blocked" should not appear unless a blocked agent is present.
    const healthy = generateHTML(makeHealthyFixture());
    expect(healthy).not.toMatch(/>blocked</);

    // With the mutated fixture, the blocked status must reach the rendered
    // agent-status pill. This is the canonical blocked-alert needle today;
    // later EPIC-0016 stories will enrich it with a ribbon/beacon.
    expect(html).toMatch(/<div class="agent-status"[^>]*>blocked<\/div>/);
  });

  // AC-0429: the About modal section renders with the project name.
  // generateHTML reads the project name from agents.config.json's
  // dashboard.title at module load; the test asserts that value flows
  // through into the About modal <h3>.
  test('AC-0429: About modal renders with the project name', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const html = generateHTML(makeHealthyFixture());
    const projectTitle = (AGENTS_CONFIG.dashboard || {}).title || 'SDLC Dashboard';

    expect(html).toContain('id="about-modal"');
    // The modal <h3> carries the dashboard title (escaped). Use a regex
    // tolerant to whitespace so small formatting tweaks don't break the net.
    const titleInModal = new RegExp(
      `id="about-modal"[\\s\\S]*?<h3>${projectTitle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}</h3>`,
    );
    expect(html).toMatch(titleInModal);
  });
});

describe('US-0121 terminal-aesthetic activity log', () => {
  // AC-0411: Log entries render with agent-color left bar and bracketed
  // [HH:MM:SS] [AGENT] message format.
  test('AC-0411: log entries use [HH:MM:SS] [AGENT] format with agent-color left bar', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    fixture.log = [{ time: '09:05', agent: 'Pixel', message: 'kicked off patchDOM' }];
    const html = generateHTML(fixture);

    // Bracketed time with seconds padding (09:05 -> 09:05:00).
    expect(html).toMatch(/<span class="log-time"[^>]*>\[09:05:00\]<\/span>/);
    // Bracketed agent token.
    expect(html).toMatch(/<span class="log-agent"[^>]*>\[Pixel\]<\/span>/);
    // Agent-color left bar on the row.
    expect(html).toMatch(/<div class="log-entry"[^>]*style="border-left-color: [^"]+"[^>]*>/);
  });

  // AC-0412: timestamps muted gray, agent tokens agent-colored, messages
  // use primary foreground — asserted via CSS rule presence.
  test('AC-0412: CSS assigns muted gray to log-time and primary fg to log-msg', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const html = generateHTML(makeHealthyFixture());
    expect(html).toMatch(/\.log-time\s*\{\s*color:\s*var\(--text-muted\)/);
    expect(html).toMatch(/\.log-msg\s*\{\s*color:\s*var\(--text-primary\)/);
  });

  // AC-0413: filter chips [All] [Errors] [Reviews] [Tests] [Bugs] with
  // data-category attributes on each log row.
  test('AC-0413: filter chips render and entries carry data-category', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    fixture.log = [
      { time: '09:01', agent: 'Sentinel', message: 'coverage review complete' },
      { time: '09:02', agent: 'Circuit', message: 'test suite green' },
      { time: '09:03', agent: 'Forge', message: 'bug BUG-0001 patched' },
      { time: '09:04', agent: 'Pixel', message: 'build error in render-html.js' },
    ];
    const html = generateHTML(fixture);

    ['all', 'errors', 'reviews', 'tests', 'bugs'].forEach((f) => {
      expect(html).toContain(`data-log-filter="${f}"`);
    });
    expect(html).toMatch(/data-category="reviews"/);
    expect(html).toMatch(/data-category="tests"/);
    expect(html).toMatch(/data-category="bugs"/);
    expect(html).toMatch(/data-category="errors"/);
  });

  // AC-0414: tail-mode toggle ON by default and persisted via
  // localStorage('dashboard-tail-mode').
  test('AC-0414: tail-mode toggle present, on by default, uses dashboard-tail-mode key', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const html = generateHTML(makeHealthyFixture());
    expect(html).toContain('id="log-tail-checkbox"');
    expect(html).toMatch(/id="log-tail-checkbox"[^>]*checked/);
    expect(html).toContain("localStorage.setItem('dashboard-tail-mode'");
    expect(html).toContain("localStorage.getItem('dashboard-tail-mode')");
  });

  // AC-0415: empty-state blinking cursor + "Awaiting agent activity…" when
  // the log is empty. Also verifies prefers-reduced-motion guard on the
  // blink animation so accessibility isn't regressed.
  test('AC-0415: empty log renders blinking cursor placeholder', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    fixture.log = [];
    const html = generateHTML(fixture);

    expect(html).toContain('id="log-empty"');
    expect(html).toContain('class="log-cursor"');
    expect(html).toContain('Awaiting agent activity');
    expect(html).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)[\s\S]*?\.log-cursor \{ animation: blink-cursor/,
    );
    expect(html).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.log-cursor \{ animation: none/);
  });
});
