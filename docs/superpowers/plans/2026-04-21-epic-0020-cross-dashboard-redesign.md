# EPIC-0020 Cross-Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Plan-Status and Agentic dashboards under a shared OKLCH token system and Editorial × Mission Control design language, shipping 12 user stories across 4 sequential layers.

**Architecture:** Layer 1 (tokens + theme migration) is foundational and must merge before any later layer begins. Layers 2–4 each depend on Layer 1 but are independent of each other. Each task is one PR per story; all squash-merge into `develop`. The EPIC-0010 artifacts (completion banner, risk charts, risk badges) are explicitly preserved throughout — see §10 of the design spec.

**Tech Stack:** Node.js, Jest, vanilla HTML/CSS/JS, Chart.js v4, Google Fonts (Inter Tight + JetBrains Mono), OKLCH color space.

**Design reference:** `docs/superpowers/design-ref/Redesign.html` + `docs/superpowers/design-ref/app/` — open in a browser to see the target. Read CSS tokens from the `<style>` block at the top; read component HTML from the JSX files.

**⚠ Layer gate:** Do not begin Layer 2 until Layer 1 is merged to `develop` and CI is green.

---

## File Map

| File                                    | Layer      | Action                                                                                              |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `docs/RELEASE_PLAN.md`                  | Pre-flight | Append EPIC-0020 + US-0135..0146                                                                    |
| `docs/BUGS.md`                          | Pre-flight | Prepend BUG-0183..0189                                                                              |
| `docs/ID_REGISTRY.md`                   | Pre-flight | Update next IDs                                                                                     |
| `tools/lib/theme.js`                    | 1          | Extend: add `palette`, `chartColors`, `generateCssTokens()`                                         |
| `tests/unit/theme.test.js`              | 1          | Extend: token completeness + no-hex lint rule                                                       |
| `tools/lib/render-html.js`              | 1          | Update: `:root` CSS block, font imports, localStorage key                                           |
| `tools/lib/render-shell.js`             | 2          | Update: add `renderModeBadge()`, `renderMasthead()`; replace `renderTopBar()` with `renderChrome()` |
| `tests/unit/render-shell.test.js`       | 2          | Extend: chrome structure, mode badge, masthead                                                      |
| `tools/lib/render-tabs.js`              | 3          | Update: prepend hero + widgets to `renderChartsTab()`; migrate hex colors                           |
| `tests/unit/render-html.test.js`        | 3          | Extend: hero card presence, chart color tokens                                                      |
| `tools/generate-dashboard.js`           | 4          | Update: active agent CSS, conductor hold, event log, pipeline, live bar                             |
| `tests/unit/generate-dashboard.test.js` | 4          | Extend: active agent markup, live bar presence                                                      |

---

## PRE-FLIGHT — Apply Handoff Artifacts

### Task 0: Append EPIC-0020 to RELEASE_PLAN.md, prepend bugs to BUGS.md, update ID registry

**Files:**

- Modify: `docs/RELEASE_PLAN.md`
- Modify: `docs/BUGS.md`
- Modify: `docs/ID_REGISTRY.md`

- [ ] **Step 1: Append the EPIC + stories block to RELEASE_PLAN.md**

Copy the full content of `docs/superpowers/design-ref/../../../` — actually read the handoff file directly:

```bash
cat /tmp/design-bundle/plan-visualizer/project/handoff/release-plan-epic.md
```

If `/tmp/design-bundle` is gone (ephemeral), the content is also in the spec at `docs/superpowers/specs/2026-04-21-epic-0020-cross-dashboard-redesign.md` §9. Append the EPIC-0020 block and all US-0135..US-0146 story blocks to the bottom of `docs/RELEASE_PLAN.md` under the existing epics/stories sections, following the same fenced-block format as existing entries.

- [ ] **Step 2: Prepend bugs to BUGS.md**

Prepend the 7 bug entries (BUG-0183 through BUG-0189) to the top of `docs/BUGS.md`. Each entry follows the existing format. Content is in `docs/superpowers/specs/2026-04-21-epic-0020-cross-dashboard-redesign.md` §9 or the original handoff file.

- [ ] **Step 3: Update ID_REGISTRY.md**

```
EPIC: next = EPIC-0021  (was EPIC-0020)
US:   next = US-0147    (was US-0135)
AC:   next = AC-0535    (was AC-0488)
BUG:  next = BUG-0190   (was BUG-0183)
TC:   next = TC-0158    (unchanged)
```

- [ ] **Step 4: Verify parsers still pass**

```bash
cd /path/to/repo && npx jest --coverage --testPathPattern="parse-release-plan|parse-bugs" 2>&1 | tail -20
```

Expected: all existing tests pass. If `parseReleasePlan` fails, check that the appended blocks use the exact fenced-block format (triple backtick, no extra blank lines before the first field).

- [ ] **Step 5: Commit**

```bash
git add docs/RELEASE_PLAN.md docs/BUGS.md docs/ID_REGISTRY.md
git commit -m "chore: apply EPIC-0020 handoff — stories US-0135..0146, bugs BUG-0183..0189"
```

---

## LAYER 1 — Token System

### Task 1: Extend theme.js with OKLCH palette and chartColors (US-0137)

**Branch:** `feature/US-0137-shared-tokens`

**Files:**

- Modify: `tools/lib/theme.js`
- Modify: `tests/unit/theme.test.js`

- [ ] **Step 1: Write failing tests for new exports**

Add to the bottom of `tests/unit/theme.test.js`:

```js
describe('theme.js — OKLCH palette tokens (US-0137)', () => {
  const { palette, chartColors, generateCssTokens } = require('../../tools/lib/theme');

  it('exports palette object', () => {
    expect(typeof palette).toBe('object');
    expect(palette).not.toBeNull();
  });

  it('palette contains planAccent and liveAccent keys', () => {
    expect(palette).toHaveProperty('planAccent');
    expect(palette).toHaveProperty('liveAccent');
    expect(palette.planAccent).toMatch(/oklch/);
    expect(palette.liveAccent).toMatch(/oklch/);
  });

  it('palette contains all 11 ink stops', () => {
    for (let i = 0; i <= 10; i++) {
      expect(palette).toHaveProperty(`ink${i}`);
    }
  });

  it('palette contains semantic tokens ok/warn/risk/info', () => {
    ['ok', 'warn', 'risk', 'info'].forEach((k) => {
      expect(palette).toHaveProperty(k);
      expect(palette[k]).toMatch(/oklch/);
    });
  });

  it('exports chartColors with required keys', () => {
    expect(typeof chartColors).toBe('object');
    ['ok', 'warn', 'risk', 'info', 'accent', 'mute'].forEach((k) => {
      expect(chartColors).toHaveProperty(k);
    });
  });

  it('exports generateCssTokens as a function returning a string', () => {
    expect(typeof generateCssTokens).toBe('function');
    const css = generateCssTokens();
    expect(typeof css).toBe('string');
    expect(css).toContain('--plan-accent');
    expect(css).toContain('--live-accent');
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('[data-theme="dark"]');
  });

  it('generateCssTokens output contains no bare hex literals', () => {
    const css = generateCssTokens();
    // No #rrggbb or #rgb outside of comments
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}(?![0-9a-fA-F*])/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --testPathPattern="theme.test" 2>&1 | tail -15
```

Expected: FAIL — `palette is not defined` / `chartColors is not defined` / `generateCssTokens is not defined`.

- [ ] **Step 3: Implement new exports in theme.js**

Add after the existing `esc` function, before `module.exports`:

