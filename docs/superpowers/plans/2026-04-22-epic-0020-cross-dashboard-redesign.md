# EPIC-0020 — Cross-Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Plan-Status and Agentic dashboards under a shared token system (`theme.js`), a shared chrome component (`render-chrome.js`), and a consistent dark neutral visual language — eliminating every hardcoded hex literal from both generators.

**Architecture:** Three sequential tracks: Track 1 builds the shared foundation (token module + render-chrome + dual theme); Track 2 wires Plan-Status to it (mode badge, neutral chrome, unified charts, Status Hero density toggle, Rich Status tab); Track 3 wires the Agentic dashboard (active agent prominence, Event Log promotion, Pipeline scope card, Live Bar, Conductor dispatch hold, Agent Workload live data). Each track is tested before the next begins.

**Tech Stack:** Node.js, Jest, Chart.js (Plan-Status side), OKLCH colour tokens, CSS custom properties, `localStorage` for persistence, `render-html.js` + `generate-dashboard.js` as the two generator entry points.

---

## File Map

| File                                    | Action | Responsibility                                                                                                             |
| --------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `tools/lib/theme.js`                    | Modify | Add `palette`, `chartColors`, `type`, `radius`, `shadow`, `spacing`, `generateCssTokens()`, `generateDashboardCssTokens()` |
| `tools/lib/render-chrome.js`            | Create | `renderChrome(mode,data)`, `renderModeBadge(mode)`, `renderDashboardSwitcher(active)`, `renderThemeToggle()`               |
| `tools/lib/render-shell.js`             | Modify | Import `renderChrome`; replace `renderTopBar` chrome HTML with `renderChrome('report', data)`                              |
| `tools/lib/render-scripts.js`           | Modify | Wire Chart.js global defaults from `chartColors`                                                                           |
| `tools/lib/render-tabs.js`              | Modify | Add Status Hero card with L/M/S toggle; add Rich Status tab widgets                                                        |
| `tools/generate-dashboard.js`           | Modify | Import `renderChrome` + `generateDashboardCssTokens`; remove hardcoded hex block and gradient header                       |
| `tests/unit/theme.test.js`              | Modify | Add token shape assertions + AC-0498 no-hex lint rule                                                                      |
| `tests/unit/render-chrome.test.js`      | Create | Badge markup, aria-labels, segment tab active states                                                                       |
| `tests/unit/render-html.test.js`        | Modify | Status Hero HTML structure, density class assertions                                                                       |
| `tests/unit/generate-dashboard.test.js` | Modify | Shared chrome class names, AC-0498 no-hex assertion                                                                        |

---

## Track 1 — Foundation (US-0137 + US-0141)

### Task 1: Extend theme.js — palette + chartColors + spacing tokens (US-0137, partial)

**Files:**

- Modify: `tools/lib/theme.js`
- Modify: `tests/unit/theme.test.js`

- [ ] **Step 1: Read current theme.js exports**

  ```bash
  cat tools/lib/theme.js
  ```

  Confirm the file exports only `BADGE_TONE` and `badge`. Note the exact line of `module.exports`.

- [ ] **Step 2: Write failing test for new token exports**

  Open `tests/unit/theme.test.js` and add at the end, before the closing `});` of the outermost describe (or as a new top-level describe):

  ```js
  const theme = require('../../tools/lib/theme');

  describe('theme token exports — US-0137', () => {
    test('palette exports ink scale and semantic tokens', () => {
      expect(theme.palette).toBeDefined();
      expect(theme.palette.ink0).toMatch(/oklch/);
      expect(theme.palette.ink10).toMatch(/oklch/);
    });

    test('chartColors exports semantic colour keys', () => {
      expect(theme.chartColors).toBeDefined();
      const keys = ['ok', 'warn', 'risk', 'info', 'accent', 'mute'];
      keys.forEach((k) => expect(theme.chartColors[k]).toBeDefined());
    });

    test('type exports font stacks', () => {
      expect(theme.type).toBeDefined();
      expect(theme.type.sans).toBeDefined();
      expect(theme.type.mono).toBeDefined();
    });

    test('radius exports border radius scale', () => {
      expect(theme.radius).toBeDefined();
      expect(theme.radius.sm).toBeDefined();
      expect(theme.radius.full).toBe('9999px');
    });

    test('shadow exports card shadow', () => {
      expect(theme.shadow).toBeDefined();
      expect(theme.shadow.card).toBeDefined();
    });

    test('spacing exports 4px-base scale', () => {
      expect(theme.spacing).toBeDefined();
      expect(theme.spacing['1']).toBe('4px');
      expect(theme.spacing['4']).toBe('16px');
    });

    test('chromeTokens is a CSS variable declarations string', () => {
      expect(typeof theme.chromeTokens).toBe('string');
      expect(theme.chromeTokens).toContain('--chrome-bg');
      expect(theme.chromeTokens).toContain('--chrome-report-bg');
      expect(theme.chromeTokens).toContain('--chrome-live-bg');
      // must not contain hex literals
      expect(theme.chromeTokens).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    });
  });
  ```

- [ ] **Step 3: Run failing test**

  ```bash
  npx jest tests/unit/theme.test.js --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL — `theme.palette is not defined` or similar.

- [ ] **Step 4: Add new exports to theme.js**

  > **AC-0498 scope note:** The lint rule checks the full HTML output of both generators, including `<style>` blocks. This means CHROME_CSS (embedded as a `<style>` tag) must also be hex-free. Achieve this by defining chrome-specific CSS custom properties in both token generators and referencing them as `var(--chrome-*)` in CHROME_CSS.

  Open `tools/lib/theme.js`. Above the `module.exports` line, add:

  ```js
  const palette = {
    // ink scale (OKLCH)
    ink0: 'oklch(99% 0.004 95)',
    ink1: 'oklch(97% 0.006 95)',
    ink2: 'oklch(94% 0.008 95)',
    ink3: 'oklch(88% 0.010 95)',
    ink4: 'oklch(78% 0.012 95)',
    ink5: 'oklch(65% 0.014 95)',
    ink6: 'oklch(50% 0.014 95)',
    ink7: 'oklch(36% 0.014 95)',
    ink8: 'oklch(16% 0.012 95)',
    ink9: 'oklch(10% 0.008 95)',
    ink10: 'oklch(6%  0.006 95)',
    // semantic
    indigo: 'oklch(56% 0.22 264)',
    orange: 'oklch(72% 0.19 46)',
    green: 'oklch(66% 0.17 145)',
    amber: 'oklch(76% 0.17 80)',
    red: 'oklch(58% 0.22 25)',
    teal: 'oklch(60% 0.14 185)',
    violet: 'oklch(56% 0.22 290)',
  };

  const chartColors = {
    ok: palette.green,
    warn: palette.amber,
    risk: palette.red,
    info: palette.teal,
    accent: palette.indigo,
    mute: palette.ink5,
  };

  const type = {
    sans: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    display: "'Inter', sans-serif",
    mono: "'Departure Mono', 'Fira Code', monospace",
  };

  const radius = {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  };

  const shadow = {
    card: '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)',
    cardHover: '0 4px 12px rgba(0,0,0,.12)',
    modal: '0 20px 60px rgba(0,0,0,.24)',
  };

  const spacing = Object.fromEntries([1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => [String(n), `${n * 4}px`]));

  // Chrome-specific CSS custom properties (used by CHROME_CSS to stay hex-free)
  const chromeTokens = `
    --chrome-bg:      oklch(18% 0.015 220);
    --chrome-brand:   ${palette.ink0};
    --chrome-text:    ${palette.ink2};
    --chrome-muted:   ${palette.ink5};
    --chrome-subtle:  ${palette.ink6};
    --chrome-seg-active-bg: oklch(100% 0 0 / 0.08);
    --chrome-hover-bg:      oklch(100% 0 0 / 0.07);
    --chrome-theme-bg:      oklch(100% 0 0 / 0.07);
    --chrome-theme-active:  oklch(100% 0 0 / 0.12);
    --chrome-report-bg: color-mix(in oklab, ${palette.indigo} 25%, transparent);
    --chrome-report-text: oklch(79% 0.10 264);
    --chrome-report-pip: oklch(68% 0.14 264);
    --chrome-live-bg:   color-mix(in oklab, ${palette.orange} 20%, transparent);
    --chrome-live-text: oklch(83% 0.10 46);
    --chrome-live-pip:  oklch(77% 0.14 46);
    --chrome-border:    oklch(100% 0 0 / 0.06);
  `.trim();
  ```

  Then update `module.exports` to include the new exports:

  ```js
  module.exports = {
    BADGE_TONE,
    badge,
    palette,
    chartColors,
    type,
    radius,
    shadow,
    spacing,
    chromeTokens,
  };
  ```

- [ ] **Step 5: Run test — must pass**

  ```bash
  npx jest tests/unit/theme.test.js --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS all.

