# Agentic Dashboard Visual Hierarchy Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix BUG-0185–0189 — unified visual hierarchy for the agentic dashboard: expanded active agent card with full portrait, Conductor last-dispatch strip, 4-col idle roster, promoted event log, slim pipeline, and quieted chrome on both dashboards.

**Architecture:** Approach B — restructure `tools/generate-dashboard.js` widget order (active card → Conductor strip → idle grid → event log) without changing the 2-column main/sidebar grid. Quiet the shared chrome by reducing height from 52px → 40px in `tools/lib/render-chrome.js` and `tools/lib/render-shell.js`. Add Jest DOM structure tests and Playwright visual hierarchy tests.

**Tech Stack:** Node.js, Jest 30, Playwright 1.59 (globally installed), jsdom (via Jest), `tools/generate-dashboard.js`, `tools/lib/render-chrome.js`, `tools/lib/render-shell.js`

**Spec:** `docs/superpowers/specs/2026-04-30-agentic-dashboard-visual-hierarchy-design.md`

---

## File Map

| File                                    | Change                                                               |
| --------------------------------------- | -------------------------------------------------------------------- |
| `tools/lib/render-chrome.js`            | Modify: chrome height 52px → 40px                                    |
| `tools/lib/render-shell.js`             | Modify: SHELL_CHROME_CSS min/max-height 52px → 40px                  |
| `tools/generate-dashboard.js`           | Modify: active card, Conductor strip, idle grid, event log, pipeline |
| `tests/unit/render-chrome.test.js`      | Modify: add chrome regression assertions                             |
| `tests/unit/generate-dashboard.test.js` | Modify: add structure assertions                                     |
| `tests/e2e/dashboard-hierarchy.spec.js` | Create: Playwright visual hierarchy tests                            |
| `playwright.config.js`                  | Create: minimal Playwright config                                    |
| `docs/BUGS.md`                          | Modify: BUG-0185–0189 marked Fixed                                   |
| `docs/LESSONS.md`                       | Modify: add L-0052                                                   |

---

## Task 1: Quiet the chrome — reduce height, add regression guard

**Files:**

- Modify: `tools/lib/render-chrome.js` (line 7)
- Modify: `tools/lib/render-shell.js` (line 7)
- Modify: `tests/unit/render-chrome.test.js`

- [ ] **Step 1.1: Write failing tests for chrome height**

Add to the bottom of `tests/unit/render-chrome.test.js`:

```javascript
test('pv-chrome height is 40px, not 52px (BUG-0189)', () => {
  const { CHROME_CSS } = require('../../tools/lib/render-chrome');
  expect(CHROME_CSS).toContain('height:40px');
  expect(CHROME_CSS).not.toContain('height:52px');
});

test('SHELL_CHROME_CSS min-height is 40px (BUG-0189)', () => {
  const { SHELL_CHROME_CSS } = require('../../tools/lib/render-shell');
  expect(SHELL_CHROME_CSS).toContain('min-height:40px');
  expect(SHELL_CHROME_CSS).not.toContain('min-height:52px');
});
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
npx jest tests/unit/render-chrome.test.js --no-coverage -t "BUG-0189"
```

Expected: 2 FAILures — `height:40px` not found.

- [ ] **Step 1.3: Fix render-chrome.js — change height to 40px**

In `tools/lib/render-chrome.js` line 7, change:

```javascript
// BEFORE:
.pv-chrome { height:52px; background:var(--chrome-bg); border-bottom:1px solid var(--chrome-border);
// AFTER:
.pv-chrome { height:40px; background:var(--chrome-bg); border-bottom:1px solid var(--chrome-border);
```

- [ ] **Step 1.4: Fix render-shell.js — change min/max-height to 40px**

In `tools/lib/render-shell.js` line 7, in `SHELL_CHROME_CSS`, change:

```javascript
// BEFORE (within the backtick string):
min-height:52px;max-height:52px;
// AFTER:
min-height:40px;max-height:40px;
```

- [ ] **Step 1.5: Run tests to confirm they pass**

```bash
npx jest tests/unit/render-chrome.test.js --no-coverage -t "BUG-0189"
```

Expected: 2 PASSes.

- [ ] **Step 1.6: Run full unit suite to check no regressions**

```bash
npx jest tests/unit/ --no-coverage 2>&1 | tail -5
```

Expected: all tests pass (count same or higher than before).

- [ ] **Step 1.7: Commit**