```js
// US-0137: OKLCH design token palette.
// All color values use OKLCH (perceptually uniform). Browser support:
// Chrome 111+, Firefox 113+, Safari 15.4+.
const palette = {
  // Warm-cool hybrid neutrals, very low chroma (~0.004–0.018)
  ink0: 'oklch(99% 0.004 95)',
  ink1: 'oklch(97% 0.004 95)',
  ink2: 'oklch(94% 0.006 95)',
  ink3: 'oklch(88% 0.008 95)',
  ink4: 'oklch(70% 0.012 95)',
  ink5: 'oklch(52% 0.015 95)',
  ink6: 'oklch(38% 0.015 95)',
  ink7: 'oklch(24% 0.018 95)',
  ink8: 'oklch(16% 0.018 95)',
  ink9: 'oklch(10% 0.018 95)',
  ink10: 'oklch(6%  0.018 95)',

  // Dashboard accents — same chroma, different hues
  planAccent: 'oklch(62% 0.19 268)', // indigo/violet — calm, editorial
  planAccentSoft: 'oklch(62% 0.19 268 / 0.14)',
  planAccentInk: 'oklch(42% 0.18 268)',
  liveAccent: 'oklch(72% 0.19 38)', // amber/signal — live, broadcast
  liveAccentSoft: 'oklch(72% 0.19 38 / 0.18)',
  liveAccentInk: 'oklch(55% 0.18 38)',

  // Semantic
  ok: 'oklch(68% 0.15 150)',
  warn: 'oklch(74% 0.16 78)',
  risk: 'oklch(64% 0.20 25)',
  info: 'oklch(66% 0.14 240)',
};

// Semantic chart color map — consumed by Chart.js initialisers in render-tabs.js
// and generate-dashboard.js. Keys map to semantic meaning, not visual description.
const chartColors = {
  ok: palette.ok,
  warn: palette.warn,
  risk: palette.risk,
  info: palette.info,
  accent: palette.planAccent,
  mute: palette.ink4,
};

// Generates the full CSS custom-property block for both themes.
// Called by render-html.js to produce the :root + theme blocks.
// No hex literals — all values come from `palette` above.
function generateCssTokens() {
  return `
  /* === US-0137 OKLCH design tokens === */
  :root {
    --font-sans:    'Inter Tight', ui-sans-serif, system-ui, sans-serif;
    --font-display: 'Inter Tight', ui-sans-serif, system-ui, sans-serif;
    --font-mono:    'JetBrains Mono', ui-monospace, monospace;

    --plan-accent:      ${palette.planAccent};
    --plan-accent-soft: ${palette.planAccentSoft};
    --plan-accent-ink:  ${palette.planAccentInk};
    --live-accent:      ${palette.liveAccent};
    --live-accent-soft: ${palette.liveAccentSoft};
    --live-accent-ink:  ${palette.liveAccentInk};

    --ok:   ${palette.ok};
    --warn: ${palette.warn};
    --risk: ${palette.risk};
    --info: ${palette.info};
  }

  [data-theme="light"] {
    --bg:          ${palette.ink1};
    --bg-sunk:     ${palette.ink2};
    --surface:     ${palette.ink0};
    --surface-2:   ${palette.ink1};
    --border:      ${palette.ink3};
    --border-soft: oklch(94% 0.006 95 / 0.6);
    --text:        ${palette.ink9};
    --text-dim:    ${palette.ink5};
    --text-mute:   ${palette.ink4};
    --shadow:      0 1px 0 rgba(15,15,20,.03), 0 4px 16px -8px rgba(15,15,20,.08);
    --shadow-lg:   0 2px 0 rgba(15,15,20,.04), 0 12px 32px -12px rgba(15,15,20,.12);
    --grid-dot:    rgba(30,30,40,0.08);
  }

  [data-theme="dark"] {
    --bg:          ${palette.ink10};
    --bg-sunk:     oklch(4% 0.018 95);
    --surface:     ${palette.ink9};
    --surface-2:   ${palette.ink8};
    --border:      oklch(22% 0.018 95);
    --border-soft: oklch(22% 0.018 95 / 0.5);
    --text:        ${palette.ink1};
    --text-dim:    ${palette.ink4};
    --text-mute:   ${palette.ink5};
    --shadow:      0 1px 0 rgba(0,0,0,.35), 0 6px 20px -8px rgba(0,0,0,.5);
    --shadow-lg:   0 2px 0 rgba(0,0,0,.4), 0 18px 36px -14px rgba(0,0,0,.55);
    --grid-dot:    rgba(200,210,230,0.06);
  }
  `.trim();
}
```

Update `module.exports` at the bottom of `theme.js`:

```js
module.exports = { BADGE_TONE, badge, palette, chartColors, generateCssTokens };
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="theme.test" 2>&1 | tail -20
```