- [ ] **Step 6: Commit**

  ```bash
  git add tools/lib/theme.js tests/unit/theme.test.js
  git commit -m "feat: US-0137 — add palette, chartColors, type, radius, shadow, spacing to theme.js"
  ```

---

### Task 2: Add generateCssTokens() and generateDashboardCssTokens() to theme.js (US-0137 + US-0141)

**Files:**

- Modify: `tools/lib/theme.js`
- Modify: `tests/unit/theme.test.js`

- [ ] **Step 1: Write failing tests for both generators**

  Add to the US-0137 describe block in `tests/unit/theme.test.js`:

  ```js
  test('generateCssTokens returns :root block with --bg and --surface', () => {
    const css = theme.generateCssTokens();
    expect(css).toContain(':root');
    expect(css).toContain('--bg');
    expect(css).toContain('--surface');
    expect(css).toContain('--text');
    expect(css).toContain('--border');
    // must not contain hex literals
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  test('generateDashboardCssTokens returns :root block with hex-free live-accent', () => {
    const css = theme.generateDashboardCssTokens();
    expect(css).toContain(':root');
    expect(css).toContain('--live-accent');
    expect(css).toContain('--live-accent-soft');
    // must not contain hex literals
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  test('generateCssTokens dark block swaps bg and text', () => {
    const css = theme.generateCssTokens();
    expect(css).toContain('[data-theme="dark"]');
  });
  ```

- [ ] **Step 2: Run failing tests**

  ```bash
  npx jest tests/unit/theme.test.js --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL — `theme.generateCssTokens is not a function`.

- [ ] **Step 3: Implement generateCssTokens() in theme.js**

  Add before `module.exports` in `tools/lib/theme.js`:

  ```js
  function generateCssTokens() {
    return `
  :root {
    --bg:         ${palette.ink1};
    --surface:    ${palette.ink0};
    --text:       ${palette.ink9};
    --text-muted: ${palette.ink5};
    --border:     ${palette.ink3};
    --accent:     ${palette.violet};
    --ok:         ${palette.green};
    --warn:       ${palette.amber};
    --risk:       ${palette.red};
    --info:       ${palette.teal};
    --font-sans:  ${type.sans};
    --font-mono:  ${type.mono};
    --radius-sm:  ${radius.sm};
    --radius-md:  ${radius.md};
    --radius-lg:  ${radius.lg};
    --radius-full:${radius.full};
    --shadow-card:${shadow.card};
    --shadow-card-hover:${shadow.cardHover};
    ${chromeTokens}
  }
  [data-theme="dark"] {
    --bg:         ${palette.ink10};
    --surface:    ${palette.ink8};
    --text:       ${palette.ink1};
    --text-muted: ${palette.ink5};
    --border:     oklch(28% 0.018 95);
  }`.trim();
  }

  function generateDashboardCssTokens() {
    return `
  :root {
    --live-accent:      ${palette.orange};
    --live-accent-soft: oklch(72% 0.12 46 / 0.15);
    --report-accent:    ${palette.indigo};
    --bg:               ${palette.ink1};
    --surface:          ${palette.ink0};
    --text:             ${palette.ink9};
    --text-muted:       ${palette.ink5};
    --border:           ${palette.ink3};
    --ok:               ${palette.green};
    --warn:             ${palette.amber};
    --risk:             ${palette.red};
    --info:             ${palette.teal};
    ${chromeTokens}
  }
  [data-theme="dark"] {
    --bg:         ${palette.ink10};
    --surface:    ${palette.ink8};
    --text:       ${palette.ink1};
    --text-muted: ${palette.ink5};
    --border:     oklch(28% 0.018 95);
  }`.trim();
  }
  ```

  Add both to `module.exports`:

  ```js
  module.exports = {
    BADGE_TONE,
    badge,
    palette,
    chartColors,
    type,
    radius,
    shadow,
    spacing,
    chromeTokens,
    generateCssTokens,
    generateDashboardCssTokens,
  };
  ```

- [ ] **Step 4: Run tests — must pass**

  ```bash
  npx jest tests/unit/theme.test.js --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS all.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/lib/theme.js tests/unit/theme.test.js
  git commit -m "feat: US-0137/US-0141 — add generateCssTokens() and generateDashboardCssTokens() to theme.js"
  ```

---

### Task 3: Create render-chrome.js (US-0137)

**Files:**

- Create: `tools/lib/render-chrome.js`
- Create: `tests/unit/render-chrome.test.js`

- [ ] **Step 1: Write failing tests for render-chrome.js**

  Create `tests/unit/render-chrome.test.js`:

  ```js
  'use strict';
  const {
    renderChrome,
    renderModeBadge,
    renderDashboardSwitcher,
    renderThemeToggle,
  } = require('../../tools/lib/render-chrome');

  describe('render-chrome — US-0137/US-0138', () => {
    describe('renderModeBadge', () => {
      test('report badge has aria-label and mode-report class', () => {
        const html = renderModeBadge('report');
        expect(html).toContain('mode-report');
        expect(html).toContain('aria-label="Mode: Report"');
        expect(html).toContain('REPORT');
        expect(html).not.toContain('mode-pip-pulse');
      });

      test('live badge has pulsing pip and mode-live class', () => {
        const html = renderModeBadge('live');
        expect(html).toContain('mode-live');
        expect(html).toContain('aria-label="Mode: Live"');
        expect(html).toContain('LIVE');
        expect(html).toContain('mode-pip-pulse');
      });
    });

    describe('renderDashboardSwitcher', () => {
      test('plan-status active sets pv-seg-active on first segment', () => {
        const html = renderDashboardSwitcher('plan-status');
        expect(html).toMatch(/pv-seg-active[^>]*>Plan-Status/);
      });

      test('pipeline active sets pv-seg-active on second segment', () => {
        const html = renderDashboardSwitcher('pipeline');
        expect(html).toMatch(/pv-seg-active[^>]*>Pipeline/);
      });
    });

    describe('renderThemeToggle', () => {
      test('renders sun and moon buttons', () => {
        const html = renderThemeToggle();
        expect(html).toContain('pv-theme-segs');
        expect(html).toContain('pv-theme-btn');
        // at least one sun/moon symbol
        expect(html.length).toBeGreaterThan(10);
      });
    });

    describe('renderChrome', () => {
      test('report mode produces pv-chrome header with report badge', () => {
        const html = renderChrome('report', {});
        expect(html).toContain('<header');
        expect(html).toContain('pv-chrome');
        expect(html).toContain('mode-report');
        expect(html).not.toContain('mode-live');
      });

      test('live mode produces pv-chrome header with live badge', () => {
        const html = renderChrome('live', {});
        expect(html).toContain('pv-chrome');
        expect(html).toContain('mode-live');
        expect(html).not.toContain('mode-report');
      });

      test('output contains no hex colour literals', () => {
        const html = renderChrome('report', {}) + renderChrome('live', {});
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      });

      test('chrome height class is present', () => {
        const html = renderChrome('report', {});
        expect(html).toContain('pv-chrome');
      });
    });
  });
  ```

- [ ] **Step 2: Run failing tests**

  ```bash
  npx jest tests/unit/render-chrome.test.js --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL — module not found.