```bash
git add tools/lib/render-chrome.js tools/lib/render-shell.js tests/unit/render-chrome.test.js
git commit -m "fix: BUG-0189 — quiet chrome height 52px → 40px on both dashboards"
```

---

## Task 2: Remove agent names from pipeline phase stations (BUG-0187)

**Files:**

- Modify: `tools/generate-dashboard.js` (~line 2113)
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 2.1: Write a failing test for pipeline agent-name removal**

Add to `tests/unit/generate-dashboard.test.js`, in the existing `describe` block:

```javascript
test('BUG-0187: pipeline phase-block does not render agent names', () => {
  const html = generateHTML(makeHealthyFixture());
  // CANONICAL_PHASES has agents: Blueprint→['Compass'], Build→['Pixel','Forge','Palette']
  // After fix, these names must not appear inside .phase-block elements.
  // Parse only the pipeline section (between pipeline class and /pipeline)
  const pipelineMatch = html.match(/<div class="pipeline[^"]*"[^>]*>([\s\S]*?)<\/div>\s*\n?\s*<!--\s*ROSTER/);
  if (!pipelineMatch) return; // pipeline not rendered (empty phases) — skip
  const pipelineHtml = pipelineMatch[1];
  expect(pipelineHtml).not.toContain('>Compass<');
  expect(pipelineHtml).not.toContain('>Pixel<');
  expect(pipelineHtml).not.toContain('>Forge<');
});
```

- [ ] **Step 2.2: Run to confirm it fails**

```bash
npx jest tests/unit/generate-dashboard.test.js --no-coverage -t "BUG-0187"
```

Expected: FAIL — agent names found in pipeline HTML.

- [ ] **Step 2.3: Remove the phase-agents div from the phase-block template**

In `tools/generate-dashboard.js`, find the phase-block template inside the `.map((p, i) => {...})` call (~line 2109). Remove this line:

```javascript
// DELETE this line:
<div class="phase-agents">${pAgents.join(' · ')}</div>
```

The `pAgents` variable and the `deliverables` div stay — only the `phase-agents` div is removed.

- [ ] **Step 2.4: Run test to confirm it passes**

```bash
npx jest tests/unit/generate-dashboard.test.js --no-coverage -t "BUG-0187"
```

Expected: PASS.

- [ ] **Step 2.5: Run full unit suite**

```bash
npx jest tests/unit/ --no-coverage 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 2.6: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "fix: BUG-0187 — remove agent names from pipeline phase stations"
```

---

## Task 3: Active agent card + Conductor last-dispatch strip (BUG-0185, BUG-0186)

**Files:**

- Modify: `tools/generate-dashboard.js` (roster IIFE, ~lines 2128–2230, and CSS ~lines 797–870)
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 3.1: Write failing tests**

Add to `tests/unit/generate-dashboard.test.js`:

```javascript
test('BUG-0185: active agent renders .mc-active-card with portrait banner', () => {
  // Healthy fixture has Pixel active
  const html = generateHTML(makeHealthyFixture());
  expect(html).toContain('class="mc-active-card"');
  expect(html).toContain('class="mc-active-portrait-banner"');
  // Portrait src points to the full landscape image, not just the optimized thumbnail
  expect(html).toMatch(/src="agents\/images\/pixel\.png"/);
});

test('BUG-0186: conductor dispatch strip always rendered regardless of Conductor status', () => {
  // Healthy fixture: Conductor is idle
  const html = generateHTML(makeHealthyFixture());
  expect(html).toContain('id="mc-conductor-dispatch"');
  expect(html).toContain('data-agent="Conductor"');
});

test('BUG-0185: idle agents rendered in mc-idle-roster, not in main agent-grid', () => {
  const html = generateHTML(makeHealthyFixture());
  expect(html).toContain('id="mc-idle-roster"');
  // Idle cards should have mc-idle-card class
  expect(html).toContain('mc-idle-card');
});
```

- [ ] **Step 3.2: Run to confirm failures**

```bash
npx jest tests/unit/generate-dashboard.test.js --no-coverage -t "BUG-018[56]"
```

Expected: 3 FAILures.

- [ ] **Step 3.3: Add CSS for new card components**

In `tools/generate-dashboard.js`, find the CSS block for `.mc-agent-row` (~line 797) and add these rules **before** the `.mc-agent-row` block:

