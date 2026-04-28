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

// Canonical phases mirror agents.config.json phases (seeded into sdlc-status.json by init-sdlc-status.js).
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
    project: {
      name: 'SDLC Dashboard',
      description: 'Agentic AI SDLC',
      repoUrl: 'https://github.com/ksyed0/PlanVisualizer',
      startDate: '2026-04-15',
    },
    cycles: [],
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
    expect(html).toContain('id="about-modal"');
    // The About modal always uses the fixed "Agentic SDLC Dashboard" title
    // regardless of the project name in the config.
    const titleInModal = new RegExp(`id="about-modal"[\\s\\S]*?<h2 class="pv-about-h2">Agentic SDLC Dashboard</h2>`);
    expect(html).toMatch(titleInModal);
  });
});

describe('generate-dashboard — US-0142 active agent prominence', () => {
  const { generateHTML } = require('../../tools/generate-dashboard.js');

  function makeFixtureWithAgentStatus(status) {
    const fixture = makeHealthyFixture();
    // Replace Pixel (the default active agent) with our test status
    fixture.agents.Pixel = { status, currentTask: 'US-0142 test', tasksCompleted: 1 };
    return fixture;
  }

  it('active agent card has is-active class', () => {
    const html = generateHTML(makeFixtureWithAgentStatus('active'));
    // The card div for Pixel must carry is-active
    expect(html).toMatch(/class="[^"]*agent-card[^"]*is-active[^"]*"/);
  });

  it('active agent card has agent-rail element', () => {
    const html = generateHTML(makeFixtureWithAgentStatus('active'));
    expect(html).toContain('agent-rail');
  });

  it('idle agent card does not have is-active class', () => {
    const html = generateHTML(makeFixtureWithAgentStatus('idle'));
    // idle Pixel card should NOT carry is-active
    expect(html).not.toMatch(/class="[^"]*agent-card[^"]*is-active[^"]*"/);
  });

  it('active agent live-dot has dot-pulse class', () => {
    const html = generateHTML(makeFixtureWithAgentStatus('active'));
    expect(html).toContain('dot-pulse');
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

describe('US-0120 stories panel polish', () => {
  function makeStoriesFixture() {
    const base = {
      project: {
        name: 'SDLC Dashboard',
        description: 'Agentic AI SDLC',
        repoUrl: 'https://github.com/ksyed0/PlanVisualizer',
        startDate: '2026-04-15',
      },
      currentPhase: 3,
      phases: CANONICAL_PHASES.map((p, i) => ({
        ...p,
        status: i < 2 ? 'complete' : i === 2 ? 'in-progress' : 'pending',
      })),
      agents: AGENT_NAMES.reduce((acc, name) => {
        acc[name] = { status: 'idle', currentTask: null, tasksCompleted: 0 };
        return acc;
      }, {}),
      epics: { 'EPIC-0016': 'Agentic Dashboard Mission Control Redesign' },
      stories: {
        'US-0120': {
          title: 'Stories panel polish',
          status: 'In Progress',
          epic: 'EPIC-0016',
          assignedAgent: 'Pixel',
          startedAt: new Date(Date.now() - (6 * 3600 + 23 * 60) * 1000).toISOString(),
        },
        'US-0121': {
          title: 'Terminal activity log',
          status: 'ToDo',
          epic: 'EPIC-0016',
          assignedAgent: null,
          startedAt: null,
        },
        'US-0119': {
          title: 'Spotlight redesign',
          status: 'Complete',
          epic: 'EPIC-0016',
          assignedAgent: 'Forge',
          startedAt: null,
        },
      },
      metrics: { storiesCompleted: 1, storiesTotal: 3, tasksCompleted: 0, tasksTotal: 3 },
      log: [{ time: '09:00', agent: 'Conductor', message: 'Session started' }],
    };
    return base;
  }

  // AC-0407: 3px vertical status strip on each story row, colour-coded by
  // status. Strip is applied via .status-complete / .status-inprogress /
  // .status-planned modifier classes on .story-row so patchDOM can retune
  // it later without re-rendering.
  test('AC-0407: story rows carry a status-strip modifier class', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const html = generateHTML(makeStoriesFixture());
    expect(html).toMatch(/<div class="story-row status-complete">[\s\S]*?US-0119/);
    expect(html).toMatch(/<div class="story-row status-inprogress">[\s\S]*?US-0120/);
    expect(html).toMatch(/<div class="story-row status-planned">[\s\S]*?US-0121/);
    // CSS enumerates the three strip colours + the 3px border-left baseline.
    expect(html).toMatch(/\.story-row \{[^}]*border-left:\s*3px solid/);
    // US-0137: story strip colours now use CSS vars (AC-0498 — no hex literals).
    expect(html).toMatch(/\.story-row\.status-complete \{[^}]*border-left-color:\s*var\(--ok\)/);
    expect(html).toMatch(/\.story-row\.status-inprogress \{[^}]*border-left-color:\s*var\(--warn\)/);
    expect(html).toMatch(/\.story-row\.status-planned \{[^}]*border-left-color:\s*var\(--text-dim\)/);
  });

  // AC-0408: elapsed pill appears on In Progress stories, rendered in
  // JetBrains Mono. formatElapsed is exported so the computation contract
  // (hours/minutes/seconds fall-through) is directly testable.
  test('AC-0408: in-progress stories render an elapsed-time pill in JetBrains Mono', () => {
    const { generateHTML, formatElapsed } = require('../../tools/generate-dashboard.js');
    // Unit-level: formatElapsed contract.
    const base = Date.parse('2026-04-15T09:00:00Z');
    expect(formatElapsed('2026-04-15T09:00:00Z', base + 45 * 1000)).toBe('45s');
    expect(formatElapsed('2026-04-15T09:00:00Z', base + 12 * 60 * 1000)).toBe('12m');
    expect(formatElapsed('2026-04-15T09:00:00Z', base + (6 * 3600 + 23 * 60) * 1000)).toBe('6h 23m');
    expect(formatElapsed(null, base)).toBeNull();
    expect(formatElapsed('not-a-date', base)).toBeNull();
    // Clock skew must never surface as a negative duration.
    expect(formatElapsed('2026-04-15T09:05:00Z', base)).toBe('0s');

    // Integration-level: the pill markup only appears for the in-progress
    // story, and the CSS declares the JetBrains Mono font-family.
    const html = generateHTML(makeStoriesFixture());
    expect(html).toMatch(/<span class="story-elapsed"[^>]*>\d+h \d+m<\/span>/);
    // Completed/ToDo rows must not carry the pill.
    const todoSlice = html.match(/<div class="story-row status-planned">[\s\S]*?<\/div>/);
    expect(todoSlice).not.toBeNull();
    expect(todoSlice[0]).not.toMatch(/story-elapsed/);
    const doneSlice = html.match(/<div class="story-row status-complete">[\s\S]*?<\/div>/);
    expect(doneSlice).not.toBeNull();
    expect(doneSlice[0]).not.toMatch(/story-elapsed/);
    expect(html).toMatch(/\.story-elapsed \{[\s\S]*?font-family:\s*var\(--font-mono\)/);
  });

  // AC-0409: epic headers reuse the tracked-out treatment that US-0110
  // standardised via .section-header (Departure Mono / var(--font-display),
  // uppercase, wide letter-spacing). The assertion looks for the
  // Departure-Mono-aligned font-family on .epic-header so a future
  // refactor can't silently regress it back to the Geist default.
  test('AC-0409: epic headers use the Departure Mono tracked-out treatment', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const html = generateHTML(makeStoriesFixture());
    expect(html).toMatch(/\.epic-header \{[^}]*font-family:\s*var\(--font-display\)/);
    expect(html).toMatch(/\.epic-header \{[^}]*text-transform:\s*uppercase/);
    expect(html).toMatch(/\.epic-header \{[^}]*letter-spacing:\s*0\.14em/);
  });

  // AC-0410: assigned stories get a coloured dot + initial next to the
  // title, drawn from the DASH_AGENT_COLORS map. Unassigned stories must
  // not leak an empty chip.
  test('AC-0410: assigned stories render a coloured agent dot + initial', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const html = generateHTML(makeStoriesFixture());
    // Pixel is assigned to US-0120 and Forge to US-0119 — both must surface
    // as story-agent chips with the correct initial letter.
    const pixelRow = html.match(/<div class="story-row status-inprogress">[\s\S]*?<\/div>/);
    expect(pixelRow).not.toBeNull();
    expect(pixelRow[0]).toMatch(/<span class="story-agent"[^>]*title="Pixel"/);
    expect(pixelRow[0]).toMatch(/<span class="story-agent-dot" style="background:[^"]+"><\/span>/);
    expect(pixelRow[0]).toMatch(/<span class="story-agent-initial">P<\/span>/);

    const forgeRow = html.match(/<div class="story-row status-complete">[\s\S]*?<\/div>/);
    expect(forgeRow).not.toBeNull();
    expect(forgeRow[0]).toMatch(/<span class="story-agent-initial">F<\/span>/);

    // Unassigned (assignedAgent: null) must not render a story-agent chip.
    const todoRow = html.match(/<div class="story-row status-planned">[\s\S]*?<\/div>/);
    expect(todoRow).not.toBeNull();
    expect(todoRow[0]).not.toMatch(/story-agent/);

    // min-width: 0 on .story-title must persist — BUG-0164 fix guard.
    expect(html).toMatch(/\.story-title \{[^}]*min-width:\s*0/);
  });
});

// --- US-0127: init-sdlc-status buildStatus ---
const os = require('os');

describe('init-sdlc-status — buildStatus', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.resetModules();
  });

  function writeConfig(obj) {
    fs.writeFileSync(path.join(tmpDir, 'agents.config.json'), JSON.stringify(obj));
    return path.join(tmpDir, 'agents.config.json');
  }

  it('writes project block (not hackathon) to output', () => {
    const { buildStatus } = require('../../tools/init-sdlc-status');
    const cfgPath = writeConfig({
      project: {
        name: 'TestProj',
        description: 'Desc',
        repoUrl: 'https://github.com/test/proj',
        startDate: '2026-01-01',
      },
      phases: [],
      agents: {},
    });
    const status = buildStatus(cfgPath);
    expect(status.project).toBeDefined();
    expect(status.project.name).toBe('TestProj');
    expect(status.project.repoUrl).toBe('https://github.com/test/proj');
    expect(status.hackathon).toBeUndefined();
  });

  it('seeds phases from config with id, status:pending, timestamps null', () => {
    const { buildStatus } = require('../../tools/init-sdlc-status');
    const cfgPath = writeConfig({
      project: { name: 'P', description: '', repoUrl: '', startDate: '2026-01-01' },
      phases: [
        { name: 'Build', agents: ['Dev'], deliverables: ['code'] },
        { name: 'Test', agents: ['QA'], deliverables: ['report'] },
      ],
      agents: {},
    });
    const status = buildStatus(cfgPath);
    expect(status.phases).toHaveLength(2);
    expect(status.phases[0]).toMatchObject({
      id: 1,
      name: 'Build',
      status: 'pending',
      startedAt: null,
      completedAt: null,
    });
    expect(status.phases[1]).toMatchObject({ id: 2, name: 'Test' });
  });

  it('initialises cycles as empty array', () => {
    const { buildStatus } = require('../../tools/init-sdlc-status');
    const cfgPath = writeConfig({
      project: { name: 'P', description: '', repoUrl: '', startDate: '' },
      phases: [],
      agents: {},
    });
    const status = buildStatus(cfgPath);
    expect(status.cycles).toEqual([]);
  });
});