- [ ] **Step 3: Create tools/lib/render-chrome.js**

  ```js
  'use strict';

  // CHROME_CSS uses only CSS custom properties (no hex literals) so that the
  // embedded <style> block passes the AC-0498 no-hex lint rule.
  const CHROME_CSS = `
  .pv-chrome {
    height: 52px;
    background: var(--chrome-bg);
    border-bottom: 1px solid var(--chrome-border);
    display: flex;
    align-items: center;
    padding: 0 14px;
    gap: 8px;
    font-size: 12px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .pv-brand {
    font-weight: 700;
    font-size: 13px;
    color: var(--chrome-brand);
    letter-spacing: -.01em;
    margin-right: 4px;
    text-decoration: none;
  }
  .pv-seg-group { display: flex; gap: 2px; }
  .pv-seg {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    color: var(--chrome-muted);
    cursor: pointer;
    border: none;
    background: none;
    text-decoration: none;
  }
  .pv-seg-active {
    background: var(--chrome-seg-active-bg);
    color: var(--chrome-text);
    font-weight: 600;
  }
  .pv-spacer { flex: 1; }
  .pv-iconbtn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--chrome-muted);
    cursor: pointer;
    border: none;
    background: none;
  }
  .pv-iconbtn:hover { background: var(--chrome-hover-bg); }
  .pv-theme-segs {
    display: flex;
    background: var(--chrome-theme-bg);
    border-radius: 6px;
    padding: 2px;
    gap: 1px;
  }
  .pv-theme-btn {
    padding: 3px 7px;
    border-radius: 4px;
    font-size: 11px;
    color: var(--chrome-subtle);
    cursor: pointer;
    border: none;
    background: none;
  }
  .pv-theme-btn.active {
    background: var(--chrome-theme-active);
    color: var(--chrome-text);
  }
  .mode-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 9999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .06em;
  }
  .mode-report { background: var(--chrome-report-bg); color: var(--chrome-report-text); }
  .mode-live   { background: var(--chrome-live-bg);   color: var(--chrome-live-text); }
  .mode-pip { width: 7px; height: 7px; border-radius: 50%; }
  .mode-report .mode-pip { background: var(--chrome-report-pip); }
  .mode-live   .mode-pip { background: var(--chrome-live-pip); }
  .mode-pip-pulse { animation: pv-pip-pulse 1.6s ease-in-out infinite; }
  @keyframes pv-pip-pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .5; transform: scale(.8); }
  }
  @media (prefers-reduced-motion: reduce) {
    .mode-pip-pulse { animation: none; }
  }
  `.trim();

  function renderModeBadge(mode) {
    if (mode === 'live') {
      return (
        `<span class="mode-badge mode-live" aria-label="Mode: Live" tabindex="0">` +
        `<span class="mode-pip mode-pip-pulse"></span> LIVE` +
        `</span>`
      );
    }
    return (
      `<span class="mode-badge mode-report" aria-label="Mode: Report" tabindex="0">` +
      `<span class="mode-pip"></span> REPORT` +
      `</span>`
    );
  }

  function renderDashboardSwitcher(active) {
    const ps = active === 'plan-status' ? ' pv-seg-active' : '';
    const pp = active === 'pipeline' ? ' pv-seg-active' : '';
    const psHref = active === 'pipeline' ? 'plan-status.html' : '#';
    const ppHref = active === 'plan-status' ? 'dashboard.html' : '#';
    return (
      `<div class="pv-seg-group">` +
      `<a href="${psHref}" class="pv-seg${ps}">Plan-Status</a>` +
      `<a href="${ppHref}" class="pv-seg${pp}">Pipeline</a>` +
      `</div>`
    );
  }

  function renderThemeToggle() {
    return (
      `<div class="pv-theme-segs" role="group" aria-label="Theme">` +
      `<button class="pv-theme-btn active" data-theme="light" onclick="pvSetTheme('light')" aria-pressed="true">\u2600</button>` +
      `<button class="pv-theme-btn" data-theme="dark" onclick="pvSetTheme('dark')" aria-pressed="false">\u263e</button>` +
      `</div>`
    );
  }

  function renderChrome(mode, _data) {
    const active = mode === 'live' ? 'pipeline' : 'plan-status';
    return (
      `<style>${CHROME_CSS}</style>` +
      `<header class="pv-chrome" data-mode="${mode}">` +
      `<span class="pv-brand">PlanViz</span>` +
      renderDashboardSwitcher(active) +
      `<div class="pv-spacer"></div>` +
      renderModeBadge(mode) +
      `<button class="pv-iconbtn" onclick="document.getElementById('search-modal')?.showModal()" aria-label="Search">&#8984;K</button>` +
      `<button class="pv-iconbtn" onclick="document.getElementById('about-modal')?.showModal()" aria-label="About">&#9432;</button>` +
      renderThemeToggle() +
      `</header>`
    );
  }

  module.exports = { renderChrome, renderModeBadge, renderDashboardSwitcher, renderThemeToggle, CHROME_CSS };
  ```

- [ ] **Step 4: Run tests — must pass**

  ```bash
  npx jest tests/unit/render-chrome.test.js --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS all.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/lib/render-chrome.js tests/unit/render-chrome.test.js
  git commit -m "feat: US-0137 — create render-chrome.js with renderChrome, renderModeBadge, renderDashboardSwitcher, renderThemeToggle"
  ```

---

### Task 4: Wire render-shell.js to renderChrome + AC-0498 no-hex lint rule (US-0137)

**Files:**

- Modify: `tools/lib/render-shell.js`
- Modify: `tests/unit/theme.test.js`

- [ ] **Step 1: Write AC-0498 lint test (failing)**

  Add a new top-level describe to `tests/unit/theme.test.js`:

  ```js
  describe('AC-0498 — no hex literals in generated HTML', () => {
    test('generate-plan.js output contains no hex colour literals', () => {
      const { renderHtml } = require('../../tools/lib/render-html');
      // minimal data shape
      const data = {
        epics: [],
        stories: [],
        tasks: [],
        testCases: [],
        bugs: [],
        lessons: [],
        costs: { _totals: { costUsd: 0, projectedUsd: 0 } },
        atRisk: {},
        coverage: { available: false },
        recentActivity: [],
        generatedAt: new Date().toISOString(),
        commitSha: 'test',
        projectName: 'Test',
        tagline: '',
        risk: { byStory: new Map(), byEpic: new Map() },
        sdlcStatus: null,
        completion: null,
      };
      const html = renderHtml(data);
      const matches = html.match(/#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(/g) || [];
      expect(matches).toHaveLength(0);
    });
  });
  ```

  > This test will likely FAIL initially because render-shell.js has hardcoded colors in the budget bar. That is the expected state — the test is the acceptance gate.

- [ ] **Step 2: Run failing lint test**

  ```bash
  npx jest tests/unit/theme.test.js -t "AC-0498" --no-coverage 2>&1 | tail -30
  ```

  Expected: FAIL — hex literals found.

- [ ] **Step 3: Read render-shell.js renderTopBar to find hardcoded colors**

  ```bash
  grep -n '#[0-9a-fA-F]\{3,6\}\|rgb(' tools/lib/render-shell.js | head -20
  ```

  Note the lines. These will be the budget-bar inline styles: `#22c55e`, `#f97316`, `#ef4444`, `#eab308`, `#334155`.

- [ ] **Step 4: Add renderChrome import and wire it into renderTopBar's chrome slot**

  At the top of `tools/lib/render-shell.js`, after the existing requires, add:

  ```js
  const { renderChrome, CHROME_CSS } = require('./render-chrome');
  ```

  Locate the `renderTopBar` function. Identify the lines that produce the `<header id="topbar-fixed">` element — these are the brand, nav tabs, search, about, theme toggle portion (not the metric tiles). Replace only that HTML segment with a call to `renderChrome('report', data)`.

  The result should be: the returned HTML from `renderTopBar` starts with `renderChrome('report', data)` (producing the `<header class="pv-chrome">`) followed by the metric tiles / completion banner in their own container below the chrome.

  > **Implementation guidance:** `renderTopBar` currently returns one long string. Split it into:
  >
  > 1. `renderChrome('report', data)` — the 52px dark chrome bar (new)
  > 2. The existing metric tiles block (unchanged) — keep the project title, stats, budget bar, etc. in their own `<div class="pv-metric-bar">` element below.

- [ ] **Step 5: Replace hardcoded hex in budget bar with CSS custom properties**

  In the budget bar inline styles within `render-shell.js`, replace:
  - `#22c55e` → `var(--ok)`
  - `#f97316` → `var(--warn)`
  - `#ef4444` → `var(--risk)`
  - `#eab308` → `var(--warn)`
  - `#334155` → `var(--surface-alt, #334155)` — add `--surface-alt` to generateCssTokens() output if not already present

- [ ] **Step 6: Run AC-0498 lint test — expect PASS**

  ```bash
  npx jest tests/unit/theme.test.js -t "AC-0498" --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS.

- [ ] **Step 7: Run full test suite — no regressions**

  ```bash
  npx jest --no-coverage 2>&1 | tail -20
  ```

  Expected: all tests green (597+ passing).

- [ ] **Step 8: Commit**

  ```bash
  git add tools/lib/render-shell.js tools/lib/render-chrome.js tests/unit/theme.test.js
  git commit -m "feat: US-0137 — wire render-shell.js to renderChrome; AC-0498 no-hex lint gate"
  ```

---

### Task 5: Wire generate-dashboard.js to renderChrome + generateDashboardCssTokens (US-0137)

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

> ⚠️ `generate-dashboard.js` is 3,124 lines with pervasive hardcoded hex. Migrate colour-by-colour. Verify progress by running the lint assertion below after each batch.

- [ ] **Step 1: Write failing AC-0498 test for dashboard output**

  In `tests/unit/generate-dashboard.test.js`, add a new describe block:

  ```js
  describe('AC-0498 — no hex literals in dashboard output', () => {
    test('generateHTML output contains no hex colour literals', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const minData = require('../../docs/dashboard.html') === undefined ? null : null;
      // call with empty sdlcStatus
      const html = generateHTML({
        project: { name: 'Test' },
        agents: [],
        phases: [],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
        sdlcStatus: null,
      });
      const matches = html.match(/#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(/g) || [];
      expect(matches).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 2: Run failing test**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "AC-0498" --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL — many hex literals found.

- [ ] **Step 3: Add imports at top of generate-dashboard.js**

  At the very top of `tools/generate-dashboard.js` (after any existing requires), add:

  ```js
  const { renderChrome, CHROME_CSS } = require('./lib/render-chrome');
  const { generateDashboardCssTokens } = require('./lib/theme');
  ```

- [ ] **Step 4: Replace the CSS colour block with generateDashboardCssTokens()**

  Find the inline `<style>` block in `generateHTML()` that defines the CSS variables / root tokens. Replace the hardcoded `:root { }` section with:

  ```js
  `<style>
  ${generateDashboardCssTokens()}
  ${CHROME_CSS}
  /* ... rest of dashboard CSS ... */
  </style>`;
  ```

- [ ] **Step 5: Replace the gradient header HTML with renderChrome('live', data)**

  Find the `<div class="header...">` block (around line 1494). Replace it with:

  ```js
  renderChrome('live', data);
  ```

  Remove the old header CSS (`.header { background: linear-gradient(...) }`) from the `<style>` block.

- [ ] **Step 6: Batch-replace remaining hex literals with CSS variables**

  Run this to see remaining hex literals:

  ```bash
  node -e "
  const { generateHTML } = require('./tools/generate-dashboard');
  const html = generateHTML({ project:{name:'T'}, agents:[], phases:[], stories:{},
    metrics:{totalStories:0,storiesDone:0,storiesInProgress:0,openBugs:0,
      bugsFixed:0,aiCostUsd:0,testsPassed:0,testsFailed:0,coveragePct:0},
    log:[], cycles:[], sdlcStatus:null });
  const m = [...new Set((html.match(/#[0-9a-fA-F]{3,6}\b/g)||[]))];
  console.log(m.join('\n'));
  " 2>/dev/null
  ```

  For each hex value found, determine its semantic role and replace with the appropriate CSS variable:
  - greens (`#22c55e`, `#34A853`) → `var(--ok)`
  - ambers/yellows (`#f59e0b`, `#eab308`) → `var(--warn)`
  - reds (`#ef4444`, `#dc2626`) → `var(--risk)`
  - teals (`#0d9488`) → `var(--info)`
  - indigos (`#6366f1`, `#4f46e5`) → `var(--report-accent)`
  - oranges (`#f97316`, `#fb923c`) → `var(--live-accent)`
  - text/border neutrals → `var(--text)`, `var(--text-muted)`, `var(--border)`
  - backgrounds → `var(--bg)`, `var(--surface)`

  Repeat until zero hex literals remain in the output.

- [ ] **Step 7: Run AC-0498 test — must pass**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "AC-0498" --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS.

- [ ] **Step 8: Run full test suite**

  ```bash
  npx jest --no-coverage 2>&1 | tail -20
  ```

  Expected: all tests green.

- [ ] **Step 9: Commit**

  ```bash
  git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
  git commit -m "feat: US-0137 — wire generate-dashboard.js to renderChrome + generateDashboardCssTokens; AC-0498 passes"
  ```

---

### Task 6: US-0141 — Dual Theme (light/dark declarations + localStorage persistence)

**Files:**

- Modify: `tools/lib/theme.js` (generateCssTokens already done — verify completeness)
- Modify: `tools/lib/render-scripts.js` (theme toggle JS)
- Modify: `tests/unit/theme.test.js`

- [ ] **Step 1: Write failing tests for dual-theme behaviour**

  Add to `tests/unit/theme.test.js`:

  ```js
  describe('US-0141 — Dual Theme tokens', () => {
    test('generateCssTokens includes card border rule', () => {
      const css = theme.generateCssTokens();
      // every card uses 1px solid var(--border)
      expect(css).toContain('--border');
    });

    test('generateCssTokens dark mode base is not pure black', () => {
      const css = theme.generateCssTokens();
      // ink10 = oklch(6% ...) not #000
      expect(css).not.toContain('#000');
      expect(css).toContain('[data-theme="dark"]');
    });

    test('generateCssTokens light mode base is not #fff', () => {
      const css = theme.generateCssTokens();
      expect(css).not.toContain('#fff');
    });
  });
  ```

- [ ] **Step 2: Run tests — should pass** (generateCssTokens already uses palette OKLCH values)

  ```bash
  npx jest tests/unit/theme.test.js -t "US-0141" --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS (if generateCssTokens was implemented correctly in Task 2). If FAIL, fix generateCssTokens to avoid any `#fff` or `#000` literals.

- [ ] **Step 3: Wire theme persistence JS in render-scripts.js**

  In `tools/lib/render-scripts.js`, find the existing theme toggle handler (the function called when ☀/☾ buttons are clicked). Replace or extend it with:

  ```js
  function pvSetTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('pv-theme', t);
    document.querySelectorAll('.pv-theme-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === t);
      btn.setAttribute('aria-pressed', String(btn.dataset.theme === t));
    });
  }
  // Restore on load
  (function () {
    const saved =
      localStorage.getItem('pv-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    pvSetTheme(saved);
  })();
  ```

  Expose `pvSetTheme` on `window` so the inline `onclick="pvSetTheme('light')"` in render-chrome.js works:

  ```js
  window.pvSetTheme = pvSetTheme;
  ```

- [ ] **Step 4: Run full test suite**

  ```bash
  npx jest --no-coverage 2>&1 | tail -20
  ```

  Expected: all green.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/lib/theme.js tools/lib/render-scripts.js tests/unit/theme.test.js
  git commit -m "feat: US-0141 — dual theme OKLCH tokens + localStorage persistence via pvSetTheme()"
  ```

---

## Track 2 — Plan-Status (US-0138 → US-0136 → US-0140 → US-0135 → US-0139)

> US-0138 (Mode Badge) is already implemented in `render-chrome.js` (Task 3). The tests in `render-chrome.test.js` cover AC for US-0138. Mark US-0138 Done.

---

### Task 7: US-0136 — Neutral Chrome (verify Plan-Status chrome is correct)

**Files:**

- Verify: `tools/lib/render-shell.js` (done in Task 4)
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write test asserting the shared chrome is present in Plan-Status output**

  Add to `tests/unit/render-html.test.js` in the main `describe('renderHtml', ...)` block:

  ```js
  describe('US-0136 — Neutral Chrome', () => {
    test('Plan-Status HTML contains pv-chrome header', () => {
      expect(html).toContain('pv-chrome');
    });

    test('Plan-Status chrome contains mode-report badge', () => {
      expect(html).toContain('mode-report');
    });

    test('Plan-Status chrome does not contain navy gradient', () => {
      expect(html).not.toContain('linear-gradient(135deg, #003087');
    });

    test('Plan-Status chrome does not contain frosted glass backdrop', () => {
      expect(html).not.toContain('backdrop-filter: blur');
    });
  });
  ```

- [ ] **Step 2: Run tests**

  ```bash
  npx jest tests/unit/render-html.test.js -t "US-0136" --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS (if Task 4 wired correctly). If FAIL, fix render-shell.js renderTopBar chrome wiring.

- [ ] **Step 3: Commit**

  ```bash
  git add tests/unit/render-html.test.js
  git commit -m "test: US-0136 — assert neutral chrome present and gradient absent from Plan-Status output"
  ```

---

### Task 8: US-0140 — Unified Chart Palette (wire Chart.js globals)

**Files:**

- Modify: `tools/lib/render-scripts.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write failing test**

  Add to `tests/unit/render-html.test.js`:

  ```js
  describe('US-0140 — Unified Chart Palette', () => {
    test('rendered HTML wires Chart.defaults.color to CSS variable', () => {
      expect(html).toContain("Chart.defaults.color = 'var(--text-muted)'");
    });

    test('rendered HTML wires Chart.defaults.borderColor to CSS variable', () => {
      expect(html).toContain("Chart.defaults.borderColor = 'var(--border)'");
    });
  });
  ```

- [ ] **Step 2: Run failing test**

  ```bash
  npx jest tests/unit/render-html.test.js -t "US-0140" --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL.

- [ ] **Step 3: Add Chart.js global defaults to render-scripts.js**

  In `tools/lib/render-scripts.js`, find where Chart.js is initialized (the `document.addEventListener('DOMContentLoaded', ...)` block or equivalent). At the top of that block, before any chart instantiation, add:

  ```js
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = 'var(--text-muted)';
    Chart.defaults.borderColor = 'var(--border)';
    Chart.defaults.font.family =
      getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || '-apple-system, sans-serif';
  }
  ```

  Then in each chart's `datasets[].backgroundColor` / `borderColor` config, replace hardcoded hex with CSS variable references pulled from `getComputedStyle`. Add a helper near the top of the embedded script block:

  ```js
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  ```

  Replace chart colour literals:
  - `#22c55e` → `cssVar('--ok')`
  - `#f59e0b` → `cssVar('--warn')`
  - `#ef4444` → `cssVar('--risk')`
  - `#3b82f6` → `cssVar('--info')`
  - `#6366f1` → `cssVar('--accent')`
  - `#94a3b8` → `cssVar('--text-muted')`
  - `#0d9488` → `cssVar('--info')`

- [ ] **Step 4: Run tests — must pass**

  ```bash
  npx jest tests/unit/render-html.test.js -t "US-0140" --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS.

- [ ] **Step 5: Run full suite**

  ```bash
  npx jest --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add tools/lib/render-scripts.js tests/unit/render-html.test.js
  git commit -m "feat: US-0140 — wire Chart.js global defaults and chart colours to CSS custom properties"
  ```

---

### Task 9: US-0135 — Status Hero Card with L/M/S Density Toggle

**Files:**

- Modify: `tools/lib/render-tabs.js` (add/replace status hero card renderer)
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write failing tests**

  Add to `tests/unit/render-html.test.js`:

  ```js
  describe('US-0135 — Status Hero Card', () => {
    test('Status tab contains density toggle with L M S buttons', () => {
      expect(html).toContain('pv-hero-density');
      expect(html).toMatch(/data-density="L"/);
      expect(html).toMatch(/data-density="M"/);
      expect(html).toMatch(/data-density="S"/);
    });

    test('default density is M (pv-hero-active class on M)', () => {
      // The M panel should have pv-hero-active class or be the default visible one
      expect(html).toMatch(/data-density="M"[^>]*pv-hero-active|pv-hero-active[^>]*data-density="M"/);
    });

    test('toggle is anchored inside verdict section (not floating)', () => {
      // toggle must appear inside a class containing "verdict"
      const verdictIdx = html.indexOf('pv-hero-verdict');
      const toggleIdx = html.indexOf('pv-hero-density');
      expect(verdictIdx).toBeGreaterThanOrEqual(0);
      expect(toggleIdx).toBeGreaterThan(verdictIdx);
      // and toggle must appear before closing tag of verdict block
      const nextSectionAfterVerdict = html.indexOf('pv-hero-stats', verdictIdx);
      expect(toggleIdx).toBeLessThan(nextSectionAfterVerdict);
    });

    test('Status hero contains stats section', () => {
      expect(html).toContain('pv-hero-stats');
    });

    test('Status hero contains viz section', () => {
      expect(html).toContain('pv-hero-viz');
    });
  });
  ```

- [ ] **Step 2: Run failing tests**

  ```bash
  npx jest tests/unit/render-html.test.js -t "US-0135" --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL — `pv-hero-density` not found.

- [ ] **Step 3: Add Status Hero renderer in render-tabs.js**

  Find the function in `tools/lib/render-tabs.js` that renders the Status tab (search for `renderStatusTab` or the function building the first tab's content). Add or replace the hero card at the top of that function:

  ```js
  function renderStatusHeroCard(data) {
    const { stories = [], bugs = [], costs = {}, coverage = {} } = data;
    const done = stories.filter((s) => s.status === 'Done' && s.status !== 'Retired').length;
    const total = stories.filter((s) => s.status !== 'Retired').length;
    const inProgress = stories.filter((s) => s.status === 'In Progress' || s.status === 'In-Progress').length;
    const openBugs = bugs.filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const onTrack = pct >= 60 && openBugs < 5;
    const verdict = onTrack ? 'ON TRACK' : 'AT RISK';
    const verdictCls = onTrack ? 'pv-verdict-ok' : 'pv-verdict-risk';
    const narrative = onTrack
      ? `${pct}% complete · ${inProgress} in progress · ${openBugs} open bugs`
      : `${pct}% complete · ${openBugs} open bugs need attention`;

    const toggle =
      `<div class="pv-hero-toggle" role="group" aria-label="Density">` +
      ['L', 'M', 'S']
        .map(
          (d) =>
            `<button class="pv-hero-density-btn${d === 'M' ? ' pv-hero-active' : ''}" ` +
            `data-density="${d}" onclick="pvHeroDensity('${d}')">${d}</button>`,
        )
        .join('') +
      `</div>`;

    const verdictBlock =
      `<div class="pv-hero-verdict ${verdictCls}" style="position:relative">` +
      toggle +
      `<div class="pv-verdict-word">${verdict}</div>` +
      `<div class="pv-verdict-narrative">${narrative}</div>` +
      `</div>`;

    const statsBlock =
      `<div class="pv-hero-stats">` +
      `<div class="pv-hero-stat"><span class="pv-stat-val">${done}/${total}</span><span class="pv-stat-lbl">Stories Done</span></div>` +
      `<div class="pv-hero-stat"><span class="pv-stat-val">${inProgress}</span><span class="pv-stat-lbl">In Progress</span></div>` +
      `<div class="pv-hero-stat"><span class="pv-stat-val">${openBugs}</span><span class="pv-stat-lbl">Open Bugs</span></div>` +
      `</div>`;

    const vizBlock =
      `<div class="pv-hero-viz">` +
      `<div class="pv-hero-viz-panel pv-hero-progress"><div class="pv-viz-label">Progress</div>` +
      `<div class="pv-bar-wrap"><div class="pv-bar-fill" style="width:${pct}%"></div></div></div>` +
      `<div class="pv-hero-viz-panel pv-hero-coverage"><div class="pv-viz-label">Coverage</div>` +
      `<div class="pv-bar-wrap"><div class="pv-bar-fill pv-bar-info" style="width:${coverage.overall ?? 0}%"></div></div></div>` +
      `</div>`;

    return (
      `<div class="pv-status-hero" data-density="M">` +
      verdictBlock +
      statsBlock +
      vizBlock +
      `</div>` +
      `<style>
  .pv-status-hero { display: grid; grid-template-rows: auto auto auto; gap: 0; }
  .pv-hero-verdict { display: flex; flex-direction: column; justify-content: center;
    padding: 16px; min-height: 72px; }
  .pv-verdict-ok   { background: oklch(66% 0.17 145 / 0.15); border-left: 4px solid var(--ok); }
  .pv-verdict-risk  { background: oklch(58% 0.22 25 / 0.12); border-left: 4px solid var(--risk); }
  .pv-verdict-word  { font-size: 22px; font-weight: 800; white-space: nowrap; }
  .pv-verdict-narrative { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
  .pv-hero-toggle { position: absolute; top: 8px; right: 10px;
    display: flex; gap: 2px; }
  .pv-hero-density-btn {
    padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;
    border: 1px solid rgba(255,255,255,.2); background: none; color: inherit;
    cursor: pointer; opacity: .6;
  }
  .pv-hero-density-btn.pv-hero-active { opacity: 1; background: rgba(255,255,255,.15); }
  .pv-hero-stats { display: flex; gap: 0; }
  .pv-hero-stat  { flex: 1; display: flex; flex-direction: column; justify-content: center;
    align-items: center; padding: 12px 0; }
  .pv-stat-val   { font-size: 20px; font-weight: 700; }
  .pv-stat-lbl   { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  .pv-hero-viz   { display: flex; gap: 8px; padding: 12px; }
  .pv-hero-viz-panel { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .pv-viz-label  { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
  .pv-bar-wrap   { width: 100%; background: var(--border); border-radius: 4px; height: 8px; overflow: hidden; }
  .pv-bar-fill   { height: 100%; background: var(--ok); border-radius: 4px; }
  .pv-bar-info   { background: var(--info); }
  </style>` +
      `<script>
  (function() {
    var saved = localStorage.getItem('pv-hero-density') || 'M';
    pvHeroDensity(saved);
  })();
  function pvHeroDensity(d) {
    localStorage.setItem('pv-hero-density', d);
    var hero = document.querySelector('.pv-status-hero');
    if (!hero) return;
    hero.setAttribute('data-density', d);
    document.querySelectorAll('.pv-hero-density-btn').forEach(function(btn) {
      btn.classList.toggle('pv-hero-active', btn.dataset.density === d);
    });
  }
  window.pvHeroDensity = pvHeroDensity;
  </script>`
    );
  }
  ```

  Call `renderStatusHeroCard(data)` at the top of the Status tab content (inside the status tab's HTML string, before existing content).

- [ ] **Step 4: Run tests — must pass**

  ```bash
  npx jest tests/unit/render-html.test.js -t "US-0135" --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS all 5 assertions.

- [ ] **Step 5: Run full suite**

  ```bash
  npx jest --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add tools/lib/render-tabs.js tests/unit/render-html.test.js
  git commit -m "feat: US-0135 — Status Hero card with L/M/S density toggle anchored in verdict section"
  ```

---

### Task 10: US-0139 — Rich Status Tab (Top Risks, This Week, Agent Workload)

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write failing tests**

  Add to `tests/unit/render-html.test.js`:

  ```js
  describe('US-0139 — Rich Status Tab', () => {
    test('Status tab contains Top Risks widget', () => {
      expect(html).toContain('pv-widget-top-risks');
    });

    test('Status tab contains This Week widget', () => {
      expect(html).toContain('pv-widget-this-week');
    });

    test('Status tab contains Agent Workload widget', () => {
      expect(html).toContain('pv-widget-agent-workload');
    });

    test('widgets collapse to single column below 1100px via CSS', () => {
      expect(html).toContain('@media (max-width: 1100px)');
    });
  });
  ```

- [ ] **Step 2: Run failing tests**

  ```bash
  npx jest tests/unit/render-html.test.js -t "US-0139" --no-coverage 2>&1 | tail -20
  ```

  Expected: FAIL.

- [ ] **Step 3: Implement Rich Status Tab widgets in render-tabs.js**

  Add this function and call it after the hero card in the Status tab:

  ```js
  function renderRichStatusWidgets(data) {
    const { stories = [], bugs = [], costs = {}, risk = {} } = data;

    // Top Risks widget
    const criticalBugs = bugs
      .filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status) && /Critical|High/i.test(b.severity || ''))
      .slice(0, 5);
    const blockedStories = stories.filter((s) => s.status === 'Blocked').slice(0, 3);
    const topRisksRows = [
      ...criticalBugs.map(
        (b) => `<div class="pv-risk-row"><span class="chip risk">${b.severity || 'Bug'}</span> ${esc(b.title)}</div>`,
      ),
      ...blockedStories.map(
        (s) => `<div class="pv-risk-row"><span class="chip warn">Blocked</span> ${esc(s.title)}</div>`,
      ),
    ];
    const topRisks =
      `<div class="pv-widget pv-widget-top-risks">` +
      `<div class="pv-widget-title">Top Risks</div>` +
      (topRisksRows.length ? topRisksRows.join('') : `<div class="pv-widget-empty">No critical risks</div>`) +
      `</div>`;

    // This Week widget — ship count etc. from recentActivity
    const recentActivity = data.recentActivity || [];
    const shipped = recentActivity.filter((a) => /done|merged|fixed/i.test(a.action || '')).length;
    const totals = costs._totals || {};
    const thisWeek =
      `<div class="pv-widget pv-widget-this-week">` +
      `<div class="pv-widget-title">This Week</div>` +
      `<div class="pv-tw-grid">` +
      `<div class="pv-tw-cell"><span class="pv-tw-val">${shipped}</span><span class="pv-tw-lbl">Shipped</span></div>` +
      `<div class="pv-tw-cell"><span class="pv-tw-val">${criticalBugs.length}</span><span class="pv-tw-lbl">Open Critical</span></div>` +
      `<div class="pv-tw-cell"><span class="pv-tw-val">$${(totals.costUsd || 0).toFixed(2)}</span><span class="pv-tw-lbl">AI Spend</span></div>` +
      `</div></div>`;

    // Agent Workload widget — from sdlcStatus if present
    const sdlc = data.sdlcStatus || {};
    const sdlcStories = sdlc.stories || {};
    const agents = sdlc.agents || [];
    const agentRows = agents.map((a) => {
      const count = Object.values(sdlcStories).filter((s) => s.agent === a.name).length;
      return (
        `<div class="pv-aw-row">` +
        `<span class="pv-aw-name">${esc(a.name)}</span>` +
        `<div class="pv-bar-wrap pv-aw-bar"><div class="pv-bar-fill" style="width:${Math.min(count * 10, 100)}%"></div></div>` +
        `<span class="pv-aw-count">${count}</span>` +
        `</div>`
      );
    });
    const agentWorkload =
      `<div class="pv-widget pv-widget-agent-workload">` +
      `<div class="pv-widget-title">Agent Workload</div>` +
      (agentRows.length ? agentRows.join('') : `<div class="pv-widget-empty">No live data</div>`) +
      `</div>`;

    return (
      `<div class="pv-rich-status-widgets">` +
      topRisks +
      thisWeek +
      agentWorkload +
      `</div>` +
      `<style>
  .pv-rich-status-widgets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 12px 0; }
  @media (max-width: 1100px) { .pv-rich-status-widgets { grid-template-columns: 1fr; } }
  .pv-widget { background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius-md, 8px); padding: 16px; }
  .pv-widget-title { font-weight: 700; font-size: 13px; margin-bottom: 10px; }
  .pv-widget-empty { color: var(--text-muted); font-size: 12px; }
  .pv-risk-row { display: flex; align-items: center; gap: 8px; font-size: 12px;
    padding: 4px 0; border-bottom: 1px solid var(--border); }
  .pv-risk-row:last-child { border-bottom: none; }
  .pv-tw-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .pv-tw-cell { display: flex; flex-direction: column; align-items: center; }
  .pv-tw-val  { font-size: 22px; font-weight: 700; }
  .pv-tw-lbl  { font-size: 11px; color: var(--text-muted); }
  .pv-aw-row  { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .pv-aw-name { font-size: 12px; min-width: 80px; }
  .pv-aw-bar  { flex: 1; }
  .pv-aw-count { font-size: 11px; color: var(--text-muted); min-width: 20px; text-align: right; }
  </style>`
    );
  }
  ```

  Call `renderRichStatusWidgets(data)` immediately after the hero card in the Status tab.

- [ ] **Step 4: Run tests — must pass**

  ```bash
  npx jest tests/unit/render-html.test.js -t "US-0139" --no-coverage 2>&1 | tail -20
  ```

  Expected: PASS.

- [ ] **Step 5: Run full suite**

  ```bash
  npx jest --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add tools/lib/render-tabs.js tests/unit/render-html.test.js
  git commit -m "feat: US-0139 — Rich Status Tab: Top Risks, This Week, Agent Workload widgets"
  ```

---

## Track 3 — Agentic Dashboard (US-0142 → US-0145 → US-0144 → US-0146 → US-0143 → US-0147)

---

### Task 11: US-0142 — Active Agent Card Prominence

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing tests**

  Add to `tests/unit/generate-dashboard.test.js`:

  ```js
  describe('US-0142 — Active Agent Prominence', () => {
    test('active agent card has is-active class', () => {
      const activeAgent = { name: 'Pixel', status: 'active', currentTask: 'US-0001', phase: 1 };
      const sdlcStatus = {
        project: { name: 'T' },
        agents: [activeAgent],
        phases: [],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
      };
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML(sdlcStatus);
      expect(html).toContain('is-active');
    });

    test('active agent card uses live-accent left border via CSS variable', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [],
        phases: [],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
      });
      // CSS should wire .is-active to --live-accent
      expect(html).toContain('--live-accent');
      expect(html).toContain('is-active');
    });
  });
  ```

- [ ] **Step 2: Run failing tests**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0142" --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 3: Implement active agent card styling in generate-dashboard.js**

  Find the CSS for agent cards (search for `.agent-card` or similar). Add:

  ```css
  .agent-card.is-active {
    border-left: 3px solid var(--live-accent);
    background: color-mix(in oklab, var(--live-accent) 9%, transparent);
    border: 1px solid var(--live-accent);
  }
  .agent-card.is-active .agent-status-chip {
    background: var(--live-accent);
    color: #fff;
  }
  .live-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
  }
  .agent-card.is-active .live-dot {
    background: var(--live-accent);
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(0.8);
    }
  }
  ```

  In the agent card HTML generator, add the `is-active` class when `agent.status === 'active'`:

  ```js
  const activeClass = agent.status === 'active' ? ' is-active' : '';
  // ... in the card HTML:
  `<div class="agent-card${activeClass}" data-agent="${esc(agent.name)}">`;
  ```

- [ ] **Step 4: Run tests — must pass**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0142" --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
  git commit -m "feat: US-0142 — active agent card prominence with live-accent left border and pulsing dot"
  ```

---

### Task 12: US-0145 — Event Log Terminal (promote to main column)

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing tests**

  Add to `tests/unit/generate-dashboard.test.js`:

  ```js
  describe('US-0145 — Event Log Terminal', () => {
    test('event log is in main column (not sidebar)', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [],
        phases: [],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [{ time: '12:00:00', agent: 'Pixel', message: 'started', tag: 'start' }],
        cycles: [],
      });
      expect(html).toContain('pv-event-log');
      expect(html).toContain('pv-event-log-main');
    });

    test('log rows use HH:MM:SS · AgentName · message format', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [],
        phases: [],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [{ time: '09:15:32', agent: 'Forge', message: 'build complete', tag: 'done' }],
        cycles: [],
      });
      expect(html).toContain('09:15:32');
      expect(html).toContain('Forge');
      expect(html).toContain('build complete');
    });
  });
  ```

- [ ] **Step 2: Run failing tests**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0145" --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 3: Implement Event Log Terminal in generate-dashboard.js**

  Find the existing event/activity log section. Move it out of any sidebar container and into the main content column. Update the CSS to make it full-width:

  ```css
  .pv-event-log-main {
    width: 100%;
    font-family: var(--font-mono, monospace);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    max-height: 320px;
    overflow-y: auto;
  }
  .pv-log-row {
    display: flex;
    gap: 8px;
    font-size: 12px;
    padding: 3px 0;
  }
  .pv-log-time {
    color: var(--text-muted);
    white-space: nowrap;
  }
  .pv-log-agent {
    font-weight: 600;
  }
  .pv-log-row[data-tag='start'] .pv-log-msg {
    color: var(--info);
  }
  .pv-log-row[data-tag='done'] .pv-log-msg {
    color: var(--ok);
  }
  .pv-log-row[data-tag='review'] .pv-log-msg {
    color: var(--warn);
  }
  .pv-log-row[data-tag='block'] .pv-log-msg {
    color: var(--risk);
  }
  .pv-log-row[data-tag='dispatch'] .pv-log-msg {
    color: var(--report-accent);
  }
  ```

  Generate log rows:

  ```js
  function renderEventLog(log) {
    if (!log || log.length === 0) {
      return (
        `<div class="pv-event-log pv-event-log-main">` +
        `<span style="color:var(--text-muted);font-size:12px">Awaiting agent activity&#x2588;</span></div>`
      );
    }
    const rows = log
      .map(
        (e) =>
          `<div class="pv-log-row" data-tag="${esc(e.tag || '')}">` +
          `<span class="pv-log-time">${esc(e.time || '')}</span>` +
          `<span class="pv-log-agent">· ${esc(e.agent || '')} ·</span>` +
          `<span class="pv-log-msg">${esc(e.message || '')}</span>` +
          `</div>`,
      )
      .join('');
    return (
      `<div class="pv-event-log pv-event-log-main" id="event-log-terminal">` +
      rows +
      `</div>` +
      `<script>
  (function() {
    var el = document.getElementById('event-log-terminal');
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    el.addEventListener('pointerenter', function() { el.dataset.paused = '1'; });
    el.addEventListener('pointerleave', function() { delete el.dataset.paused; el.scrollTop = el.scrollHeight; });
  })();
  </script>`
    );
  }
  ```

- [ ] **Step 4: Run tests — must pass**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0145" --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
  git commit -m "feat: US-0145 — promote Event Log Terminal to main column with auto-scroll and hover-pause"
  ```

---

### Task 13: US-0144 — Pipeline Scope Card Redesign

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing tests**

  ```js
  describe('US-0144 — Pipeline Scope Cards', () => {
    test('phase cards show phase number, name, and agent-group label', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [],
        phases: [{ id: 1, name: 'Foundation', agentGroup: 'Forge+Pixel', status: 'active', progress: 40 }],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
      });
      expect(html).toContain('Foundation');
      expect(html).toContain('pv-phase-card');
    });

    test('active phase has accent underline class', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [],
        phases: [{ id: 1, name: 'Foundation', agentGroup: 'Forge', status: 'active', progress: 40 }],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
      });
      expect(html).toContain('pv-phase-active');
    });
  });
  ```

- [ ] **Step 2: Run failing tests**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0144" --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 3: Implement phase cards in generate-dashboard.js**

  Find the phase rendering section. Replace per-agent status/task details with trimmed cards:

  ```js
  function renderPhaseCard(phase) {
    const activeClass = phase.status === 'active' ? ' pv-phase-active' : '';
    const pct = phase.progress || 0;
    return (
      `<div class="pv-phase-card${activeClass}">` +
      `<div class="pv-phase-num">${phase.id}</div>` +
      `<div class="pv-phase-name">${esc(phase.name)}</div>` +
      `<div class="pv-phase-group">${esc(phase.agentGroup || '')}</div>` +
      `<div class="pv-bar-wrap pv-phase-bar"><div class="pv-bar-fill" style="width:${pct}%"></div></div>` +
      `</div>`
    );
  }
  ```

  CSS:

  ```css
  .pv-phase-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  @media (max-width: 1024px) {
    .pv-phase-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .pv-phase-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
  }
  .pv-phase-active {
    border-bottom: 3px solid var(--live-accent);
  }
  .pv-phase-num {
    font-size: 10px;
    color: var(--text-muted);
  }
  .pv-phase-name {
    font-weight: 700;
    font-size: 13px;
    margin: 2px 0;
  }
  .pv-phase-group {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .pv-phase-bar {
    margin-top: 4px;
  }
  ```

- [ ] **Step 4: Run tests and commit**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0144" --no-coverage 2>&1 | tail -20
  git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
  git commit -m "feat: US-0144 — trimmed pipeline phase cards; remove per-agent detail (roster owns that)"
  ```

---

### Task 14: US-0146 — Live Bar

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing test**

  ```js
  describe('US-0146 — Live Bar', () => {
    test('Live Bar is sticky below chrome (top: 52px)', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [],
        phases: [],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
      });
      expect(html).toContain('pv-live-bar');
      expect(html).toContain('top: 52px');
    });

    test('Live Bar is hidden on report mode', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [],
        phases: [],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
      });
      expect(html).toContain('[data-mode="report"] .pv-live-bar');
    });
  });
  ```

- [ ] **Step 2: Run failing test**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0146" --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 3: Implement Live Bar HTML + CSS in generate-dashboard.js**

  Add the Live Bar immediately after the `renderChrome('live', data)` call:

  ```js
  const livebar =
    `<div class="pv-live-bar" id="pv-live-bar" role="status" aria-live="polite">` +
    `<span class="pv-onair-chip">ON AIR</span>` +
    `<span class="pv-live-cycle">CYCLE ${esc(String(sdlcStatus?.cycles?.length ?? 1))}</span>` +
    `<span class="pv-live-elapsed" id="pv-elapsed">0:00</span>` +
    `<span class="pv-live-ticker" id="pv-ticker">&nbsp;</span>` +
    `<span class="pv-live-clock" id="pv-clock">--:--:--</span>` +
    `</div>`;
  ```

  CSS:

  ```css
  .pv-live-bar {
    position: sticky;
    top: 52px;
    height: 48px;
    background: linear-gradient(90deg, color-mix(in oklab, var(--live-accent) 20%, transparent), transparent);
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 16px;
    font-size: 12px;
    z-index: 90;
    border-bottom: 1px solid var(--border);
  }
  [data-mode='report'] .pv-live-bar {
    display: none;
  }
  .pv-onair-chip {
    background: var(--live-accent);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.06em;
  }
  .pv-live-cycle {
    color: var(--text-muted);
    font-size: 11px;
  }
  .pv-live-elapsed {
    color: var(--text-muted);
    font-size: 11px;
  }
  .pv-live-ticker {
    flex: 1;
    color: var(--text);
    font-size: 12px;
  }
  .pv-live-clock {
    color: var(--text-muted);
    font-size: 11px;
    font-family: var(--font-mono);
    margin-left: auto;
  }
  @media (prefers-reduced-motion: reduce) {
    .pv-live-ticker {
      animation: none;
    }
  }
  ```

  Live clock JS (add to inline `<script>` near bottom):

  ```js
  (function () {
    function tick() {
      var el = document.getElementById('pv-clock');
      if (el) {
        var n = new Date();
        el.textContent = n.toLocaleTimeString();
      }
    }
    tick();
    setInterval(tick, 1000);
  })();
  ```

- [ ] **Step 4: Run tests and commit**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0146" --no-coverage 2>&1 | tail -20
  git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
  git commit -m "feat: US-0146 — Live Bar sticky at 52px with ON AIR chip, clock, hidden in report mode"
  ```