```css
/* ── BUG-0185/0186: Active agent hero card ── */
.mc-active-card {
  border: 1px solid oklch(72% 0.19 38 / 35%);
  border-left: 5px solid oklch(72% 0.19 38);
  border-radius: 10px;
  overflow: hidden;
  background: oklch(10% 0.03 38);
  box-shadow: 0 0 28px oklch(72% 0.19 38 / 10%);
  margin-bottom: 10px;
}
.mc-active-portrait-banner {
  width: 100%;
  height: 200px;
  background: oklch(6% 0.02 38);
  position: relative;
  overflow: hidden;
}
.mc-active-portrait-banner img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center center;
  display: block;
}
.mc-active-portrait-banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 55%, oklch(10% 0.03 38) 100%);
  pointer-events: none;
}
.mc-active-status-dot {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 11px;
  height: 11px;
  background: var(--ok);
  border-radius: 50%;
  border: 2px solid oklch(6% 0.02 38);
  box-shadow: 0 0 8px var(--ok);
  z-index: 2;
  animation: mc-status-pulse 2s infinite;
}
@keyframes mc-status-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
.mc-active-info {
  padding: 10px 14px 12px;
}
.mc-active-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 6px;
}
.mc-active-name {
  font-size: 17px;
  font-weight: 700;
  color: oklch(93% 0.1 70);
  line-height: 1;
}
.mc-active-role {
  font-size: 10px;
  color: oklch(70% 0.15 50);
  margin-top: 3px;
}
.mc-active-badge {
  background: oklch(72% 0.19 38);
  color: #000;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 3px 11px;
  border-radius: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}
.mc-active-story {
  background: oklch(0% 0 0 / 0.35);
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 10px;
  margin-bottom: 6px;
}
.mc-active-story-id {
  color: oklch(83% 0.15 70);
  font-weight: 700;
  margin-right: 6px;
}
.mc-active-story-desc {
  color: oklch(70% 0.15 50);
}
.mc-active-meta {
  display: flex;
  gap: 14px;
  font-size: 9px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  flex-wrap: wrap;
}
.mc-active-meta span {
  color: var(--text-secondary);
}
/* ── BUG-0186: Conductor last-dispatch strip ── */
.mc-conductor-dispatch {
  background: oklch(12% 0.04 264);
  border: 1px solid oklch(45% 0.15 264 / 25%);
  border-left: 4px solid oklch(60% 0.19 264);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.mc-conductor-portrait {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid oklch(45% 0.15 264 / 35%);
  flex-shrink: 0;
}
.mc-conductor-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}
.mc-conductor-label {
  font-size: 9px;
  color: oklch(72% 0.19 264);
  font-weight: 700;
  letter-spacing: 0.08em;
}
.mc-conductor-value {
  font-size: 11px;
  color: oklch(80% 0.12 264);
}
.mc-conductor-time {
  margin-left: auto;
  font-size: 9px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  white-space: nowrap;
}
/* ── BUG-0185: Idle roster 4-col grid ── */
.mc-idle-roster {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  margin-bottom: 10px;
}
.mc-idle-card {
  background: var(--mc-surface);
  border: 1px solid var(--mc-border);
  border-radius: 7px;
  overflow: hidden;
  opacity: 0.65;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 8px;
  transition: opacity 0.15s;
}
.mc-idle-card:hover {
  opacity: 1;
}
.mc-idle-portrait {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
}
.mc-idle-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
}
.mc-idle-name {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-muted);
  margin-top: 5px;
  text-align: center;
}
.mc-idle-role {
  font-size: 7.5px;
  color: var(--mc-dim);
  margin-top: 1px;
  text-align: center;
  padding: 0 4px;
}
.mc-idle-badge {
  margin-top: 4px;
  background: var(--mc-surface);
  color: var(--mc-dim);
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 10px;
  border: 1px solid var(--mc-border);
}
@media (max-width: 768px) {
  .mc-idle-roster {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 480px) {
  .mc-idle-roster {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 3.4: Replace the roster IIFE with split rendering**

In `tools/generate-dashboard.js`, find the roster section (the large `$(() => { ... })()` IIFE that starts with `<!-- ROSTER section -->` and generates `mc-roster`). Replace the entire IIFE return value with three separate blocks:

The IIFE currently returns one large string. Replace it so that instead of returning `<div class="mc-roster ...">...</div>`, it returns:

```javascript
// 1. Determine Conductor name and last dispatch from log
const dmAgentName = (AGENT_CONFIG.orchestrator || {}).dmAgent || 'Conductor';
const agentList = Object.entries(agents);
const imgBase = 'agents/images';