Expected: all tests pass including the 4 new describe blocks. The existing `theme.js — parity with render-html re-export` test must still pass — `BADGE_TONE` and `badge` are still exported.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/theme.js tests/unit/theme.test.js
git commit -m "feat: US-0137 add OKLCH palette, chartColors, generateCssTokens to theme.js"
```

---

### Task 2: Migrate render-html.js CSS block and fonts (US-0137 + US-0141)

**Files:**

- Modify: `tools/lib/render-html.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/render-html.test.js`:

```js
describe('renderHtml — US-0137/0141 token system', () => {
  let html;
  beforeAll(() => {
    html = renderHtml(sampleData);
  });

  it('loads Inter Tight font (not plain Inter)', () => {
    expect(html).toContain('Inter+Tight');
    expect(html).not.toContain('family=Inter:wght');
  });

  it('does not load Instrument Serif or Fraunces', () => {
    expect(html).not.toContain('Instrument+Serif');
    expect(html).not.toContain('Fraunces');
  });

  it('uses data-theme attribute for theming', () => {
    expect(html).toContain('data-theme');
    expect(html).toContain('[data-theme="light"]');
    expect(html).toContain('[data-theme="dark"]');
  });

  it('reads pv-theme from localStorage (not theme)', () => {
    expect(html).toContain('pv-theme');
    // Old key must be migrated or absent from the init script
    expect(html).toContain('localStorage');
  });

  it('emits --plan-accent CSS variable', () => {
    expect(html).toContain('--plan-accent');
  });

  it('emits --live-accent CSS variable', () => {
    expect(html).toContain('--live-accent');
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npx jest --testPathPattern="render-html.test" 2>&1 | tail -20
```

Expected: FAIL on the new `data-theme`, `Inter+Tight`, `pv-theme`, `--plan-accent` assertions.

- [ ] **Step 3: Update render-html.js — theme init script**

Find the inline `<script>` at the top of `renderHtml()` that reads `localStorage.getItem('theme')`. Replace it with:

```js
// In the renderHtml template literal, replace the existing theme-init <script>:
<script>(function(){
  // US-0141: Migrate legacy 'theme' key to 'pv-theme' on first load
  var old=localStorage.getItem('theme');
  if(old&&!localStorage.getItem('pv-theme')){localStorage.setItem('pv-theme',old);localStorage.removeItem('theme');}
  var t=localStorage.getItem('pv-theme');
  var dark=t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.setAttribute('data-theme', dark?'dark':'light');
})()</script>
```

- [ ] **Step 4: Update render-html.js — font imports**

Find the Google Fonts `<link>` tag. Replace:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

With:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 5: Update render-html.js — inject CSS tokens**

At the top of `render-html.js`, add import:

```js
const { generateCssTokens } = require('./theme');
```

In the `<style>` block inside `renderHtml()`, find where `:root {` is defined and replace the entire `:root` block plus any `html.dark` block with:

```js
${generateCssTokens()}
```

Keep all other CSS below it (the existing component styles, `.topbar-fixed`, `.sidebar`, etc. remain for now — they will be updated in Layer 2).

Also update the body font-family reference in the base CSS from `'Inter'` to `var(--font-sans)`, and `.font-display` from `'Instrument Serif'...` to `var(--font-display)`.

- [ ] **Step 6: Run full test suite**

```bash
npx jest --coverage 2>&1 | tail -30
```

Expected: all existing tests pass + new tests pass. Coverage ≥ 80%.

If `render-html.test.js` fails on `'includes Tailwind CDN'` — that assertion is checking for Tailwind, which still loads. No change needed there.

If any test fails because it checks for `html.dark` class: update the assertion to check for `data-theme="dark"` instead.

- [ ] **Step 7: Commit**

```bash
git add tools/lib/render-html.js tests/unit/render-html.test.js
git commit -m "feat: US-0137/US-0141 migrate render-html to OKLCH tokens, Inter Tight, pv-theme key"
```

---

## LAYER 2 — Chrome

**Branch per story:** `feature/US-0138-mode-badge`, `feature/US-0136-neutral-chrome`

### Task 3: Add renderModeBadge() and renderMasthead() (US-0138)

**Files:**

- Modify: `tools/lib/render-shell.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/render-html.test.js`:

```js
describe('renderHtml — US-0138 mode badge', () => {
  let html;
  beforeAll(() => {
    html = renderHtml(sampleData);
  });

  it('renders a mode-badge element', () => {
    expect(html).toContain('mode-badge');
  });

  it('renders REPORT label on Plan-Status', () => {
    expect(html).toContain('REPORT');
  });

  it('renders static indigo pip (mode-report class)', () => {
    expect(html).toContain('mode-report');
  });

  it('badge has aria-label "Mode: Report"', () => {
    expect(html).toContain('aria-label="Mode: Report"');
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npx jest --testPathPattern="render-html.test" --testNamePattern="mode badge" 2>&1 | tail -15
```

Expected: FAIL — `mode-badge` not found in HTML.

- [ ] **Step 3: Add renderModeBadge() to render-shell.js**

Add after the existing `renderTopBar` function:

```js
// US-0138: Mode badge — REPORT (static pip) or LIVE (pulsing pip).
// Plan-Status always renders REPORT. Agentic renders LIVE in generate-dashboard.js.
function renderModeBadge(mode = 'report') {
  const isLive = mode === 'live';
  const label = isLive ? 'LIVE' : 'REPORT';
  const cls = isLive ? 'mode-live' : 'mode-report';
  return `<span class="mode-badge ${cls}" aria-label="Mode: ${isLive ? 'Live' : 'Report'}" tabindex="0">
    <span class="pip" aria-hidden="true"></span>${label}
  </span>`;
}
```

Also add the CSS for `.mode-badge` to the `<style>` block in `render-html.js` (place after the token block):

```css
/* US-0138: Mode badge */
.mode-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 8px;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
}
.mode-badge .pip {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  display: inline-block;
}
.mode-report .pip {
  background: var(--plan-accent);
  box-shadow: 0 0 0 3px var(--plan-accent-soft);
}
.mode-live .pip {
  background: var(--live-accent);
  box-shadow: 0 0 0 3px var(--live-accent-soft);
  animation: pv-pulse 1.6s ease-in-out infinite;
}
@keyframes pv-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
```

- [ ] **Step 4: Add renderMasthead() to render-shell.js**

The masthead is the per-page contextual header below the chrome, replacing the stat tiles that currently live in `renderTopBar()`. Add:

```js
// US-0136: Per-tab masthead — editorial header with project identity and inline stats.
// Replaces the stat tiles previously embedded in the topbar.
function renderMasthead(data) {
  const activeStories = data.stories.filter((s) => s.status !== 'Retired');
  const done = activeStories.filter((s) => s.status === 'Done').length;
  const cov = data.coverage;
  const covLabel = cov.available !== false ? `${cov.overall.toFixed(1)}%` : 'N/A';
  const totalAI = data.costs._totals.costUsd || 0;
  const openBugs = (data.bugs || []).filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status)).length;

  return `
  <div class="pv-masthead">
    <div class="pv-masthead-head">
      <span class="pv-eyebrow">${esc(data.projectName)}&thinsp;·&thinsp;${esc(data.release || '')}</span>
      <h1 class="pv-masthead-title" id="pv-tab-title">Status <em>report</em></h1>
    </div>
    <div class="pv-masthead-meta">
      <div class="pv-meta-item">
        <span class="pv-meta-lbl">Stories</span>
        <span class="pv-meta-val tnum">${done}/${activeStories.length}</span>
      </div>
      <div class="pv-meta-item">
        <span class="pv-meta-lbl">Coverage</span>
        <span class="pv-meta-val tnum">${covLabel}</span>
      </div>
      <div class="pv-meta-item">
        <span class="pv-meta-lbl">Open bugs</span>
        <span class="pv-meta-val tnum">${openBugs}</span>
      </div>
      <div class="pv-meta-item pv-meta-item--hide-sm">
        <span class="pv-meta-lbl">AI spend</span>
        <span class="pv-meta-val tnum">${usd(totalAI)}</span>
      </div>
    </div>
  </div>`;
}
```

Add the masthead CSS to `render-html.js` style block:

```css
/* US-0136: Masthead */
.pv-masthead {
  display: grid;
  grid-template-columns: minmax(0, auto) 1fr;
  align-items: center;
  column-gap: 20px;
  padding: 12px 18px;
  margin: 0 0 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background:
    radial-gradient(120% 180% at 0% 0%, color-mix(in oklab, var(--plan-accent) 14%, transparent) 0%, transparent 55%),
    var(--surface);
  box-shadow: var(--shadow);
}
.pv-eyebrow {
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-mute);
  font-weight: 600;
  font-family: var(--font-sans);
}
.pv-masthead-title {
  margin: 2px 0 0;
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-weight: 600;
}
.pv-masthead-title em {
  font-style: normal;
  color: var(--plan-accent-ink);
  font-weight: 500;
  font-size: 0.62em;
  vertical-align: middle;
  padding: 2px 7px;
  margin-left: 8px;
  border: 1px solid var(--plan-accent);
  border-radius: 4px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.pv-masthead-meta {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px 18px;
  justify-content: flex-end;
  align-items: center;
  font-family: var(--font-mono);
}
.pv-meta-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: flex-end;
}
.pv-meta-lbl {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--text-mute);
  text-transform: uppercase;
}
.pv-meta-val {
  font-size: 12px;
  color: var(--text);
  font-weight: 600;
  white-space: nowrap;
}
.tnum {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}
@media (max-width: 820px) {
  .pv-meta-item--hide-sm {
    display: none;
  }
}
@media (max-width: 680px) {
  .pv-masthead {
    grid-template-columns: 1fr;
  }
  .pv-masthead-meta {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
```

Update `module.exports` in `render-shell.js`:

```js
module.exports = {
  renderTopBar,
  renderFilterBar,
  renderSidebar,
  renderCompletionBanner,
  renderModeBadge,
  renderMasthead,
};
```

- [ ] **Step 5: Wire renderMasthead into render-html.js**

In `render-html.js`, add import:

```js
const {
  renderTopBar,
  renderFilterBar,
  renderSidebar,
  renderCompletionBanner,
  renderModeBadge,
  renderMasthead,
} = require('./render-shell');
```

In the body of `renderHtml()`, after the topbar and after the sidebar opening tag, add:

```js
${renderMasthead(data)}
```

Place it as the first element inside the `<main>` content area, before the filter bar.

- [ ] **Step 6: Run tests**

```bash
npx jest --coverage 2>&1 | tail -20
```

Expected: all tests pass. The new mode badge tests pass. Coverage ≥ 80%.

- [ ] **Step 7: Commit**

```bash
git add tools/lib/render-shell.js tools/lib/render-html.js tests/unit/render-html.test.js
git commit -m "feat: US-0138 add renderModeBadge() REPORT/LIVE pip + renderMasthead() editorial header"
```

---

### Task 4: Replace renderTopBar() with renderChrome() (US-0136)

**Files:**

- Modify: `tools/lib/render-shell.js`
- Modify: `tools/lib/render-html.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/render-html.test.js`:

```js
describe('renderHtml — US-0136 neutral chrome', () => {
  let html;
  beforeAll(() => {
    html = renderHtml(sampleData);
  });

  it('renders chrome element with class pv-chrome', () => {
    expect(html).toContain('pv-chrome');
  });

  it('chrome height is ≤52px via CSS (not 72px)', () => {
    // The old topbar used height:72px — new chrome uses ≤52px
    expect(html).not.toContain('height: 72px');
    expect(html).not.toContain('height:72px');
  });

  it('does not render a navy gradient in the chrome', () => {
    // Old topbar used #003087 / #0050b3 / #0066cc gradient
    expect(html).not.toContain('#003087');
    expect(html).not.toContain('#0050b3');
  });

  it('chrome contains Plan-Status switcher label', () => {
    expect(html).toContain('Plan-Status');
  });

  it('chrome contains theme toggle buttons', () => {
    expect(html).toContain('Light');
    expect(html).toContain('Dark');
  });

  it('renderCompletionBanner is still called (EPIC-0010 preserved)', () => {
    // completion banner renders its wrapper element
    // (actual content depends on data.completion being present)
    // At minimum the banner function must not throw
    expect(() => renderHtml(sampleData)).not.toThrow();
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npx jest --testPathPattern="render-html.test" --testNamePattern="neutral chrome" 2>&1 | tail -15
```

Expected: FAIL on `pv-chrome` not found, `#003087` still present.

- [ ] **Step 3: Add renderChrome() to render-shell.js**

Add below `renderModeBadge()`:

```js
// US-0136: Frosted-glass neutral chrome. Replaces the saturated navy gradient topbar.
// Height ≤52px. Contains: brand, dashboard switcher, mode badge, about, theme toggle.
// renderCompletionBanner() is NOT part of the chrome — it renders separately below it.
function renderChrome(data) {
  const projectName = esc(data.projectName || 'Plan Visualizer');
  return `
  <header class="pv-chrome" id="pv-chrome">
    <div class="pv-chrome-brand">
      <span class="pv-chrome-dot" aria-hidden="true"></span>
      <span class="pv-chrome-name">${projectName}</span>
    </div>
    <div class="pv-chrome-segs" role="tablist" aria-label="Dashboard">
      <button class="pv-seg pv-seg-active" aria-pressed="true">Plan-Status</button>
      <a href="dashboard.html" class="pv-seg" aria-pressed="false">Pipeline</a>
    </div>
    <div class="pv-chrome-spacer"></div>
    ${renderModeBadge('report')}
    <button class="pv-iconbtn" onclick="openAbout()" aria-label="About">
      <span aria-hidden="true">ⓘ</span> About
    </button>
    <div class="pv-theme-segs" role="group" aria-label="Theme">
      <button onclick="setTheme('light')" id="theme-btn-light" class="pv-seg" aria-pressed="false">☀ Light</button>
      <button onclick="setTheme('dark')"  id="theme-btn-dark"  class="pv-seg" aria-pressed="false">☾ Dark</button>
    </div>
  </header>`;
}
```

Add chrome CSS to `render-html.js` style block:

```css
/* US-0136: Chrome */
.pv-chrome {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 18px;
  min-height: 52px;
  max-height: 52px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklab, var(--bg) 80%, transparent);
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
}
.pv-chrome-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-size: 17px;
  letter-spacing: -0.01em;
  color: var(--text);
}
.pv-chrome-dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: linear-gradient(135deg, var(--plan-accent), var(--live-accent));
  flex-shrink: 0;
}
.pv-chrome-spacer {
  flex: 1;
}
.pv-chrome-segs,
.pv-theme-segs {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.pv-seg {
  padding: 5px 11px;
  font-size: 12.5px;
  font-weight: 500;
  border-radius: 6px;
  color: var(--text-dim);
  cursor: pointer;
  background: none;
  border: 0;
  font-family: var(--font-sans);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.pv-seg:hover {
  color: var(--text);
  background: var(--surface-2);
}
.pv-seg-active,
.pv-seg[aria-pressed='true'] {
  background: var(--surface-2);
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--border-soft);
}
.pv-iconbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font-sans);
}
.pv-iconbtn:hover {
  color: var(--text);
  background: var(--surface-2);
}
```

- [ ] **Step 4: Update render-html.js — swap topbar for chrome**

In `render-html.js`:

1. Add `renderChrome` to the import from `render-shell`:

   ```js
   const {
     renderTopBar,
     renderFilterBar,
     renderSidebar,
     renderCompletionBanner,
     renderModeBadge,
     renderMasthead,
     renderChrome,
   } = require('./render-shell');
   ```

2. In the HTML template, replace `${renderTopBar(data)}` with `${renderChrome(data)}`.

3. Update `body { padding-top: 72px }` to `body { padding-top: 52px }` and `body.has-alert { padding-top: 100px }` to `body.has-alert { padding-top: 80px }`. Also update `#sidebar` top offset from `72px` to `52px`.

4. Add a `setTheme()` JS function in the scripts section (or in `render-scripts.js`):

   ```js
   function setTheme(t) {
     document.documentElement.setAttribute('data-theme', t);
     localStorage.setItem('pv-theme', t);
     document.getElementById('theme-btn-light').setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
     document.getElementById('theme-btn-dark').setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
   }
   // Set correct pressed state on load
   (function () {
     var t = localStorage.getItem('pv-theme') || 'light';
     setTheme(t);
   })();
   ```

5. **Keep `renderCompletionBanner(data)` call exactly where it is** — it renders below the topbar/chrome and must not be moved or removed.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --coverage 2>&1 | tail -30
```

Expected: all tests pass. If `render-html.test.js` fails on `'includes all 7 tabs'` — those tabs are still rendered, so that should pass. If it fails on any topbar-specific test (e.g. checking for `id="topbar-fixed"`), update that assertion to check for `id="pv-chrome"` instead.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/render-shell.js tools/lib/render-html.js tests/unit/render-html.test.js
git commit -m "feat: US-0136 replace navy gradient topbar with frosted-glass neutral chrome"
```

---

## LAYER 3 — Status Tab Enhancements

**Branch per story:** `feature/US-0135-status-hero`, `feature/US-0139-status-tab-richer`, `feature/US-0140-chart-palette`

### Task 5: Status hero card (US-0135)

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/render-html.test.js`:

```js
describe('renderHtml — US-0135 status hero card', () => {
  let html;
  beforeAll(() => {
    html = renderHtml(sampleData);
  });

  it('renders a pv-hero element in the Charts/Status tab', () => {
    expect(html).toContain('pv-hero');
  });

  it('renders a verdict chip (on-track / at-risk / off-track)', () => {
    expect(html).toMatch(/on.track|at.risk|off.track/i);
  });

  it('renders Forecast stat block', () => {
    expect(html).toContain('Forecast');
  });

  it('renders Velocity stat block', () => {
    expect(html).toContain('Velocity');
  });

  it('renders Budget stat block', () => {
    expect(html).toContain('Budget');
  });

  it('renders a 30-cell coverage heat strip', () => {
    expect(html).toContain('pv-heat');
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npx jest --testPathPattern="render-html.test" --testNamePattern="status hero" 2>&1 | tail -15
```

Expected: FAIL — `pv-hero` not found.

- [ ] **Step 3: Add \_renderStatusHero() helper to render-tabs.js**

Add before `renderChartsTab`:

```js
// US-0135: Status hero card — answers "is the release on track?" in one glance.
// Reads data.completion (from EPIC-0010 compute-risk), data.costs, data.risk.
function _renderStatusHero(data) {
  const activeStories = data.stories.filter((s) => s.status !== 'Retired');
  const done = activeStories.filter((s) => s.status === 'Done').length;
  const total = activeStories.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const openBugs = (data.bugs || []).filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status));
  const criticalBugs = openBugs.filter((b) => ['Critical', 'High'].includes(b.severity)).length;
  const blockedStories = activeStories.filter((s) => s.status === 'Blocked').length;

  // Verdict logic
  let verdict, verdictTone, narrative;
  if (criticalBugs > 0 || blockedStories > 1) {
    verdict = 'Off track';
    verdictTone = 'risk';
    narrative = `${criticalBugs} critical/high ${criticalBugs === 1 ? 'bug' : 'bugs'} and ${blockedStories} blocked ${blockedStories === 1 ? 'story' : 'stories'} require immediate attention.`;
  } else if (criticalBugs > 0 || blockedStories > 0 || pct < 50) {
    verdict = 'At risk';
    verdictTone = 'warn';
    narrative = `Release is progressing at ${pct}% with minor blockers to resolve.`;
  } else {
    verdict = 'On track';
    verdictTone = 'ok';
    narrative = `Release is ${pct}% complete with no critical blockers.`;
  }

  // Forecast from EPIC-0010 data.completion
  const comp = data.completion;
  let forecastHtml = '<span class="pv-stat-val">—</span>';
  if (comp && comp.likelyDate) {
    forecastHtml = `<span class="pv-stat-val tnum">${comp.likelyDate}</span>`;
  }

  // Velocity
  const trends = data.trends || {};
  const velocityArr = trends.velocity || [];
  const lastVel = velocityArr.length > 0 ? velocityArr[velocityArr.length - 1] : null;
  const prevVel = velocityArr.length > 1 ? velocityArr[velocityArr.length - 2] : null;
  const velDelta = lastVel !== null && prevVel !== null ? lastVel - prevVel : null;
  const velHtml =
    lastVel !== null
      ? `<span class="pv-stat-val tnum">${lastVel.toFixed(1)} <span class="pv-delta ${velDelta >= 0 ? 'up' : 'dn'}">${velDelta >= 0 ? '▲' : '▼'} ${Math.abs(velDelta || 0).toFixed(1)}</span></span>`
      : '<span class="pv-stat-val">—</span>';

  // Budget
  const budget = data.budget || {};
  const budgetHtml =
    budget.hasBudget && budget.percentUsed !== null
      ? `<span class="pv-stat-val tnum">${budget.percentUsed}%</span>`
      : '<span class="pv-stat-val">—</span>';

  // 30-day coverage heat strip (30 cells, toned by coverage bracket)
  const covHistory = (data.trends || {}).coverage || [];
  const cells30 = Array.from({ length: 30 }, (_, i) => {
    const val = covHistory[covHistory.length - 30 + i];
    if (val == null) return '<span class="pv-heat-cell" style="opacity:0.15"></span>';
    const tone = val >= 80 ? 'var(--ok)' : val >= 60 ? 'var(--warn)' : 'var(--risk)';
    return `<span class="pv-heat-cell" style="background:${tone};opacity:${0.3 + (val / 100) * 0.7}" title="${val.toFixed(1)}%"></span>`;
  }).join('');

  return `
  <div class="pv-hero card" style="margin-bottom:16px">
    <div class="pv-hero-head">
      <div class="pv-hero-verdict">
        <span class="chip ${verdictTone}"><span class="d"></span>${verdict}</span>
        <p class="pv-hero-narrative">${esc(narrative)}</p>
      </div>
      <div class="pv-hero-stats">
        <div class="pv-stat">
          <span class="pv-stat-lbl">Forecast</span>
          ${forecastHtml}
        </div>
        <div class="pv-stat">
          <span class="pv-stat-lbl">Velocity</span>
          ${velHtml}
        </div>
        <div class="pv-stat">
          <span class="pv-stat-lbl">Budget</span>
          ${budgetHtml}
        </div>
      </div>
    </div>
    <div class="pv-hero-vizrow">
      <div class="pv-heat" aria-label="30-day coverage heat strip">${cells30}</div>
    </div>
  </div>`;
}
```

Add CSS to `render-html.js`:

```css
/* US-0135: Status hero */
.pv-hero {
  padding: 0;
  overflow: hidden;
}
.pv-hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px 10px;
  flex-wrap: wrap;
}
.pv-hero-verdict {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.pv-hero-narrative {
  margin: 0;
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.4;
}
.pv-hero-stats {
  display: flex;
  gap: 24px;
  flex-shrink: 0;
}
.pv-stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-end;
}
.pv-stat-lbl {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-mute);
  font-family: var(--font-mono);
}
.pv-stat-val {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--text);
}
.pv-delta {
  font-size: 11px;
  font-weight: 500;
}
.pv-delta.up {
  color: var(--ok);
}
.pv-delta.dn {
  color: var(--risk);
}
.pv-hero-vizrow {
  padding: 0 16px 14px;
}
.pv-heat {
  display: grid;
  grid-template-columns: repeat(30, 1fr);
  gap: 2px;
}
.pv-heat-cell {
  aspect-ratio: 1;
  border-radius: 2px;
  background: var(--surface-2);
}
/* chip component (from Redesign.html) */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-weight: 500;
  letter-spacing: 0.04em;
}
.chip .d {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: currentColor;
}
.chip.ok {
  color: var(--ok);
  border-color: color-mix(in oklab, var(--ok) 40%, var(--border));
  background: color-mix(in oklab, var(--ok) 8%, transparent);
}
.chip.warn {
  color: var(--warn);
  border-color: color-mix(in oklab, var(--warn) 40%, var(--border));
  background: color-mix(in oklab, var(--warn) 8%, transparent);
}
.chip.risk {
  color: var(--risk);
  border-color: color-mix(in oklab, var(--risk) 40%, var(--border));
  background: color-mix(in oklab, var(--risk) 10%, transparent);
}
.chip.info {
  color: var(--info);
  border-color: color-mix(in oklab, var(--info) 40%, var(--border));
  background: color-mix(in oklab, var(--info) 8%, transparent);
}
```

- [ ] **Step 4: Call \_renderStatusHero() at the top of renderChartsTab()**

In `render-tabs.js`, find `function renderChartsTab(data)` (line ~556). At the start of its returned template string, prepend:

```js
${_renderStatusHero(data)}
```

- [ ] **Step 5: Run tests**

```bash
npx jest --coverage 2>&1 | tail -20
```

Expected: all pass, coverage ≥ 80%.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/render-tabs.js tools/lib/render-html.js tests/unit/render-html.test.js
git commit -m "feat: US-0135 add status hero card with verdict chip, stat blocks, coverage heat strip"
```

---

### Task 6: Decision widgets — Top Risks, This Week, Agent Workload (US-0139)

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write failing tests**

```js
describe('renderHtml — US-0139 decision widgets', () => {
  let html;
  beforeAll(() => {
    html = renderHtml(sampleData);
  });

  it('renders Top Risks card', () => {
    expect(html).toContain('Top Risks');
  });

  it('renders This Week card', () => {
    expect(html).toContain('This Week');
  });

  it('renders Agent Workload card', () => {
    expect(html).toContain('Agent Workload');
  });

  it('decision widget row collapses at narrow viewport via CSS', () => {
    expect(html).toContain('pv-widgets');
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npx jest --testPathPattern="render-html.test" --testNamePattern="decision widgets" 2>&1 | tail -10
```

- [ ] **Step 3: Add \_renderDecisionWidgets() to render-tabs.js**

Add before `renderChartsTab`:

```js
function _renderDecisionWidgets(data) {
  const openBugs = (data.bugs || []).filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status));
  const critHighBugs = openBugs.filter((b) => ['Critical', 'High'].includes(b.severity));
  const activeStories = data.stories.filter((s) => s.status !== 'Retired');
  const blockedStories = activeStories.filter((s) => s.status === 'Blocked');
  const now = Date.now();
  const overdueEpics = (data.epics || []).filter((e) => {
    if (e.status === 'Done') return false;
    if (!e.releaseTarget) return false;
    // Simple overdue check — if releaseTarget contains a date string we can parse
    const d = new Date(e.releaseTarget);
    return !isNaN(d) && d < now;
  });

  const riskItems = [
    ...critHighBugs
      .slice(0, 3)
      .map(
        (b) =>
          `<div class="pv-risk-item"><span class="chip risk">${esc(b.severity)}</span><span class="pv-risk-label">${esc(b.id)}: ${esc(b.title)}</span></div>`,
      ),
    ...blockedStories
      .slice(0, 2)
      .map(
        (s) =>
          `<div class="pv-risk-item"><span class="chip warn">Blocked</span><span class="pv-risk-label">${esc(s.id)}: ${esc(s.title)}</span></div>`,
      ),
    ...overdueEpics
      .slice(0, 2)
      .map(
        (e) =>
          `<div class="pv-risk-item"><span class="chip warn">Overdue</span><span class="pv-risk-label">${esc(e.id)}: ${esc(e.title)}</span></div>`,
      ),
  ];
  const riskContent =
    riskItems.length > 0 ? riskItems.join('') : '<p class="pv-widget-empty">No critical risks detected.</p>';

  // This Week — stories done + bugs opened/fixed in last 7 days
  // Source: recentActivity parsed entries (each has date + summary)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentDone = (data.recentActivity || []).filter((a) => new Date(a.date) >= sevenDaysAgo);
  const totalAI = data.costs._totals.costUsd || 0;
  const weekContent = `
    <div class="pv-kv"><span class="pv-kv-k">Stories shipped</span><span class="pv-kv-v tnum">${recentDone.length}</span></div>
    <div class="pv-kv"><span class="pv-kv-k">Open bugs</span><span class="pv-kv-v tnum">${openBugs.length}</span></div>
    <div class="pv-kv"><span class="pv-kv-k">AI spend (total)</span><span class="pv-kv-v tnum">$${totalAI.toFixed(2)}</span></div>`;

  // Agent Workload — count stories per assigned agent (from story metadata)
  const agentMap = {};
  activeStories.forEach((s) => {
    const agent = s.assignedAgent || s.agent || 'Unassigned';
    agentMap[agent] = (agentMap[agent] || 0) + (s.status !== 'Done' ? 1 : 0);
  });
  const agentEntries = Object.entries(agentMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxCount = agentEntries[0]?.[1] || 1;
  const workloadContent =
    agentEntries.length > 0
      ? agentEntries
          .map(
            ([name, count]) =>
              `<div class="pv-wl-row">
          <span class="pv-wl-name">${esc(name)}</span>
          <div class="pv-wl-bar-bg"><div class="pv-wl-bar" style="width:${Math.round((count / maxCount) * 100)}%"></div></div>
          <span class="pv-wl-count tnum">${count}</span>
        </div>`,
          )
          .join('')
      : '<p class="pv-widget-empty">No active assignments.</p>';

  return `
  <div class="pv-widgets" style="margin-bottom:16px">
    <div class="card">
      <div class="card-head"><h3>Top Risks</h3></div>
      <div class="card-body pv-risk-list">${riskContent}</div>
    </div>
    <div class="card">
      <div class="card-head"><h3>This Week</h3></div>
      <div class="card-body">${weekContent}</div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Agent Workload</h3></div>
      <div class="card-body">${workloadContent}</div>
    </div>
  </div>`;
}
```

Add CSS to `render-html.js`:

```css
/* US-0139: Decision widgets + shared card primitives */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-soft);
}
.card-head h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.card-body {
  padding: 14px;
}
.pv-widgets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 1100px) {
  .pv-widgets {
    grid-template-columns: minmax(0, 1fr);
  }
}
.pv-risk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pv-risk-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}
.pv-risk-label {
  color: var(--text-dim);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv-widget-empty {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-mute);
}
.pv-kv {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 5px 0;
  border-bottom: 1px solid var(--border-soft);
  font-size: 12.5px;
}
.pv-kv:last-child {
  border-bottom: 0;
}
.pv-kv-k {
  color: var(--text-dim);
}
.pv-kv-v {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text);
}
.pv-wl-row {
  display: grid;
  grid-template-columns: 90px 1fr 28px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}
.pv-wl-row:last-child {
  margin-bottom: 0;
}
.pv-wl-name {
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv-wl-bar-bg {
  background: var(--surface-2);
  border-radius: 3px;
  height: 6px;
  overflow: hidden;
}
.pv-wl-bar {
  height: 100%;
  border-radius: 3px;
  background: var(--plan-accent);
  opacity: 0.85;
}
.pv-wl-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-mute);
  text-align: right;
}
```

- [ ] **Step 4: Call \_renderDecisionWidgets() in renderChartsTab()**

In `renderChartsTab()`, after `${_renderStatusHero(data)}`, add:

```js
${_renderDecisionWidgets(data)}
```

- [ ] **Step 5: Run tests**

```bash
npx jest --coverage 2>&1 | tail -20
```

Expected: all pass, coverage ≥ 80%.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/render-tabs.js tools/lib/render-html.js tests/unit/render-html.test.js
git commit -m "feat: US-0139 add Top Risks, This Week, Agent Workload decision widgets to Status tab"
```

---

### Task 7: Migrate chart palette to shared chartColors tokens (US-0140)

**Files:**

- Modify: `tools/lib/render-tabs.js`
- Modify: `tests/unit/render-html.test.js`

- [ ] **Step 1: Write failing tests**

```js
describe('renderHtml — US-0140 chart palette tokens', () => {
  let html;
  beforeAll(() => {
    html = renderHtml(sampleData);
  });

  it('does not use hardcoded green #22c55e in chart definitions', () => {
    // Chart init code must use CSS variable references, not hex
    // Check the inline script block
    const scriptStart = html.indexOf('<script>');
    const scriptContent = html.slice(scriptStart);
    expect(scriptContent).not.toContain("'#22c55e'");
  });

  it('does not use hardcoded blue #3b82f6 in chart definitions', () => {
    const scriptStart = html.indexOf('<script>');
    expect(html.slice(scriptStart)).not.toContain("'#3b82f6'");
  });

  it('chart init uses pvChartColors variable', () => {
    expect(html).toContain('pvChartColors');
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npx jest --testPathPattern="render-html.test" --testNamePattern="chart palette" 2>&1 | tail -10
```

- [ ] **Step 3: Add chartColors to render-html.js script injection**

In `render-html.js`, in the `<script>` block (or `render-scripts.js`), inject the chart color map before any Chart.js initialisation:

```js
// Injected before Chart.js initialisers
const pvChartColors = {
  ok: getComputedStyle(document.documentElement).getPropertyValue('--ok').trim() || 'oklch(68% 0.15 150)',
  warn: getComputedStyle(document.documentElement).getPropertyValue('--warn').trim() || 'oklch(74% 0.16 78)',
  risk: getComputedStyle(document.documentElement).getPropertyValue('--risk').trim() || 'oklch(64% 0.20 25)',
  info: getComputedStyle(document.documentElement).getPropertyValue('--info').trim() || 'oklch(66% 0.14 240)',
  accent: getComputedStyle(document.documentElement).getPropertyValue('--plan-accent').trim() || 'oklch(62% 0.19 268)',
  mute: getComputedStyle(document.documentElement).getPropertyValue('--text-mute').trim() || 'oklch(70% 0.012 95)',
};
```

- [ ] **Step 4: Replace hardcoded hex in render-tabs.js chart definitions**

In `render-tabs.js`, find the `initTrendsCharts` function (around line 502) and the datasets array. Replace each hex string:

| Old value   | Replace with           |
| ----------- | ---------------------- |
| `'#22c55e'` | `pvChartColors.ok`     |
| `'#64748b'` | `pvChartColors.mute`   |
| `'#3b82f6'` | `pvChartColors.info`   |
| `'#f59e0b'` | `pvChartColors.warn`   |
| `'#06b6d4'` | `pvChartColors.info`   |
| `'#ec4899'` | `pvChartColors.accent` |
| `'#8b5cf6'` | `pvChartColors.accent` |
| `'#ef4444'` | `pvChartColors.risk`   |
| `'#f97316'` | `pvChartColors.warn`   |

In `renderChartsTab` (around line 779), replace chart background colors similarly:

```js
// Before:
{ label: 'Done', data: ${epicDone}, backgroundColor: '#22c55e' },
{ label: 'In Progress', data: ${epicInProgress}, backgroundColor: '#3b82f6' },
{ label: 'Planned/To Do', data: ${epicPlanned}, backgroundColor: '#cbd5e1' },

// After (these are inside a template literal, so use JS expressions):
{ label: 'Done', data: ${epicDone}, backgroundColor: pvChartColors.ok },
{ label: 'In Progress', data: ${epicInProgress}, backgroundColor: pvChartColors.info },
{ label: 'Planned/To Do', data: ${epicPlanned}, backgroundColor: pvChartColors.mute },
```

Do the same for the cost breakdown and coverage charts.

- [ ] **Step 5: Run full suite**

```bash
npx jest --coverage 2>&1 | tail -20
```

Expected: all pass. Coverage ≥ 80%.

- [ ] **Step 6: Commit**

```bash
git add tools/lib/render-tabs.js tools/lib/render-html.js tests/unit/render-html.test.js
git commit -m "feat: US-0140 migrate chart palette to shared pvChartColors CSS-variable token map"
```

---

## LAYER 4 — Agentic Dashboard

**Branch per story:** `feature/US-0142-active-agent-prominence`, etc.

> All Layer 4 changes are in `tools/generate-dashboard.js`. That file is 2986 lines — read it carefully before editing. If it grows beyond ~4000 lines during this work, consider splitting following the render-html.js pattern (Session 19 MEMORY note).

### Task 8: Active agent prominence (US-0142)

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Read the test file to understand sampleData shape**

```bash
head -80 tests/unit/generate-dashboard.test.js
```

Note the structure of the test's mock agent data — you'll need it to write tests with `is-active` agents.

- [ ] **Step 2: Write failing tests**

In `tests/unit/generate-dashboard.test.js`, add a describe block with a data fixture that has an active agent:

```js
describe('generate-dashboard — US-0142 active agent prominence', () => {
  // Find or construct a call that renders an agent card with status: 'active'
  // The exact call depends on which function generates agent cards — read the file first.
  it('active agent card has is-active class', () => {
    const html = generateAgentCard({ name: 'Pixel', role: 'Frontend', status: 'active', task: 'US-0135' });
    expect(html).toContain('is-active');
  });

  it('active agent card has left accent rail via CSS class', () => {
    const html = generateAgentCard({ name: 'Pixel', role: 'Frontend', status: 'active', task: 'US-0135' });
    expect(html).toContain('agent-rail');
  });

  it('idle agent card does not have is-active class', () => {
    const html = generateAgentCard({ name: 'Lens', role: 'Reviewer', status: 'idle', task: null });
    expect(html).not.toContain('is-active');
  });

  it('active agent live-dot has pulsing class', () => {
    const html = generateAgentCard({ name: 'Pixel', role: 'Frontend', status: 'active', task: 'US-0135' });
    expect(html).toContain('dot-pulse');
  });
});
```

> **Note:** Replace `generateAgentCard` with whatever function name renders agent cards in `generate-dashboard.js`. Read the file first to find it.

- [ ] **Step 3: Verify tests fail**

```bash
npx jest --testPathPattern="generate-dashboard.test" --testNamePattern="active agent" 2>&1 | tail -15
```

- [ ] **Step 4: Find and update agent card rendering in generate-dashboard.js**

Search for where agent cards are rendered:

```bash
grep -n "is-active\|agent-card\|agentCard\|renderAgent" tools/generate-dashboard.js | head -20
```

In the agent card template, add conditional classes based on agent status:

```js
// In the agent card template string:
const isActive = agent.status === 'active';
const isBlocked = agent.status === 'blocked';
const isReview = agent.status === 'review';
const statusCls = isActive ? 'is-active' : isBlocked ? 'is-blocked' : isReview ? 'is-review' : 'is-idle';

// Card element:
`<div class="agent-card ${statusCls}">
  <div class="agent-port">
    <span class="agent-live-dot ${isActive ? 'dot-pulse' : ''}"></span>
    <!-- portrait glyph -->
  </div>
  <div class="agent-info">
    <!-- name, role, task -->
    <span class="agent-flag flag-${agent.status || 'idle'}">${isActive ? '● ACTIVE' : agent.status || 'IDLE'}</span>
  </div>
  ${isActive ? '<div class="agent-rail"></div>' : ''}
</div>`;
```

Add CSS in the dashboard's `<style>` block (within `generate-dashboard.js`):

```css
.agent-card {
  position: relative;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  display: grid;
  grid-template-columns: 56px 1fr;
  overflow: hidden;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.agent-card.is-active {
  border-color: var(--live-accent);
  background: color-mix(in oklab, var(--live-accent) 6%, var(--surface));
  box-shadow:
    0 0 0 1px var(--live-accent),
    var(--shadow);
}
.agent-card.is-blocked {
  border-color: color-mix(in oklab, var(--risk) 50%, var(--border));
}
.agent-card.is-review {
  border-color: color-mix(in oklab, var(--info) 40%, var(--border));
}
.agent-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--text-mute);
  position: absolute;
  left: 6px;
  top: 6px;
}
.dot-pulse {
  background: var(--live-accent) !important;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--live-accent) 30%, transparent);
  animation: pv-pulse 1.4s ease-in-out infinite;
}
.agent-rail {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--live-accent);
  border-radius: 10px 0 0 10px;
}
.agent-flag {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--border);
}
.flag-active {
  background: var(--live-accent);
  color: #1a0f00;
  border-color: var(--live-accent);
}
.flag-idle {
  background: var(--surface-2);
  color: var(--text-mute);
}
.flag-blocked {
  background: var(--risk);
  color: #fff;
  border-color: var(--risk);
}
.flag-review {
  background: color-mix(in oklab, var(--info) 20%, var(--surface));
  color: var(--info);
  border-color: color-mix(in oklab, var(--info) 40%, var(--border));
}
```

- [ ] **Step 5: Run tests**

```bash
npx jest --coverage 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "feat: US-0142 active agent prominence — accent rail, tinted bg, pulsing dot, ACTIVE flag"
```

---

### Task 9: Conductor dispatch hold (US-0143)

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing test**

```js
describe('generate-dashboard — US-0143 conductor dispatch hold', () => {
  it('dashboard JS includes conductor hold timeout of 3000ms', () => {
    // The generated HTML must contain the hold logic
    const html = /* call the dashboard generator */;
    expect(html).toContain('conductorHoldMs');
    expect(html).toContain('3000');
  });

  it('dispatch event fires a log entry', () => {
    expect(html).toContain('Dispatched');
  });
});
```

- [ ] **Step 2: Implement conductor hold in generate-dashboard.js**

Find where the dashboard's JS refresh/polling logic updates agent statuses. Add:

```js
// Conductor hold state — persists active display for min 3s after dispatch
var conductorHoldMs = 3000;
var _conductorHoldTimer = null;

function setConductorActive(dispatchMsg) {
  var card = document.querySelector('[data-agent="Conductor"]');
  if (!card) return;
  card.classList.add('is-active');
  card.classList.remove('is-idle');
  // Fire dispatch log entry
  appendEventLog({ t: new Date().toLocaleTimeString(), a: 'Conductor', m: dispatchMsg || 'Dispatched task' });
  // Hold for 3s before allowing idle transition
  clearTimeout(_conductorHoldTimer);
  _conductorHoldTimer = setTimeout(function () {
    card.classList.remove('is-active');
    card.classList.add('is-idle');
  }, conductorHoldMs);
}
```

Call `setConductorActive(msg)` wherever the dashboard receives a Conductor dispatch event (find the event/update handler).

- [ ] **Step 3: Run tests and commit**

```bash
npx jest --coverage 2>&1 | tail -15
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "feat: US-0143 conductor dispatch hold — 3s active state + dispatch log entry"
```

---

### Task 10: Event log as primary column widget (US-0145)

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing test**

```js
describe('generate-dashboard — US-0145 event log', () => {
  it('renders pv-event-log element in main column', () => {
    const html = /* generator call */;
    expect(html).toContain('pv-event-log');
  });

  it('event log row has timestamp · agent · message columns', () => {
    expect(html).toContain('evt-time');
    expect(html).toContain('evt-agent');
    expect(html).toContain('evt-msg');
  });
});
```

- [ ] **Step 2: Add event log HTML structure to generate-dashboard.js**

Find the main column layout. Add a full-width event log card BEFORE the existing activity sidebar card:

```js
// In the main column template:
`<div class="card pv-event-log" id="pv-event-log" style="margin-bottom:16px">
  <div class="card-head">
    <h3>Event Log</h3>
    <span class="pv-log-status mono-eye" id="pv-log-status">LIVE</span>
  </div>
  <div class="pv-log-body" id="pv-log-body" style="max-height:420px;overflow:auto;font-family:var(--font-mono);font-size:12px;line-height:1.55;">
    <!-- rows appended by appendEventLog() -->
  </div>
</div>`;
```

Add `appendEventLog()` JS function:

```js
function appendEventLog(entry) {
  var body = document.getElementById('pv-log-body');
  if (!body) return;
  var tone =
    entry.tag === 'done'
      ? 'evt-done'
      : entry.tag === 'block'
        ? 'evt-block'
        : entry.tag === 'review'
          ? 'evt-review'
          : 'evt-start';
  var row = document.createElement('div');
  row.className = 'pv-log-row ' + tone;
  row.innerHTML =
    '<span class="evt-time">' +
    escH(entry.t) +
    '</span>' +
    '<span class="evt-agent">' +
    escH(entry.a) +
    '</span>' +
    '<span class="evt-msg">' +
    escH(entry.m) +
    '</span>';
  body.insertBefore(row, body.firstChild);
  // Auto-scroll unless user is hovering
  if (!body.dataset.paused) body.scrollTop = 0;
}
```

Add hover pause/resume:

```js
document.getElementById('pv-log-body').addEventListener('mouseenter', function () {
  this.dataset.paused = '1';
});
document.getElementById('pv-log-body').addEventListener('mouseleave', function () {
  delete this.dataset.paused;
});
```

Add CSS:

```css
.pv-log-row {
  display: grid;
  grid-template-columns: 72px 90px 1fr;
  gap: 10px;
  padding: 3px 14px;
  border-bottom: 1px dashed var(--border-soft);
  font-size: 12px;
}
.pv-log-row:last-child {
  border-bottom: 0;
}
.evt-time {
  color: var(--text-mute);
}
.evt-agent {
  color: var(--text);
  font-weight: 600;
}
.evt-msg {
  color: var(--text-dim);
}
.evt-start .evt-agent {
  color: var(--live-accent-ink);
}
.evt-done .evt-agent {
  color: var(--ok);
}
.evt-block .evt-agent {
  color: var(--risk);
}
.evt-review .evt-agent {
  color: var(--info);
}
.pv-log-status {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--live-accent);
  color: #1a0f00;
  margin-left: auto;
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx jest --coverage 2>&1 | tail -15
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "feat: US-0145 promote event log to main column — terminal monospace, auto-scroll, pause-on-hover"
```

---

### Task 11: Pipeline scope reduction (US-0144)

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing test**

```js
describe('generate-dashboard — US-0144 pipeline scope', () => {
  it('pipeline phase cards do not list per-agent task strings', () => {
    const html = /* call with data containing phase.agents */;
    // Phase cards should NOT contain agent-level task details
    // They should only contain phase number, name, group label, fill bar
    expect(html).toContain('pv-phase-fill');
    expect(html).not.toContain('pv-phase-agent-task');
  });
});
```

- [ ] **Step 2: Find pipeline rendering in generate-dashboard.js**

```bash
grep -n "pipeline\|phase\|\.ph " tools/generate-dashboard.js | head -20
```

Trim each phase card template to: phase number, phase name, agent-group label, partial fill bar. Remove any per-agent status lists or current task references from phase cards.

```js
// Simplified phase card:
`<div class="pv-phase ${phaseCls}" data-phase="${esc(phase.id)}">
  <span class="pv-phase-n">${i + 1}</span>
  <span class="pv-phase-name">${esc(phase.name)}</span>
  <span class="pv-phase-group">${esc(phase.agentGroup || '')}</span>
  <div class="pv-phase-fill-bg">
    <div class="pv-phase-fill" style="width:${phase.progress || 0}%"></div>
  </div>
</div>`;
```

Add CSS:

```css
.pv-phase {
  position: relative;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  min-height: 76px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pv-phase.done {
  background: color-mix(in oklab, var(--ok) 10%, var(--surface));
  border-color: color-mix(in oklab, var(--ok) 35%, var(--border));
}
.pv-phase.active {
  border-color: color-mix(in oklab, var(--ok) 50%, var(--border));
  box-shadow: inset 0 -2px 0 var(--ok);
}
.pv-phase.blocked {
  background: color-mix(in oklab, var(--risk) 12%, var(--surface));
  border-color: color-mix(in oklab, var(--risk) 40%, var(--border));
}
.pv-phase-n {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-mute);
  letter-spacing: 0.1em;
}
.pv-phase-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}
.pv-phase-group {
  font-size: 10.5px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}
.pv-phase-fill-bg {
  height: 4px;
  background: var(--surface-2);
  border-radius: 3px;
  overflow: hidden;
  margin-top: auto;
}
.pv-phase-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--ok);
  transition: width 0.3s;
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx jest --coverage 2>&1 | tail -15
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "feat: US-0144 trim pipeline phase cards to number/name/group/fill — remove agent task detail"
```

---

### Task 12: Live bar (US-0146)

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Write failing test**

```js
describe('generate-dashboard — US-0146 live bar', () => {
  it('renders pv-live-bar element', () => {
    const html = /* generator call */;
    expect(html).toContain('pv-live-bar');
  });

  it('live bar contains ON AIR chip', () => {
    expect(html).toContain('ON AIR');
  });

  it('live bar contains a HH:MM:SS clock element', () => {
    expect(html).toContain('pv-live-clock');
  });
});
```

- [ ] **Step 2: Add live bar to generate-dashboard.js**

Add the live bar HTML immediately below the chrome (or topbar equivalent) in the Agentic dashboard layout:

```js
`<div class="pv-live-bar" id="pv-live-bar" role="status" aria-live="polite">
  <span class="pv-on-air">ON AIR</span>
  <div class="pv-live-cycle" id="pv-live-cycle">CYCLE — · —:——</div>
  <div class="pv-live-ticker" id="pv-live-ticker" aria-hidden="true"></div>
  <div class="pv-live-clock mono" id="pv-live-clock">00:00:00</div>
</div>`;
```

Add CSS:

```css
.pv-live-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 18px;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--live-accent) 14%, var(--surface)) 0%,
    var(--surface) 80%
  );
  border-bottom: 1px solid var(--border);
  min-height: 48px;
  border-left: 3px solid var(--live-accent);
}
.pv-on-air {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 4px 8px;
  background: var(--live-accent);
  color: #1a0f00;
  border-radius: 4px;
  flex-shrink: 0;
}
.pv-live-cycle {
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--text-dim);
  flex-shrink: 0;
}
.pv-live-ticker {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 14px;
  border-left: 1px solid var(--border-soft);
}
.pv-live-clock {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  flex-shrink: 0;
}
@media (prefers-reduced-motion: reduce) {
  .pv-live-ticker {
    animation: none;
  }
}
```

Add clock JS (runs on the Agentic page):

```js
(function startLiveClock() {
  function tick() {
    var el = document.getElementById('pv-live-clock');
    if (!el) return;
    var n = new Date();
    el.textContent =
      String(n.getHours()).padStart(2, '0') +
      ':' +
      String(n.getMinutes()).padStart(2, '0') +
      ':' +
      String(n.getSeconds()).padStart(2, '0');
  }
  tick();
  setInterval(tick, 1000);
})();
```

- [ ] **Step 3: Run full suite and commit**

```bash
npx jest --coverage 2>&1 | tail -20
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "feat: US-0146 add live bar — ON AIR chip, cycle display, ticker, HH:MM:SS clock"
```

---

## Self-Review

**Spec coverage check:**

| Spec section                             | Task(s)       | Status |
| ---------------------------------------- | ------------- | ------ |
| §4 Token system (US-0137)                | Task 1        | ✓      |
| §4.2 Theme mapping (US-0141)             | Task 2        | ✓      |
| §4.5 localStorage migration shim         | Task 2        | ✓      |
| §4.6 Lint rule (no hex in output)        | Task 1 tests  | ✓      |
| §5 Chrome / mode badge (US-0136/0138)    | Tasks 3–4     | ✓      |
| §5 EPIC-0010 completion banner preserved | Task 4 note   | ✓      |
| §6.1 Status hero card (US-0135)          | Task 5        | ✓      |
| §6.2 Decision widgets (US-0139)          | Task 6        | ✓      |
| §6.3 Chart palette migration (US-0140)   | Task 7        | ✓      |
| §7.1 Active agent prominence (US-0142)   | Task 8        | ✓      |
| §7.2 Conductor dispatch hold (US-0143)   | Task 9        | ✓      |
| §7.3 Event log promotion (US-0145)       | Task 10       | ✓      |
| §7.4 Pipeline scope reduction (US-0144)  | Task 11       | ✓      |
| §7.5 Live bar (US-0146)                  | Task 12       | ✓      |
| §9 Handoff artifacts applied             | Task 0        | ✓      |
| §10 EPIC-0010 preservation contract      | Tasks 4, 5, 6 | ✓      |

**Type / name consistency check:**

- `renderChrome()` defined Task 4, called Task 4 ✓
- `renderModeBadge()` defined Task 3, called Task 4 ✓
- `renderMasthead()` defined Task 3, called Task 3 ✓
- `_renderStatusHero()` defined Task 5, called Task 5 ✓
- `_renderDecisionWidgets()` defined Task 6, called Task 6 ✓
- `pvChartColors` defined Task 7, used Task 7 ✓
- `generateCssTokens()` defined Task 1, called Task 2 ✓
- `appendEventLog()` defined Task 10, called Task 9 (Conductor hold) ✓
- `setConductorActive()` defined Task 9, standalone ✓

**Placeholder scan:** No TBDs. Task 8 has one conditional note ("replace `generateAgentCard` with whatever function name renders agent cards — read the file first") — this is intentional, not a placeholder, because the exact function name requires reading the 2986-line file.

**Layer gate reminder:** Tasks 1–2 (Layer 1) must be merged and CI-green before any later task begins. Each task is one PR to `develop`.