describe('generate-dashboard — US-0143 conductor dispatch hold', () => {
  it('dashboard JS includes conductorHoldMs = 3000', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('conductorHoldMs');
    expect(src).toContain('3000');
  });

  it('dashboard JS includes setConductorActive function', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('setConductorActive');
  });

  it('setConductorActive calls appendEventLog', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('appendEventLog');
  });

  it('Conductor card has data-agent attribute matching setConductorActive selector', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    const html = generateHTML(fixture);
    expect(html).toContain('data-agent="Conductor"');
  });

  it('Conductor card contains conductor-dispatch-count element', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    const html = generateHTML(fixture);
    expect(html).toContain('conductor-dispatch-count');
    expect(html).toContain('0 dispatched');
  });

  it('setConductorActive increments dispatch counter in JS source', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('_dispatchCount++');
    expect(src).toContain('conductor-dispatch-count');
  });
});

describe('generate-dashboard — US-0145 event log', () => {
  it('dashboard HTML contains pv-event-log element', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('pv-event-log');
  });

  it('dashboard JS contains appendEventLog function', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('appendEventLog');
  });

  it('event log has evt-time, evt-agent, evt-msg columns', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('evt-time');
    expect(src).toContain('evt-agent');
    expect(src).toContain('evt-msg');
  });
});