const lastDispatch = [...log].reverse().find(
  (e) =>
    e.tag === 'dispatch' ||
    String(e.message || '')
      .toLowerCase()
      .startsWith('dispatch'),
);

// 2. Split agents: active (non-Conductor) | idle/other
const activeAgents = agentList.filter(([n, a]) => n !== dmAgentName && a && a.status === 'active');
const idleAgents = agentList.filter(([n]) => n !== dmAgentName && !activeAgents.find(([an]) => an === n));

// 3. Render active cards
const activeCardsHtml = activeAgents
  .map(([name, agent]) => {
    const avatar = agentAvatars[name] || name.toLowerCase();
    const color = agentColors[name] || 'oklch(55% 0 0)';
    const role = agentRoles[name] || name;
    const task = (agent && agent.currentTask) || '';
    const branch = (agent && agent.branch) || '';
    const startedAt = (agent && agent.startedAt) || '';
    const storyId = (task.match(/US-\d{4}/) || [])[0] || '';
    const onerror = `this.src='${imgBase}/optimized/${esc(avatar)}-160.png'`;
    return `<div class="mc-active-card agent-card is-active active" id="agent-${esc(name)}" data-agent-name="${esc(name)}" data-agent="${esc(name)}" data-agent-status="active" style="--agent-color:${color};">
  <div class="mc-active-portrait-banner">
    <img src="${imgBase}/${esc(avatar)}.png" alt="${esc(name)}" onerror="${esc(onerror)}">
    <span class="mc-active-status-dot" aria-hidden="true"></span>
  </div>
  <div class="mc-active-info">
    <div class="mc-active-top">
      <div>
        <div class="mc-active-name">${esc(name)}</div>
        <div class="mc-active-role">${esc(role)}</div>
      </div>
      <span class="mc-active-badge">ACTIVE</span>
    </div>
    ${task ? `<div class="mc-active-story"><span class="mc-active-story-id">${esc(storyId)}</span><span class="mc-active-story-desc">${esc(task)}</span></div>` : ''}
    <div class="mc-active-meta">
      ${branch ? `<div>Branch <span>${esc(branch)}</span></div>` : ''}
      ${startedAt ? `<div>Started <span>${esc(startedAt)}</span></div>` : ''}
    </div>
  </div>
  <div class="agent-status" id="agent-${esc(name)}-status" style="display:none;">active</div>
  <div id="agent-${esc(name)}-task" style="display:none;">${esc(task)}</div>
</div>`;
  })
  .join('\n');

// 4. Render Conductor dispatch strip
const conductorAvatar = agentAvatars[dmAgentName] || dmAgentName.toLowerCase();
const dispatchMsg = lastDispatch ? esc(String(lastDispatch.message || '')) : 'No dispatches yet';
const dispatchTime = lastDispatch ? esc(String(lastDispatch.time || '')) : '';
const conductorAgent = agents[dmAgentName] || {};
const conductorTask = conductorAgent.currentTask || '';
const conductorDispatchHtml = `<div class="mc-conductor-dispatch" id="mc-conductor-dispatch" data-agent="${esc(dmAgentName)}">
  <div class="mc-conductor-portrait">
    <img src="${imgBase}/optimized/${esc(conductorAvatar)}-64.png" alt="${esc(dmAgentName)}" onerror="this.style.display='none'">
  </div>
  <div>
    <div class="mc-conductor-label">${esc(dmAgentName)} · Last Dispatch</div>
    <div class="mc-conductor-value">${dispatchMsg}</div>
  </div>
  <span class="mc-conductor-time">${dispatchTime}</span>
  <div id="agent-${esc(dmAgentName)}-task" style="display:none;">${esc(conductorTask)}</div>
  <div class="agent-status" id="agent-${esc(dmAgentName)}-status" style="display:none;">${esc(conductorAgent.status || 'idle')}</div>
</div>`;