---

### Task 15: US-0143 — Conductor Dispatch Hold (3s minimum)

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing test**

  ```js
  describe('US-0143 — Conductor Dispatch Hold', () => {
    test('Conductor card renders dispatch counter', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [{ name: 'Conductor', status: 'active', dispatchCount: 3 }],
        phases: [],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
      });
      expect(html).toContain('pv-dispatch-count');
    });

    test('dispatchHoldMs constant is 3000 in output', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [],
        phases: [],
        stories: {},
        metrics: {
          totalStories: 0,
          storiesDone: 0,
          storiesInProgress: 0,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
      });
      expect(html).toContain('dispatchHoldMs');
      expect(html).toContain('3000');
    });
  });
  ```

- [ ] **Step 2: Run failing test**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0143" --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 3: Implement dispatch hold in generate-dashboard.js**

  In the agent card renderer, for the Conductor agent, add a dispatch counter:

  ```js
  const isCondutor = /conductor/i.test(agent.name);
  const dispatchBlock = isConductor
    ? `<div class="pv-dispatch-count" id="pv-dispatch-count">${agent.dispatchCount || 0} dispatched</div>`
    : '';
  ```

  Add to the inline `<script>`:

  ```js
  var dispatchHoldMs = 3000;
  function conductorDispatch(storyId, agentName) {
    // Mark Conductor as active for dispatchHoldMs
    var conductorCard = document.querySelector('[data-agent="Conductor"]');
    if (conductorCard) {
      conductorCard.classList.add('is-active');
      setTimeout(function () {
        conductorCard.classList.remove('is-active');
      }, dispatchHoldMs);
      var counter = document.getElementById('pv-dispatch-count');
      if (counter) {
        var n = parseInt(counter.textContent) + 1;
        counter.textContent = n + ' dispatched';
        counter.classList.add('pv-dispatch-flash');
        setTimeout(function () {
          counter.classList.remove('pv-dispatch-flash');
        }, 600);
      }
    }
    // Add to event log
    var logEl = document.getElementById('event-log-terminal');
    if (logEl) {
      var row = document.createElement('div');
      row.className = 'pv-log-row';
      row.dataset.tag = 'dispatch';
      row.innerHTML =
        '<span class="pv-log-time">' +
        new Date().toLocaleTimeString() +
        '</span>' +
        '<span class="pv-log-agent">\u00b7 Conductor \u00b7</span>' +
        '<span class="pv-log-msg">Dispatched ' +
        storyId +
        ' \u2192 ' +
        agentName +
        '</span>';
      logEl.appendChild(row);
      if (!logEl.dataset.paused) logEl.scrollTop = logEl.scrollHeight;
    }
  }
  window.conductorDispatch = conductorDispatch;
  ```