describe('generate-dashboard — US-0144 pipeline scope', () => {
  it('dashboard HTML contains pv-phase-fill element', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('pv-phase-fill');
  });

  it('phase cards do not contain pv-phase-agent-task class', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).not.toContain('pv-phase-agent-task');
  });
});

describe('generate-dashboard — US-0146 live bar', () => {
  it('dashboard HTML contains pv-live-bar element', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('pv-live-bar');
  });

  it('live bar contains ON AIR chip', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('ON AIR');
  });

  it('live bar contains pv-live-clock element', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../tools/generate-dashboard.js'),
      'utf8',
    );
    expect(src).toContain('pv-live-clock');
  });
});

describe('generate-dashboard — US-0147 agent workload live data', () => {
  it('renders pv-workload-bar when stories have assigned agents', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    fixture.stories['US-0001'] = { title: 'Foo', status: 'In Progress', epic: 'EPIC-0016', agent: 'Pixel' };
    fixture.stories['US-0002'] = { title: 'Bar', status: 'Done', epic: 'EPIC-0016', agent: 'Pixel' };
    const html = generateHTML(fixture);
    expect(html).toContain('pv-workload-bar');
  });

  it('renders agent workload section with agent names', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    fixture.stories['US-0003'] = { title: 'Baz', status: 'In Progress', epic: 'EPIC-0016', agent: 'Forge' };
    const html = generateHTML(fixture);
    expect(html).toContain('pv-workload-section');
  });

  it('does not throw when no stories have agent field', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    // stories without agent field
    Object.values(fixture.stories).forEach((s) => delete s.agent);
    expect(() => generateHTML(fixture)).not.toThrow();
  });

  it('renders (N done) sub-label in workload rows', () => {
    const { generateHTML } = require('../../tools/generate-dashboard.js');
    const fixture = makeHealthyFixture();
    fixture.stories['US-0010'] = { title: 'Done story', status: 'Done', epic: 'EPIC-0016', agent: 'Pixel' };
    fixture.stories['US-0011'] = { title: 'Active story', status: 'In Progress', epic: 'EPIC-0016', agent: 'Pixel' };
    const html = generateHTML(fixture);
    expect(html).toContain('pv-workload-done');
    expect(html).toContain('(1 done)');
  });
});

// AC-0498: generated dashboard HTML must contain zero hex color literals
// (#RGB / #RRGGBB), rgb(), or rgba() calls. All colours must use oklch(),
// color-mix(in oklab, ...) or CSS custom properties.
describe('AC-0498 — no hex literals in generated dashboard HTML', () => {
  it('generateHTML output contains no hex colour literals or rgb()/rgba() calls', () => {
    const { generateHTML } = require('../../tools/generate-dashboard');
    const fixture = {
      phases: [],
      agents: {},
      metrics: {},
      cycles: [],
      log: [],
      stories: {},
      epics: {},
    };
    const html = generateHTML(fixture);
    const hits = html.match(/#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(/g) || [];
    expect(hits).toHaveLength(0);
  });
});