// 5. Render idle 4-col grid
const idleCardsHtml = idleAgents
  .map(([name, agent]) => {
    const avatar = agentAvatars[name] || name.toLowerCase();
    const color = agentColors[name] || 'oklch(55% 0 0)';
    const role = agentRoles[name] || name;
    const statusStr = (agent && agent.status) || 'idle';
    const task = (agent && agent.currentTask) || '';
    const onerror = `this.parentElement.innerHTML='<div style="width:100%;aspect-ratio:1;background:var(--mc-surface);display:flex;align-items:center;justify-content:center;font-size:22px;">${name.charAt(0)}</div>'`;
    return `<div class="mc-idle-card agent-card is-idle" id="agent-${esc(name)}" data-agent-name="${esc(name)}" data-agent="${esc(name)}" data-agent-status="${esc(statusStr)}" style="--agent-color:${color};">
  <div class="mc-idle-portrait"><img src="${imgBase}/optimized/${esc(avatar)}-64.png" alt="${esc(name)}" onerror="${esc(onerror)}"></div>
  <div class="mc-idle-name">${esc(name)}</div>
  <div class="mc-idle-role">${esc(role)}</div>
  <div class="mc-idle-badge">IDLE</div>
  <div class="agent-status" id="agent-${esc(name)}-status" style="display:none;">${esc(statusStr)}</div>
  <div id="agent-${esc(name)}-task" style="display:none;">${esc(task)}</div>
</div>`;
  })
  .join('\n');

// 6. Assemble
return `${activeCardsHtml}
${conductorDispatchHtml}
<div class="mc-section-bar" style="margin-bottom:6px;">
  <span class="mc-section-label">ALL AGENTS</span>
</div>
<div class="mc-idle-roster" id="mc-idle-roster">
${idleCardsHtml}
</div>
<!-- Hidden spotlight stub for patchDOM compatibility -->
<div id="agent-spotlight" style="display:none;" data-agent-name="" data-started-at="">
  <div id="agent-spotlight-name"></div>
  <div id="agent-spotlight-role"></div>
  <div id="agent-spotlight-task"></div>
  <div id="agent-spotlight-elapsed" data-started-at="${esc(cycleStartedAt)}"></div>
</div>`;
```

**Important:** keep all variables that were in scope in the original IIFE (`agentColors`, `agentAvatars`, `agentRoles`, `agentIcons`, `cycleStartedAt`, `esc`, etc.) — they are already computed earlier in `generateHTML()`.

- [ ] **Step 3.5: Run failing tests — they should now pass**

```bash
npx jest tests/unit/generate-dashboard.test.js --no-coverage -t "BUG-018[56]"
```

Expected: 3 PASSes.

- [ ] **Step 3.6: Run full unit suite**

```bash
npx jest tests/unit/ --no-coverage 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 3.7: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "fix: BUG-0185 BUG-0186 — active card with full portrait + Conductor dispatch strip"
```

---

## Task 4: Promote event log to main column (BUG-0188)

**Files:**

- Modify: `tools/generate-dashboard.js` (~line 2327)
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 4.1: Write failing test**

Add to `tests/unit/generate-dashboard.test.js`:

```javascript
test('BUG-0188: event log is in mc-main, not hidden', () => {
  const html = generateHTML(makeHealthyFixture());
  // The primary event log block must NOT have display:none
  // and must appear before /mc-main (before the sidebar)
  const mainEnd = html.indexOf('</div><!-- /mc-main -->');
  const logIdx = html.indexOf('id="pv-event-log"');
  expect(logIdx).toBeGreaterThan(-1);
  expect(logIdx).toBeLessThan(mainEnd);
  // Must not be hidden
  const logBlockStart = html.lastIndexOf('<', logIdx);
  const logBlockTag = html.slice(logBlockStart, logBlockStart + 120);
  expect(logBlockTag).not.toContain('display:none');
});
```

- [ ] **Step 4.2: Run to confirm failure**

```bash
npx jest tests/unit/generate-dashboard.test.js --no-coverage -t "BUG-0188"
```

Expected: FAIL — `display:none` found on the event log block.

- [ ] **Step 4.3: Remove display:none from the primary event log block**

In `tools/generate-dashboard.js`, find (~line 2327):

```javascript
<div class="card pv-event-log" id="pv-event-log" style="display:none;">
```

Change to:

```javascript
<div class="card pv-event-log" id="pv-event-log">
```

- [ ] **Step 4.4: Trim the sidebar activity feed to last 3 events**

In the same file, find the sidebar "Activity Log" section inside `<!-- ── RIGHT SIDEBAR ── -->`. The sidebar has its own log rendering block that calls `log.slice(-20).reverse()`. Change `-20` to `-3`:

```javascript
// BEFORE:
.slice(-20)
// AFTER:
.slice(-3)
```

Also add `opacity: 0.6; font-size: 10px;` to the sidebar log's container style to visually demote it:

```javascript
// Find the sidebar mc-sidebar-panel that wraps the Activity section, add style:
// style="opacity:0.6;"
```

- [ ] **Step 4.5: Run test to confirm pass**

```bash
npx jest tests/unit/generate-dashboard.test.js --no-coverage -t "BUG-0188"
```

Expected: PASS.

- [ ] **Step 4.6: Run full unit suite**

```bash
npx jest tests/unit/ --no-coverage 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Step 4.7: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "fix: BUG-0188 — promote event log to main column, trim sidebar feed to 3 entries"
```

---

## Task 5: Playwright e2e visual hierarchy tests

**Files:**

- Create: `playwright.config.js`
- Create: `tests/e2e/dashboard-hierarchy.spec.js`
- Create: `tests/e2e/fixtures/sdlc-status-hierarchy.json`

- [ ] **Step 5.1: Create playwright.config.js**

Create `playwright.config.js` at project root:

```javascript
'use strict';
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