- [ ] **Step 4: Run tests and commit**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0143" --no-coverage 2>&1 | tail -20
  git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
  git commit -m "feat: US-0143 — Conductor dispatch hold 3s + dispatch counter + event log wiring"
  ```

---

### Task 16: US-0147 — Agent Workload Live Data

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing tests**

  ```js
  describe('US-0147 — Agent Workload Live Data', () => {
    test('agent workload reads stories from sdlcStatus', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      const html = generateHTML({
        project: { name: 'T' },
        agents: [{ name: 'Pixel', status: 'idle' }],
        phases: [],
        stories: { 'US-0001': { agent: 'Pixel', status: 'in-progress' } },
        metrics: {
          totalStories: 1,
          storiesDone: 0,
          storiesInProgress: 1,
          openBugs: 0,
          bugsFixed: 0,
          aiCostUsd: 0,
          testsPassed: 0,
          testsFailed: 0,
          coveragePct: 0,
        },
        log: [],
        cycles: [],
      });
      expect(html).toContain('pv-workload-bar');
    });

    test('missing sdlcStatus shows empty state, not error', () => {
      const { generateHTML } = require('../../tools/generate-dashboard');
      expect(() =>
        generateHTML({
          project: { name: 'T' },
          agents: [],
          phases: [],
          stories: {},
          metrics: {
            totalStories: 0,
            storiesDone: 0,
            storiesInProgress: 0,
            openBugs: 0,
            bugsFixed: 0,
            aiCostUsd: 0,
            testsPassed: 0,
            testsFailed: 0,
            coveragePct: 0,
          },
          log: [],
          cycles: [],
          sdlcStatus: null,
        }),
      ).not.toThrow();
    });
  });
  ```

- [ ] **Step 2: Run failing tests**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0147" --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 3: Implement Agent Workload section in generate-dashboard.js**

  Add an Agent Workload card section (below the phase grid) in the dashboard HTML. This card reads `data.stories` (keyed by story id, each having `.agent`):

  ```js
  function renderAgentWorkload(agents, stories) {
    if (!agents || agents.length === 0) {
      return `<div class="pv-workload-card"><div class="pv-widget-empty">No live data</div></div>`;
    }
    const rows = agents.map((agent) => {
      const assigned = Object.values(stories || {}).filter((s) => s.agent === agent.name);
      const done = assigned.filter((s) => /done|complete/i.test(s.status || '')).length;
      const inflight = assigned.filter((s) => !/done|complete/i.test(s.status || '')).length;
      const pct = assigned.length > 0 ? Math.round((inflight / assigned.length) * 100) : 0;
      const doneLabel = done > 0 ? ` <span class="pv-workload-done">(${done} done)</span>` : '';
      return (
        `<div class="pv-workload-row">` +
        `<span class="pv-workload-name">${esc(agent.name)}${doneLabel}</span>` +
        `<div class="pv-bar-wrap pv-workload-bar"><div class="pv-bar-fill" style="width:${pct}%"></div></div>` +
        `<span class="pv-workload-count">${inflight}</span>` +
        `</div>`
      );
    });
    return (
      `<div class="pv-workload-card">` + `<div class="pv-widget-title">Agent Workload</div>` + rows.join('') + `</div>`
    );
  }
  ```

  CSS:

  ```css
  .pv-workload-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }
  .pv-workload-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .pv-workload-name {
    min-width: 90px;
    font-size: 12px;
  }
  .pv-workload-done {
    font-size: 10px;
    color: var(--text-muted);
  }
  .pv-workload-bar {
    flex: 1;
  }
  .pv-workload-count {
    font-size: 11px;
    color: var(--text-muted);
    min-width: 20px;
    text-align: right;
  }
  ```

- [ ] **Step 4: Run tests and full suite**

  ```bash
  npx jest tests/unit/generate-dashboard.test.js -t "US-0147" --no-coverage 2>&1 | tail -20
  npx jest --no-coverage 2>&1 | tail -20
  ```

  Expected: all green.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
  git commit -m "feat: US-0147 — Agent Workload live data from sdlcStatus.stories; empty-state fallback"
  ```