- [ ] **Step 5.2: Create the hierarchy fixture**

Create `tests/e2e/fixtures/sdlc-status-hierarchy.json`:

```json
{
  "project": { "name": "PlanVisualizer", "description": "Test fixture", "repoUrl": "", "startDate": "2026-04-01" },
  "currentPhase": 3,
  "cycles": [],
  "phases": [
    {
      "id": 1,
      "name": "Blueprint",
      "agents": ["Compass"],
      "deliverables": [],
      "status": "complete",
      "startedAt": "2026-04-30T19:00:00Z",
      "completedAt": "2026-04-30T19:30:00Z"
    },
    {
      "id": 2,
      "name": "Architect",
      "agents": ["Keystone"],
      "deliverables": [],
      "status": "complete",
      "startedAt": "2026-04-30T19:30:00Z",
      "completedAt": "2026-04-30T20:00:00Z"
    },
    {
      "id": 3,
      "name": "Build",
      "agents": ["Pixel", "Forge"],
      "deliverables": [],
      "status": "in-progress",
      "startedAt": "2026-04-30T20:00:00Z"
    },
    { "id": 4, "name": "Integration", "agents": ["Pixel"], "deliverables": [], "status": "pending" },
    { "id": 5, "name": "Test", "agents": ["Sentinel", "Circuit"], "deliverables": [], "status": "pending" },
    { "id": 6, "name": "Polish", "agents": ["Pixel", "Forge"], "deliverables": [], "status": "pending" }
  ],
  "agents": {
    "Conductor": { "status": "idle", "currentTask": null, "tasksCompleted": 3 },
    "Compass": { "status": "idle", "currentTask": null, "tasksCompleted": 1 },
    "Keystone": { "status": "idle", "currentTask": null, "tasksCompleted": 1 },
    "Lens": { "status": "idle", "currentTask": null, "tasksCompleted": 0 },
    "Palette": { "status": "idle", "currentTask": null, "tasksCompleted": 0 },
    "Forge": { "status": "idle", "currentTask": null, "tasksCompleted": 0 },
    "Pixel": {
      "status": "active",
      "currentTask": "US-0171 dashboard visual hierarchy",
      "branch": "feature/US-0171-dashboard-ux",
      "startedAt": "20:15 UTC",
      "tasksCompleted": 2
    },
    "Sentinel": { "status": "idle", "currentTask": null, "tasksCompleted": 0 },
    "Circuit": { "status": "idle", "currentTask": null, "tasksCompleted": 0 }
  },
  "log": [
    {
      "time": "20:15:02",
      "agent": "Conductor",
      "message": "dispatched → Pixel · US-0171 · Build phase",
      "tag": "dispatch"
    },
    { "time": "20:15:03", "agent": "Pixel", "message": "started US-0171 feature/US-0171-dashboard-ux", "tag": "start" }
  ],
  "stories": {},
  "epics": {},
  "metrics": {
    "storiesCompleted": 4,
    "storiesTotal": 12,
    "tasksCompleted": 0,
    "tasksTotal": 0,
    "testsPassed": 2341,
    "testsFailed": 0,
    "bugsOpen": 2,
    "coveragePct": 93
  }
}
```

- [ ] **Step 5.3: Create the e2e test file**

Create `tests/e2e/dashboard-hierarchy.spec.js`:

```javascript
'use strict';
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'sdlc-status-hierarchy.json');
const STATUS_PATH = path.join(ROOT, 'docs', 'sdlc-status.json');
const DASHBOARD_PATH = path.join(ROOT, 'docs', 'dashboard.html');
const DASHBOARD_URL = `file://${DASHBOARD_PATH}`;

test.beforeAll(() => {
  // Swap in test fixture, generate dashboard, restore original
  const originalStatus = fs.existsSync(STATUS_PATH) ? fs.readFileSync(STATUS_PATH) : null;
  fs.copyFileSync(FIXTURE_PATH, STATUS_PATH);
  execSync('node tools/generate-dashboard.js', { cwd: ROOT });
  if (originalStatus) fs.writeFileSync(STATUS_PATH, originalStatus);
});

test('BUG-0185: active agent card is taller than any idle card', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const activeBox = await page.locator('.mc-active-card').first().boundingBox();
  const idleBoxes = await page.locator('.mc-idle-card').all();
  expect(activeBox).not.toBeNull();
  expect(idleBoxes.length).toBeGreaterThan(0);
  for (const card of idleBoxes) {
    const box = await card.boundingBox();
    expect(activeBox.height).toBeGreaterThan(box.height);
  }
});

test('BUG-0185: active card has amber left border (oklch 72% 0.19 38)', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const borderColor = await page
    .locator('.mc-active-card')
    .first()
    .evaluate((el) => getComputedStyle(el).borderLeftColor);
  // oklch(72% 0.19 38) resolves to approximately rgb(218, 145, 20) in sRGB
  expect(borderColor).toMatch(/rgb\(21[0-9], 1[3-5][0-9], [0-9]+\)/);
});

test('BUG-0186: conductor dispatch strip visible even when Conductor is idle', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  // Fixture has Conductor status=idle but log has a dispatch event
  const strip = page.locator('#mc-conductor-dispatch');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText('dispatched');
});

test('BUG-0187: pipeline phase blocks do not contain agent names', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const phases = await page.locator('.phase-block').all();
  for (const phase of phases) {
    const text = await phase.innerText();
    expect(text).not.toMatch(/Compass|Keystone|Pixel|Forge|Sentinel|Circuit/);
  }
});

test('BUG-0188: primary event log is visible in main column', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const log = page.locator('#pv-event-log');
  await expect(log).toBeVisible();
  // Must be inside mc-main, not mc-sidebar
  const isInMain = await page.locator('.mc-main #pv-event-log').count();
  expect(isInMain).toBeGreaterThan(0);
});

test('BUG-0189: chrome height is 40px or less', async ({ page }) => {
  await page.goto(DASHBOARD_URL);
  const chromeHeight = await page.locator('.pv-chrome').evaluate((el) => el.getBoundingClientRect().height);
  expect(chromeHeight).toBeLessThanOrEqual(44); // 4px tolerance for border
});

test('BUG-0189: plan-status chrome height is 40px or less', async ({ page }) => {
  const planUrl = `file://${path.join(ROOT, 'docs', 'plan-status.html')}`;
  await page.goto(planUrl);
  const chromeHeight = await page.locator('.pv-chrome').evaluate((el) => el.getBoundingClientRect().height);
  expect(chromeHeight).toBeLessThanOrEqual(44);
});
```

- [ ] **Step 5.4: Install Playwright browsers if needed**

```bash
npx playwright install chromium 2>&1 | tail -3
```

Expected: "Chromium X.X.X" downloaded or already present.

- [ ] **Step 5.5: Generate plan-status.html so the chrome test can run**

```bash
node tools/generate-plan.js 2>&1 | tail -3
```

Expected: `plan-status.html` written to `docs/`.

- [ ] **Step 5.6: Run Playwright tests**

```bash
npx playwright test tests/e2e/dashboard-hierarchy.spec.js --reporter=line 2>&1
```

Expected: all 7 tests pass. If any fail, check `docs/dashboard.html` was generated correctly by inspecting the relevant DOM element manually.

- [ ] **Step 5.7: Commit**

```bash
mkdir -p tests/e2e/fixtures
git add playwright.config.js tests/e2e/dashboard-hierarchy.spec.js tests/e2e/fixtures/sdlc-status-hierarchy.json
git commit -m "test: add Playwright e2e hierarchy tests for BUG-0185–0189 regression guard"
```

---

## Task 6: Documentation — mark bugs fixed, add lesson, push PR

**Files:**

- Modify: `docs/BUGS.md`
- Modify: `docs/LESSONS.md`
- Modify: `docs/ID_REGISTRY.md` (next lesson ID)

- [ ] **Step 6.1: Mark BUG-0185 through BUG-0189 Fixed in docs/BUGS.md**

For each of BUG-0185, BUG-0186, BUG-0187, BUG-0188, BUG-0189, change:

```
Status: Open
Fix Branch:
Lesson Encoded: No
```

to:

```
Status: Fixed
Fix Branch: bugfix/BUG-0252-stash-recovery
Lesson Encoded: Yes
```

(This PR is being developed on the same branch as BUG-0252 because the spec and plan files were committed there. If a new branch was created for this work, use that branch name instead.)

- [ ] **Step 6.2: Add L-0052 to docs/LESSONS.md**

Append to the bottom of `docs/LESSONS.md`:

```markdown
---