---

## Final: Coverage Gate + Integration Smoke Test

- [ ] **Step 1: Run full test suite with coverage**

  ```bash
  npx jest --coverage 2>&1 | tail -30
  ```

  Expected: ≥80% statements (currently ~93%; must not regress). All tests green.

- [ ] **Step 2: Run both generators end-to-end**

  ```bash
  node tools/generate-plan.js && echo "Plan-Status: OK"
  node tools/generate-dashboard.js && echo "Dashboard: OK"
  ```

  Expected: both produce output without errors.

- [ ] **Step 3: Assert shared chrome class names appear in both outputs**

  ```bash
  node -e "
  const { renderHtml } = require('./tools/lib/render-html');
  const data = { epics:[], stories:[], tasks:[], testCases:[], bugs:[], lessons:[],
    costs:{_totals:{costUsd:0,projectedUsd:0}}, atRisk:{}, coverage:{available:false},
    recentActivity:[], generatedAt:new Date().toISOString(), commitSha:'x',
    projectName:'T', tagline:'', risk:{byStory:new Map(),byEpic:new Map()},
    sdlcStatus:null, completion:null };
  const html = renderHtml(data);
  console.assert(html.includes('pv-chrome'), 'plan-status missing pv-chrome');
  console.assert(html.includes('mode-report'), 'plan-status missing mode-report');
  console.log('Plan-Status chrome: OK');
  "
  node -e "
  const { generateHTML } = require('./tools/generate-dashboard');
  const html = generateHTML({ project:{name:'T'}, agents:[], phases:[],
    stories:{}, metrics:{totalStories:0,storiesDone:0,storiesInProgress:0,
      openBugs:0,bugsFixed:0,aiCostUsd:0,testsPassed:0,testsFailed:0,coveragePct:0},
    log:[], cycles:[] });
  console.assert(html.includes('pv-chrome'), 'dashboard missing pv-chrome');
  console.assert(html.includes('mode-live'), 'dashboard missing mode-live');
  console.log('Dashboard chrome: OK');
  "
  ```