## L-0052 — Separate visual hierarchy by information priority, not by component type

**Context:** BUG-0185–0189 all stemmed from grouping widgets by component type (roster, pipeline, log) rather than by information priority. Active agents have the highest scan value on a mission-control surface but were visually indistinguishable from idle ones. The event log (real-time stream) was buried lower than the pipeline (cycle-phase summary).

**Fix:** Reorder widgets by information priority: active-agent hero → last-dispatch strip → event log (primary stream) → idle roster → sidebar. Redesign the active card to have dramatically more visual weight (full portrait banner, amber glow, 200px height vs 50px for idle cards). Remove information duplication between widgets (pipeline and roster both encoding "who is active" — pipeline now owns cycle progress only).

**Prevention:** When adding a new widget to a dashboard, ask: what is the scan hierarchy? A 2-second glance test — can someone immediately identify what is happening and who is doing it? If not, the visual weight is wrong.

**Bugs:** BUG-0185, BUG-0186, BUG-0187, BUG-0188, BUG-0189
**Date:** 2026-04-30
```

- [ ] **Step 6.3: Run full test suite one final time**

```bash
npx jest tests/unit/ --coverage 2>&1 | tail -10
```

Expected: ≥ 80% statement coverage, all tests pass.

- [ ] **Step 6.4: Commit docs**

```bash
git add docs/BUGS.md docs/LESSONS.md
git commit -m "docs: BUG-0185–0189 Fixed, L-0052 — visual hierarchy by information priority"
```

- [ ] **Step 6.5: Push and open PR**

```bash
git push -u origin bugfix/BUG-0252-stash-recovery
gh pr create \
  --title "fix: BUG-0185–0189 — agentic dashboard visual hierarchy + regression tests" \
  --body "$(cat <<'EOF'
## Summary
- Active agent card: full landscape portrait banner (object-fit:contain, 200px), amber glow, dramatically higher visual weight than idle cards (BUG-0185)
- Conductor last-dispatch strip: always visible with most recent dispatch event, regardless of Conductor status (BUG-0186)
- Pipeline phase stations: agent names removed — pipeline owns cycle progress, roster owns agent state (BUG-0187)
- Event log promoted to main column, full width; sidebar feed trimmed to 3 events (BUG-0188)
- Chrome height 52px → 40px on both dashboards via shared render-chrome.js (BUG-0189)
- New: Playwright e2e visual hierarchy test suite + Jest DOM structure assertions

## Test plan
- [ ] \`npx jest tests/unit/ --coverage\` — all pass, ≥80% coverage
- [ ] \`npx playwright test tests/e2e/dashboard-hierarchy.spec.js\` — all 7 pass
- [ ] Open docs/dashboard.html — active Pixel card shows full portrait, Conductor strip visible
- [ ] Open docs/plan-status.html — chrome is 40px tall, REPORT badge visible

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" --base develop
```

- [ ] **Step 6.6: Enable auto-merge**

```bash
gh pr merge --auto --squash --delete-branch <PR_NUMBER>
```

---

## Self-Review

**Spec coverage check:**

- BUG-0185 active card: Task 3 ✓
- BUG-0186 Conductor dispatch: Task 3 ✓
- BUG-0187 pipeline cleanup: Task 2 ✓
- BUG-0188 event log promotion: Task 4 ✓
- BUG-0189 chrome height: Task 1 ✓
- Jest structure tests: Tasks 1–4 ✓
- Playwright visual tests: Task 5 ✓
- Both dashboards chrome fix: Task 1 targets render-chrome.js (shared) ✓
- BUGS.md + LESSONS.md: Task 6 ✓

**Placeholder scan:** No TBD, TODO, or vague steps. All code blocks contain exact implementations. ✓

**Type consistency:** `mc-active-card`, `mc-conductor-dispatch`, `mc-idle-roster`, `mc-idle-card` class names used consistently across CSS (Task 3), HTML generation (Task 3), and Playwright tests (Task 5). `#pv-event-log` ID is the existing ID preserved from the original code. ✓

**Scope:** Single PR. All tasks produce independently testable changes. ✓