- [ ] **Step 4: Open PR to develop**

  ```bash
  git push -u origin feature/EPIC-0020-cross-dashboard-redesign
  gh pr create --title "feat: EPIC-0020 — Cross-Dashboard Redesign" \
    --body "$(cat <<'EOF'
  ## Summary
  - Unified token system in theme.js (palette, chartColors, generateCssTokens, generateDashboardCssTokens)
  - New render-chrome.js shared chrome component (dark neutral #1e293b, REPORT/LIVE badges)
  - AC-0498: zero hex literals in generated HTML for both dashboards
  - Status Hero L/M/S density toggle anchored in verdict section, persists in localStorage
  - Rich Status tab: Top Risks, This Week, Agent Workload widgets
  - Agentic: active agent prominence, Event Log promoted to main column, trimmed Pipeline cards, Live Bar, Conductor dispatch hold, Agent Workload live data

  ## Test plan
  - [ ] `npx jest --coverage` — all green, ≥80% statements
  - [ ] AC-0498 lint rule passes for both generator outputs
  - [ ] Toggle L/M/S density on Status Hero; reload page — density persists
  - [ ] Toggle light/dark theme; reload — theme persists
  - [ ] `node tools/generate-plan.js` + `node tools/generate-dashboard.js` — no errors

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```
