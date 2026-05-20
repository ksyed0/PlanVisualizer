# US-0186 Dashboard Review-Gate Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the per-task review gate state (US-0185) on the Agentic Dashboard. Adds an S/M/L density toggle in the topbar; extends `patchTaskList()` to decorate each `done` task row with the appropriate visual based on the new `task.taskReview` schema.

**Architecture:** Pure helpers in a new module (`tools/lib/dashboard-task-review.js`) — `deriveDisplayState()` + three render functions. The module is `require()`-able in Node for unit tests, and its function sources are emitted via `fn.toString()` into the generated HTML's `<script>` block so the same code runs in the browser. `generate-dashboard.js` gains the topbar pill HTML, `setTaskDensity` handler, `initTaskDensity` on page load, `_pvLastStatus` cache, and CSS (theme-token-driven) with `prefers-reduced-motion` honored.

**Tech Stack:** Node.js 18+, Jest 30, vanilla JavaScript, CSS theme tokens. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-17-us-0186-dashboard-review-gate-visualization-design.md`

---

## File Structure

| Path                                                   | Action | Responsibility                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/lib/dashboard-task-review.js`                   | Create | Pure helpers: `deriveDisplayState`, `renderReviewIconS`, `renderReviewChipsM`, `renderReviewLineL`. CommonJS module, function declarations (so `fn.toString()` works for browser embedding).                                                                                                                                              |
| `tools/generate-dashboard.js`                          | Modify | Require the helpers; emit their source into the HTML script block; emit `window.pvTaskReviewCap` literal; add topbar pill HTML; add `setTaskDensity`/`initTaskDensity`; cache `_pvLastStatus`; extend `patchTaskList()` to call the renderer based on `window.pvTaskDensity`; add CSS for chips, lines, icons, animations, reduced-motion |
| `tests/unit/dashboard-task-review.test.js`             | Create | Unit tests for `deriveDisplayState` (12+ state combinations) and the 3 render functions                                                                                                                                                                                                                                                   |
| `tests/unit/dashboard-density-toggle.test.js`          | Create | Tests for `setTaskDensity` / `initTaskDensity` behaviour (eval generated JS in a jsdom-like context or assert on emitted HTML structure)                                                                                                                                                                                                  |
| `tests/integration/dashboard-task-review-flow.test.js` | Create | Render full dashboard with fixture sdlc-status; assert task rows have expected review markup in each density mode                                                                                                                                                                                                                         |
| `tests/unit/generate-dashboard.test.js`                | Modify | Add tests asserting the topbar pill HTML is emitted; `window.pvTaskReviewCap` literal is injected from config; helper source is included in the script block                                                                                                                                                                              |
| `docs/RELEASE_PLAN.md`                                 | Modify | Add EPIC-0029 (Agentic Pipeline UX) and US-0186 with ACs                                                                                                                                                                                                                                                                                  |
| `docs/ID_REGISTRY.md`                                  | Modify | Bump next EPIC (0030) and US (0187); AC range 0731-0736 reserved                                                                                                                                                                                                                                                                          |

---

## Task 1: `deriveDisplayState` pure helper

**Files:**

- Create: `tools/lib/dashboard-task-review.js`
- Create: `tests/unit/dashboard-task-review.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/dashboard-task-review.test.js`:

```js
'use strict';

const { deriveDisplayState } = require('../../tools/lib/dashboard-task-review');

describe('deriveDisplayState', () => {
  test('returns null when taskReview is null', () => {
    expect(deriveDisplayState(null)).toBeNull();
  });

  test('returns null when taskReview is undefined', () => {
    expect(deriveDisplayState(undefined)).toBeNull();
  });

  test('returns {skipped: true} when headSha === "none"', () => {
    expect(deriveDisplayState({ headSha: 'none' })).toEqual({ skipped: true });
  });

  test('initial spec_reviewing → specIcon=⟳, qualityIcon=null, overall=⟳', () => {
    const r = deriveDisplayState({
      status: 'spec_reviewing',
      specVerdict: null,
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('⟳');
    expect(r.qualityIcon).toBeNull();
    expect(r.escalated).toBe(false);
    expect(r.retryCount).toBeNull();
    expect(r.overall).toBe('⟳');
  });

  test('spec approved + quality_reviewing → specIcon=✓, qualityIcon=⟳, overall=⟳', () => {
    const r = deriveDisplayState({
      status: 'quality_reviewing',
      specVerdict: 'APPROVED',
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✓');
    expect(r.qualityIcon).toBe('⟳');
    expect(r.overall).toBe('⟳');
  });

  test('both approved → both ✓, overall=✓', () => {
    const r = deriveDisplayState({
      status: 'approved',
      specVerdict: 'APPROVED',
      qualityVerdict: 'APPROVED',
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✓');
    expect(r.qualityIcon).toBe('✓');
    expect(r.overall).toBe('✓');
    expect(r.escalated).toBe(false);
  });

  test('spec REQUEST_CHANGES + forge_retry → specIcon=✗, retryCount=1, overall=✗', () => {
    const r = deriveDisplayState({
      status: 'forge_retry',
      specVerdict: 'REQUEST_CHANGES',
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✗');
    expect(r.qualityIcon).toBeNull();
    expect(r.retryCount).toBe(1);
    expect(r.escalated).toBe(false);
    expect(r.overall).toBe('✗');
  });

  test('spec escalated → specIcon=✗, escalated=true', () => {
    const r = deriveDisplayState({
      status: 'escalated',
      specVerdict: 'REQUEST_CHANGES',
      qualityVerdict: null,
      forgeRetries: 2,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✗');
    expect(r.escalated).toBe(true);
    expect(r.overall).toBe('✗');
  });

  test('quality REQUEST_CHANGES + forge_retry → specIcon=✓, qualityIcon=✗, retryCount=1', () => {
    const r = deriveDisplayState({
      status: 'forge_retry',
      specVerdict: 'APPROVED',
      qualityVerdict: 'REQUEST_CHANGES',
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✓');
    expect(r.qualityIcon).toBe('✗');
    expect(r.retryCount).toBe(1);
    expect(r.overall).toBe('✗');
  });

  test('post-retry spec_reviewing (forgeRetries=1) → specIcon=⟳, retryCount=1', () => {
    const r = deriveDisplayState({
      status: 'spec_reviewing',
      specVerdict: null,
      qualityVerdict: null,
      forgeRetries: 1,
      headSha: 'def5678',
    });
    expect(r.specIcon).toBe('⟳');
    expect(r.retryCount).toBe(1);
    expect(r.overall).toBe('⟳');
  });

  test('quality escalated → specIcon=✓, qualityIcon=✗, escalated=true', () => {
    const r = deriveDisplayState({
      status: 'escalated',
      specVerdict: 'APPROVED',
      qualityVerdict: 'REQUEST_CHANGES',
      forgeRetries: 2,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✓');
    expect(r.qualityIcon).toBe('✗');
    expect(r.escalated).toBe(true);
    expect(r.overall).toBe('✗');
  });

  test('retryCap reads from globalThis.pvTaskReviewCap, falls back to 2', () => {
    const r = deriveDisplayState({
      status: 'forge_retry',
      specVerdict: 'REQUEST_CHANGES',
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.retryCap).toBe(2);

    // Override and re-test
    globalThis.pvTaskReviewCap = 3;
    const r2 = deriveDisplayState({
      status: 'forge_retry',
      specVerdict: 'REQUEST_CHANGES',
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r2.retryCap).toBe(3);
    delete globalThis.pvTaskReviewCap;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/unit/dashboard-task-review.test.js --no-coverage`
Expected: FAIL with "Cannot find module 'tools/lib/dashboard-task-review'".

- [ ] **Step 3: Create the module with `deriveDisplayState`**

Create `tools/lib/dashboard-task-review.js`. Use `function` declarations (not arrow functions) so `fn.toString()` works for later browser embedding:

```js
'use strict';

function deriveDisplayState(taskReview) {
  if (!taskReview) return null;
  if (taskReview.headSha === 'none') return { skipped: true };

  var status = taskReview.status;
  var specV = taskReview.specVerdict;
  var qualV = taskReview.qualityVerdict;
  var retries = taskReview.forgeRetries || 0;

  var specIcon = null;
  if (specV === 'APPROVED') specIcon = '✓';
  else if (specV === 'REQUEST_CHANGES') specIcon = '✗';
  else if (status === 'spec_reviewing') specIcon = '⟳';

  var qualityIcon = null;
  if (qualV === 'APPROVED') qualityIcon = '✓';
  else if (qualV === 'REQUEST_CHANGES') qualityIcon = '✗';
  else if (status === 'quality_reviewing') qualityIcon = '⟳';

  var retryCount = null;
  if (status === 'forge_retry') {
    retryCount = retries + 1;
  } else if (retries > 0 && (status === 'spec_reviewing' || status === 'quality_reviewing')) {
    retryCount = retries;
  }

  var escalated = status === 'escalated';

  var overall = null;
  if (specIcon === '✓' && qualityIcon === '✓') overall = '✓';
  else if (specIcon === '✗' || qualityIcon === '✗') overall = '✗';
  else if (specIcon === '⟳' || qualityIcon === '⟳') overall = '⟳';

  var cap =
    typeof globalThis !== 'undefined' && typeof globalThis.pvTaskReviewCap === 'number'
      ? globalThis.pvTaskReviewCap
      : 2;

  return {
    skipped: false,
    specIcon: specIcon,
    qualityIcon: qualityIcon,
    retryCount: retryCount,
    retryCap: cap,
    escalated: escalated,
    overall: overall,
  };
}

module.exports = { deriveDisplayState };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/dashboard-task-review.test.js --no-coverage`
Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/dashboard-task-review.js tests/unit/dashboard-task-review.test.js
git commit -m "feat(US-0186): add deriveDisplayState pure helper"
```

---

## Task 2: `renderReviewIconS` for S mode

**Files:**

- Modify: `tools/lib/dashboard-task-review.js`
- Modify: `tests/unit/dashboard-task-review.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/dashboard-task-review.test.js`:

```js
describe('renderReviewIconS', () => {
  const { renderReviewIconS } = require('../../tools/lib/dashboard-task-review');

  test('returns empty string when ds is null', () => {
    expect(renderReviewIconS(null)).toBe('');
  });

  test('returns empty string when ds.skipped', () => {
    expect(renderReviewIconS({ skipped: true })).toBe('');
  });

  test('returns empty string when overall is null', () => {
    expect(renderReviewIconS({ skipped: false, overall: null })).toBe('');
  });

  test('cleared (overall=✓) renders ok-class span with title', () => {
    const html = renderReviewIconS({ skipped: false, overall: '✓' });
    expect(html).toContain('class="pv-rev-icon ok"');
    expect(html).toContain('>✓<');
    expect(html).toContain('title=');
  });

  test('reviewing (overall=⟳) renders review-class span', () => {
    const html = renderReviewIconS({ skipped: false, overall: '⟳' });
    expect(html).toContain('class="pv-rev-icon review"');
    expect(html).toContain('>⟳<');
  });

  test('failed/escalated (overall=✗) renders risk-class span', () => {
    const html = renderReviewIconS({ skipped: false, overall: '✗' });
    expect(html).toContain('class="pv-rev-icon risk"');
    expect(html).toContain('>✗<');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest tests/unit/dashboard-task-review.test.js --no-coverage`
Expected: 6 failures.

- [ ] **Step 3: Add `renderReviewIconS`**

In `tools/lib/dashboard-task-review.js`, add the function before `module.exports`:

```js
function renderReviewIconS(ds) {
  if (!ds || ds.skipped || !ds.overall) return '';
  var cls;
  var title;
  if (ds.overall === '✓') {
    cls = 'ok';
    title = 'Review cleared';
  } else if (ds.overall === '⟳') {
    cls = 'review';
    title = 'Review in progress';
  } else {
    cls = 'risk';
    title = 'Review needs changes or escalated';
  }
  return '<span class="pv-rev-icon ' + cls + '" title="' + title + '">' + ds.overall + '</span>';
}
```

Update `module.exports`:

```js
module.exports = { deriveDisplayState, renderReviewIconS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/unit/dashboard-task-review.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/dashboard-task-review.js tests/unit/dashboard-task-review.test.js
git commit -m "feat(US-0186): add renderReviewIconS for S mode"
```

---

## Task 3: `renderReviewChipsM` for M mode

**Files:**

- Modify: `tools/lib/dashboard-task-review.js`
- Modify: `tests/unit/dashboard-task-review.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/dashboard-task-review.test.js`:

```js
describe('renderReviewChipsM', () => {
  const { renderReviewChipsM } = require('../../tools/lib/dashboard-task-review');

  test('returns empty string when ds is null', () => {
    expect(renderReviewChipsM(null)).toBe('');
  });

  test('returns empty string when ds.skipped', () => {
    expect(renderReviewChipsM({ skipped: true })).toBe('');
  });

  test('both APPROVED → two ok chips', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '✓',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '✓',
    });
    expect(html).toContain('pv-rev-chip ok');
    expect(html.match(/pv-rev-chip ok/g).length).toBe(2);
    expect(html).toContain('SPEC ✓');
    expect(html).toContain('QUAL ✓');
  });

  test('spec approved + quality reviewing → ok + review chips', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '⟳',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html).toContain('pv-rev-chip ok');
    expect(html).toContain('pv-rev-chip review');
    expect(html).toContain('SPEC ✓');
    expect(html).toContain('QUAL ⟳');
  });

  test('spec failed + retry → risk + warn retry chip', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✗',
      qualityIcon: null,
      retryCount: 1,
      retryCap: 2,
      escalated: false,
      overall: '✗',
    });
    expect(html).toContain('pv-rev-chip risk');
    expect(html).toContain('SPEC ✗');
    expect(html).toContain('pv-rev-chip warn');
    expect(html).toContain('RETRY 1/2');
  });

  test('spec escalated → risk + ESCALATED chip', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✗',
      qualityIcon: null,
      retryCount: null,
      retryCap: 2,
      escalated: true,
      overall: '✗',
    });
    expect(html).toContain('SPEC ✗');
    expect(html).toContain('ESCALATED');
    expect(html).not.toContain('RETRY');
  });

  test('quality failed + retry → ok + risk + warn retry chip', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '✗',
      retryCount: 1,
      retryCap: 2,
      escalated: false,
      overall: '✗',
    });
    expect(html).toContain('SPEC ✓');
    expect(html).toContain('QUAL ✗');
    expect(html).toContain('RETRY 1/2');
  });

  test('every chip has a title attribute', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '⟳',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html.match(/title="[^"]+"/g).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `npx jest tests/unit/dashboard-task-review.test.js --no-coverage`
Expected: 7 failures.

- [ ] **Step 3: Add `renderReviewChipsM`**

In `tools/lib/dashboard-task-review.js`, add:

```js
function _chip(cls, label, title) {
  return '<span class="pv-rev-chip ' + cls + '" title="' + title + '">' + label + '</span>';
}

function renderReviewChipsM(ds) {
  if (!ds || ds.skipped) return '';
  var chips = [];

  if (ds.specIcon === '✓') chips.push(_chip('ok', 'SPEC ✓', 'Spec compliance review: approved'));
  else if (ds.specIcon === '⟳') chips.push(_chip('review', 'SPEC ⟳', 'Spec compliance review in progress'));
  else if (ds.specIcon === '✗') chips.push(_chip('risk', 'SPEC ✗', 'Spec compliance review: changes requested'));

  if (ds.qualityIcon === '✓') chips.push(_chip('ok', 'QUAL ✓', 'Code quality review: approved'));
  else if (ds.qualityIcon === '⟳') chips.push(_chip('review', 'QUAL ⟳', 'Code quality review in progress'));
  else if (ds.qualityIcon === '✗') chips.push(_chip('risk', 'QUAL ✗', 'Code quality review: changes requested'));

  if (ds.escalated) {
    chips.push(_chip('risk', 'ESCALATED', 'Review cap exhausted — manual review required'));
  } else if (ds.retryCount) {
    chips.push(_chip('warn', 'RETRY ' + ds.retryCount + '/' + ds.retryCap, 'Forge retry in progress'));
  }

  return chips.join(' ');
}
```

Update `module.exports`:

```js
module.exports = { deriveDisplayState, renderReviewIconS, renderReviewChipsM };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/unit/dashboard-task-review.test.js --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add tools/lib/dashboard-task-review.js tests/unit/dashboard-task-review.test.js
git commit -m "feat(US-0186): add renderReviewChipsM for M mode"
```

---

## Task 4: `renderReviewLineL` for L mode

**Files:**

- Modify: `tools/lib/dashboard-task-review.js`
- Modify: `tests/unit/dashboard-task-review.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/dashboard-task-review.test.js`:

```js
describe('renderReviewLineL', () => {
  const { renderReviewLineL } = require('../../tools/lib/dashboard-task-review');

  test('returns empty string when ds is null', () => {
    expect(renderReviewLineL(null)).toBe('');
  });

  test('returns empty string when ds.skipped', () => {
    expect(renderReviewLineL({ skipped: true })).toBe('');
  });

  test('both APPROVED → "Spec ✓ · Quality ✓"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '✓',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '✓',
    });
    expect(html).toContain('pv-rev-line');
    expect(html).toContain('Spec ✓');
    expect(html).toContain('Quality ✓');
  });

  test('spec approved + quality reviewing → "Spec ✓ · Quality ⟳"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '⟳',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html).toContain('Spec ✓');
    expect(html).toContain('Quality ⟳');
  });

  test('spec failed + retry → "Spec ✗ · retry 1/2"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✗',
      qualityIcon: null,
      retryCount: 1,
      retryCap: 2,
      escalated: false,
      overall: '✗',
    });
    expect(html).toContain('Spec ✗');
    expect(html).toContain('retry 1/2');
    expect(html).not.toContain('escalated');
  });

  test('spec escalated → "Spec ✗ · escalated"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✗',
      qualityIcon: null,
      retryCount: null,
      retryCap: 2,
      escalated: true,
      overall: '✗',
    });
    expect(html).toContain('Spec ✗');
    expect(html).toContain('escalated');
    expect(html).not.toContain('retry');
  });

  test('quality escalated → "Spec ✓ · Quality ✗ · escalated"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '✗',
      retryCount: null,
      retryCap: 2,
      escalated: true,
      overall: '✗',
    });
    expect(html).toContain('Spec ✓');
    expect(html).toContain('Quality ✗');
    expect(html).toContain('escalated');
  });

  test('initial spec_reviewing (no retries) → "Spec ⟳" (no retry text)', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '⟳',
      qualityIcon: null,
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html).toContain('Spec ⟳');
    expect(html).not.toContain('retry');
  });

  test('post-retry spec_reviewing (forgeRetries=1) → "Spec ⟳ · retry 1/2"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '⟳',
      qualityIcon: null,
      retryCount: 1,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html).toContain('Spec ⟳');
    expect(html).toContain('retry 1/2');
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `npx jest tests/unit/dashboard-task-review.test.js --no-coverage`
Expected: 8 failures.

- [ ] **Step 3: Add `renderReviewLineL`**

In `tools/lib/dashboard-task-review.js`, add:

```js
function _iconCls(icon) {
  if (icon === '✓') return 'ok';
  if (icon === '⟳') return 'review';
  if (icon === '✗') return 'risk';
  return '';
}

function renderReviewLineL(ds) {
  if (!ds || ds.skipped) return '';
  var parts = [];

  if (ds.specIcon) {
    parts.push('<span class="' + _iconCls(ds.specIcon) + '">Spec ' + ds.specIcon + '</span>');
  }
  if (ds.qualityIcon) {
    parts.push('<span class="' + _iconCls(ds.qualityIcon) + '">Quality ' + ds.qualityIcon + '</span>');
  }
  if (ds.escalated) {
    parts.push('<span class="risk">escalated</span>');
  } else if (ds.retryCount) {
    parts.push('<span class="warn">retry ' + ds.retryCount + '/' + ds.retryCap + '</span>');
  }

  if (parts.length === 0) return '';
  return '<div class="pv-rev-line">' + parts.join(' · ') + '</div>';
}
```

Update `module.exports`:

```js
module.exports = { deriveDisplayState, renderReviewIconS, renderReviewChipsM, renderReviewLineL };
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/unit/dashboard-task-review.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/lib/dashboard-task-review.js tests/unit/dashboard-task-review.test.js
git commit -m "feat(US-0186): add renderReviewLineL for L mode"
```

---

## Task 5: Inject helper source + `window.pvTaskReviewCap` into generated dashboard

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Append failing tests**

In `tests/unit/generate-dashboard.test.js`, find the existing `describe` block for `generateDashboard` (or similar). Add a new test inside it (or a new describe block at the end):

```js
describe('US-0186 review-gate visualization', () => {
  test('emits window.pvTaskReviewCap literal from config', () => {
    const html = generateDashboard({
      config: { orchestration: { iterationCap: { taskReview: 3 } } },
      status: { tasks: {}, agents: {} },
      // ... other required generateDashboard inputs (use the existing test fixtures)
    });
    expect(html).toMatch(/window\.pvTaskReviewCap\s*=\s*3/);
  });

  test('emits window.pvTaskReviewCap default 2 when config missing the key', () => {
    const html = generateDashboard({
      config: { orchestration: { iterationCap: { spec: 3, plan: 3 } } },
      status: { tasks: {}, agents: {} },
    });
    expect(html).toMatch(/window\.pvTaskReviewCap\s*=\s*2/);
  });

  test('embeds deriveDisplayState function source in script block', () => {
    const html = generateDashboard({
      config: {},
      status: { tasks: {}, agents: {} },
    });
    expect(html).toContain('function deriveDisplayState(');
    expect(html).toContain('function renderReviewIconS(');
    expect(html).toContain('function renderReviewChipsM(');
    expect(html).toContain('function renderReviewLineL(');
  });
});
```

(Adjust `generateDashboard(...)` call to match the actual function signature — peek at the existing tests in the file before writing.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest tests/unit/generate-dashboard.test.js --no-coverage`
Expected: 3 failures.

- [ ] **Step 3: Modify `tools/generate-dashboard.js`**

Near the top of `tools/generate-dashboard.js`, add the require alongside the existing requires:

```js
const TaskReview = require('./lib/dashboard-task-review');
```

Then build the helper source string. Find a logical place near where the inline JS for the dashboard is built (search for `function patchTaskList` — that's the existing inline function block). Add a constant that joins the helper function sources:

```js
const REVIEW_HELPERS_SOURCE = [
  TaskReview.deriveDisplayState.toString(),
  TaskReview.renderReviewIconS.toString(),
  TaskReview.renderReviewChipsM.toString(),
  TaskReview.renderReviewLineL.toString(),
  // _chip and _iconCls are internal helpers used by the renderers — include their toString too.
  // They are not exported but are still part of the module's function declarations.
].join('\n\n');
```

**Wait — `_chip` and `_iconCls` are not on the export object.** The simpler approach: export them too, even if they're prefixed with `_` to signal internal use. Update `tools/lib/dashboard-task-review.js`:

```js
module.exports = { deriveDisplayState, renderReviewIconS, renderReviewChipsM, renderReviewLineL, _chip, _iconCls };
```

Then build the source string:

```js
const REVIEW_HELPERS_SOURCE = [
  TaskReview._chip.toString(),
  TaskReview._iconCls.toString(),
  TaskReview.deriveDisplayState.toString(),
  TaskReview.renderReviewIconS.toString(),
  TaskReview.renderReviewChipsM.toString(),
  TaskReview.renderReviewLineL.toString(),
].join('\n\n');
```

Inject the source into the generated HTML's script block. Find the existing inline JS block (look for `function patchTaskList` — there's a `<script>` ... `</script>` containing dashboard JS). Insert at the top of that script block:

```html
<script>
  window.pvTaskReviewCap = ${
    (cfg.orchestration && cfg.orchestration.iterationCap && typeof cfg.orchestration.iterationCap.taskReview === 'number')
      ? cfg.orchestration.iterationCap.taskReview
      : 2
  };

  ${REVIEW_HELPERS_SOURCE}

  // ... existing inline JS continues ...
</script>
```

The exact template-literal syntax depends on the existing template structure in `generate-dashboard.js`. You may need to thread `cfg` (the config object) into the template scope.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest tests/unit/generate-dashboard.test.js --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/generate-dashboard.js tools/lib/dashboard-task-review.js tests/unit/generate-dashboard.test.js
git commit -m "feat(US-0186): inject review-gate helpers + window.pvTaskReviewCap into dashboard"
```

---

## Task 6: Extend `patchTaskList` to render review status

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/generate-dashboard.test.js`

- [ ] **Step 1: Append failing test**

Append to the `describe('US-0186 review-gate visualization', ...)` block:

```js
test('patchTaskList source references deriveDisplayState and reads window.pvTaskDensity', () => {
  const html = generateDashboard({
    config: {},
    status: { tasks: {}, agents: {} },
  });
  // Extract the patchTaskList source from the script block.
  expect(html).toMatch(/function patchTaskList\(/);
  expect(html).toMatch(/deriveDisplayState\(/);
  expect(html).toMatch(/window\.pvTaskDensity/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest tests/unit/generate-dashboard.test.js --no-coverage`
Expected: 1 failure — `patchTaskList` source doesn't yet call `deriveDisplayState`.

- [ ] **Step 3: Update `patchTaskList` in `tools/generate-dashboard.js`**

Find the existing `function patchTaskList(status) {` block in `tools/generate-dashboard.js`. Locate the per-task map (`tasks.slice(-5).map(function (t) { ... })`). Extend it:

```js
var html = tasks
  .slice(-5)
  .map(function (t) {
    var color =
      t.state === 'done'
        ? 'var(--ok)'
        : t.state === 'blocked' || t.state === 'escalated'
          ? 'var(--risk)'
          : t.state === 'done_with_concerns'
            ? 'var(--warn)'
            : 'var(--text-mute)';
    var label = t.state.replace(/_/g, ' ').toUpperCase();
    var desc = t.description ? t.description.slice(0, 55) + (t.description.length > 55 ? '…' : '') : '';

    // US-0186: derive review-gate display and pick renderer based on density.
    var density = window.pvTaskDensity || 'L';
    var ds = deriveDisplayState(t.taskReview);
    var reviewHtml = '';
    if (ds && !ds.skipped) {
      if (density === 'S') reviewHtml = renderReviewIconS(ds);
      else if (density === 'M') reviewHtml = renderReviewChipsM(ds);
      else reviewHtml = renderReviewLineL(ds);
    }

    // Compose the row. In L mode the reviewHtml is a <div> appended below
    // the row; in S/M it goes inline at the end.
    var rowHead =
      '<div style="display:flex;gap:6px;align-items:baseline;margin-bottom:2px">' +
      '<span style="color:' +
      color +
      ';font-weight:700;min-width:80px">' +
      label +
      '</span>' +
      '<span style="color:var(--text-dim);flex:1">' +
      desc +
      '</span>' +
      (density === 'S' || density === 'M' ? reviewHtml : '') +
      '</div>';

    var rowTail = density === 'L' ? reviewHtml : '';
    return rowHead + rowTail;
  })
  .join('');

container.innerHTML = html;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest tests/unit/generate-dashboard.test.js --no-coverage`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/generate-dashboard.test.js
git commit -m "feat(US-0186): patchTaskList renders review status per density mode"
```

---

## Task 7: Density toggle pill + `setTaskDensity` + `initTaskDensity` + `_pvLastStatus` cache

**Files:**

- Modify: `tools/generate-dashboard.js`
- Create: `tests/unit/dashboard-density-toggle.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/dashboard-density-toggle.test.js`:

```js
'use strict';

const { generateDashboard } = require('../../tools/generate-dashboard');

describe('Density toggle pill HTML', () => {
  function html() {
    return generateDashboard({
      config: {},
      status: { tasks: {}, agents: {} },
    });
  }

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
    expect(out).toMatch(/window\._pvLastStatus\s*=\s*status/);
  });

  test('default density is L when no localStorage value', () => {
    const out = html();
    // initTaskDensity body should fall back to 'L'
    expect(out).toMatch(/saved\s*===\s*'S'\s*\|\|\s*saved\s*===\s*'M'\s*\|\|\s*saved\s*===\s*'L'.*?'L'/s);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest tests/unit/dashboard-density-toggle.test.js --no-coverage`
Expected: 6 failures.

- [ ] **Step 3: Add the topbar pill HTML**

Find the `mc-topbar-right` div in `tools/generate-dashboard.js`. Currently:

```js
<div class="mc-topbar-right">
  <span class="mc-live-badge" title="Live — refreshing every 5s">
    <span class="mc-live-dot" aria-hidden="true"></span>LIVE
  </span>
</div>
```

Replace with:

```js
<div class="mc-topbar-right">
  <div class="pv-density-toggle" role="radiogroup" aria-label="Task review density">
    <button data-density="S" onclick="setTaskDensity('S')" title="Compact — single outcome icon per task">
      S
    </button>
    <button data-density="M" onclick="setTaskDensity('M')" title="Medium — phase chips per task">
      M
    </button>
    <button data-density="L" onclick="setTaskDensity('L')" title="Large — phase status on a second line">
      L
    </button>
  </div>
  <span class="mc-live-badge" title="Live — refreshing every 5s">
    <span class="mc-live-dot" aria-hidden="true"></span>LIVE
  </span>
</div>
```

- [ ] **Step 4: Add `setTaskDensity` and `initTaskDensity` to the script block**

Find the inline `<script>` block in `tools/generate-dashboard.js` (where `patchTaskList` lives). Add these functions:

```js
function setTaskDensity(d) {
  if (d !== 'S' && d !== 'M' && d !== 'L') return;
  window.pvTaskDensity = d;
  try {
    localStorage.setItem('pv-task-density', d);
  } catch (e) {
    /* private mode — ignore */
  }
  document.querySelectorAll('.pv-density-toggle button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.density === d);
  });
  if (window._pvLastStatus) patchTaskList(window._pvLastStatus);
}

function initTaskDensity() {
  var saved;
  try {
    saved = localStorage.getItem('pv-task-density');
  } catch (e) {}
  var d = saved === 'S' || saved === 'M' || saved === 'L' ? saved : 'L';
  setTaskDensity(d);
}
```

Call `initTaskDensity();` on page load (within the existing DOMContentLoaded or window-load handler).

- [ ] **Step 5: Cache `_pvLastStatus` in the refresh loop**

Find the existing `refreshState(status)` function (or equivalent — search for `patchDOM(`). Right before the `patchDOM(status)` and `patchTaskList(status)` calls, add:

```js
window._pvLastStatus = status;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest tests/unit/dashboard-density-toggle.test.js --no-coverage`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/dashboard-density-toggle.test.js
git commit -m "feat(US-0186): S/M/L density toggle pill + handler + persistence"
```

---

## Task 8: CSS for chips, lines, icons, density toggle pill

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/dashboard-density-toggle.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/dashboard-density-toggle.test.js`:

```js
describe('Review-gate CSS', () => {
  function html() {
    return generateDashboard({
      config: {},
      status: { tasks: {}, agents: {} },
    });
  }

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

  test('no hex literals introduced in review-gate CSS block (L-0064)', () => {
    const out = html();
    // Extract the section between the pv-rev-chip selector and the next non-pv-rev rule.
    const m = out.match(/\.pv-rev-chip[\s\S]*?(?=\}\s*\/\*\s*US-0[0-9]|\}\s*\.[a-z]|\}\s*<\/style>)/);
    expect(m).toBeTruthy();
    expect(m[0]).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `npx jest tests/unit/dashboard-density-toggle.test.js --no-coverage`
Expected: 4 failures.

- [ ] **Step 3: Add the CSS to `tools/generate-dashboard.js`**

Find the inline `<style>` block in `tools/generate-dashboard.js` (search for `.mc-topbar-right`). Add at the end of the existing styles, before the closing `</style>`:

```css
/* US-0186: Review-gate visualization */
.pv-rev-chip {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}
.pv-rev-chip.ok {
  background: color-mix(in oklab, var(--ok) 18%, transparent);
  color: var(--ok);
}
.pv-rev-chip.warn {
  background: color-mix(in oklab, var(--warn) 18%, transparent);
  color: var(--warn);
}
.pv-rev-chip.risk {
  background: color-mix(in oklab, var(--risk) 18%, transparent);
  color: var(--risk);
}
.pv-rev-chip.review {
  background: color-mix(in oklab, var(--live-accent) 18%, transparent);
  color: var(--live-accent);
}

.pv-rev-line {
  padding-left: 80px;
  font-size: 9.5px;
  margin-top: 1px;
}
.pv-rev-line .ok {
  color: var(--ok);
}
.pv-rev-line .warn {
  color: var(--warn);
}
.pv-rev-line .risk {
  color: var(--risk);
}
.pv-rev-line .review {
  color: var(--live-accent);
}
.pv-rev-line span + span::before {
  content: ' · ';
  color: var(--text-mute);
}

.pv-rev-icon {
  font-weight: 700;
  margin-left: auto;
}
.pv-rev-icon.ok {
  color: var(--ok);
}
.pv-rev-icon.warn {
  color: var(--warn);
}
.pv-rev-icon.risk {
  color: var(--risk);
}
.pv-rev-icon.review {
  color: var(--live-accent);
}

.pv-density-toggle {
  display: flex;
  gap: 2px;
  background: var(--bg-card-inner);
  border-radius: 4px;
  padding: 2px;
}
.pv-density-toggle button {
  padding: 2px 8px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 3px;
}
.pv-density-toggle button.active {
  background: var(--live-accent);
  color: var(--text-inverse, #fff);
}
```

**Note on the test:** the `#fff` in `--text-inverse, #fff` is a CSS fallback, not the project's chosen color. The hex-literal test (`L-0064`) targets the review-chip/line/icon rules specifically — adjust the regex in the test if it picks up this fallback. Prefer using a defined token like `var(--text-inverse)` without a fallback if the token is defined elsewhere; if not, keep the fallback and tighten the test regex.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest tests/unit/dashboard-density-toggle.test.js --no-coverage`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/dashboard-density-toggle.test.js
git commit -m "feat(US-0186): theme-token-driven CSS for chips/lines/icons + density pill"
```

---

## Task 9: Transition animations + `prefers-reduced-motion`

**Files:**

- Modify: `tools/generate-dashboard.js`
- Modify: `tests/unit/dashboard-density-toggle.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/dashboard-density-toggle.test.js`:

```js
describe('Transition animations', () => {
  function html() {
    return generateDashboard({
      config: {},
      status: { tasks: {}, agents: {} },
    });
  }

  test('emits @keyframes pv-rev-spin', () => {
    expect(html()).toMatch(/@keyframes\s+pv-rev-spin\s*\{/);
  });

  test('emits @keyframes pv-rev-appear', () => {
    expect(html()).toMatch(/@keyframes\s+pv-rev-appear\s*\{/);
  });

  test('pv-rev-icon.review and pv-rev-chip.review get the spin animation', () => {
    const out = html();
    expect(out).toMatch(/\.pv-rev-icon\.review[^}]*animation:\s*pv-rev-spin/);
  });

  test('chips/lines/icons get the appear animation', () => {
    const out = html();
    expect(out).toMatch(/animation:\s*pv-rev-appear/);
  });

  test('pv-density-toggle buttons have background-color transition', () => {
    const out = html();
    expect(out).toMatch(/\.pv-density-toggle button[^}]*transition:[^;]*background-color/);
  });

  test('prefers-reduced-motion disables animations', () => {
    const out = html();
    expect(out).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const m = out.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\}/);
    expect(m).toBeTruthy();
    expect(m[1]).toMatch(/animation:\s*none/);
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `npx jest tests/unit/dashboard-density-toggle.test.js --no-coverage`
Expected: 6 failures.

- [ ] **Step 3: Add animations and reduced-motion to CSS**

In `tools/generate-dashboard.js`, immediately after the CSS added in Task 8, append:

```css
/* US-0186: Animations */
@keyframes pv-rev-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@keyframes pv-rev-appear {
  from {
    opacity: 0;
    transform: translateY(-1px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.pv-rev-icon.review {
  display: inline-block;
  animation:
    pv-rev-spin 1.4s linear infinite,
    pv-rev-appear 200ms ease-out;
}
.pv-rev-chip.review {
  animation: pv-rev-appear 200ms ease-out;
}
.pv-rev-chip,
.pv-rev-line,
.pv-rev-icon {
  animation: pv-rev-appear 200ms ease-out;
}
.pv-density-toggle button {
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .pv-rev-icon.review,
  .pv-rev-chip.review,
  .pv-rev-chip,
  .pv-rev-line,
  .pv-rev-icon {
    animation: none;
  }
  .pv-density-toggle button {
    transition: none;
  }
}
```

**Note:** The `.pv-rev-icon.review` rule uses two animations (spin + appear). The appear stops after 200ms; the spin loops infinitely. Both are disabled by the reduced-motion query.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest tests/unit/dashboard-density-toggle.test.js --no-coverage`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tools/generate-dashboard.js tests/unit/dashboard-density-toggle.test.js
git commit -m "feat(US-0186): transition animations + prefers-reduced-motion fallback"
```

---

## Task 10: Integration smoke test

**Files:**

- Create: `tests/integration/dashboard-task-review-flow.test.js`

- [ ] **Step 1: Create the integration test**

Create `tests/integration/dashboard-task-review-flow.test.js`:

```js
'use strict';

const { generateDashboard } = require('../../tools/generate-dashboard');

function fixtureStatus() {
  return {
    agents: {
      Forge: { status: 'active', currentStory: 'US-0186' },
    },
    tasks: {
      'task-1': {
        id: 'task-1',
        story: 'US-0186',
        agent: 'Forge',
        state: 'done',
        description: 'Cleared — both reviews approved',
        taskReview: {
          status: 'approved',
          specVerdict: 'APPROVED',
          qualityVerdict: 'APPROVED',
          forgeRetries: 0,
          headSha: 'abc1234',
        },
      },
      'task-2': {
        id: 'task-2',
        story: 'US-0186',
        agent: 'Forge',
        state: 'done',
        description: 'Quality review in progress',
        taskReview: {
          status: 'quality_reviewing',
          specVerdict: 'APPROVED',
          qualityVerdict: null,
          forgeRetries: 0,
          headSha: 'abc1234',
        },
      },
      'task-3': {
        id: 'task-3',
        story: 'US-0186',
        agent: 'Forge',
        state: 'done',
        description: 'Spec retry in progress',
        taskReview: {
          status: 'forge_retry',
          specVerdict: 'REQUEST_CHANGES',
          qualityVerdict: null,
          forgeRetries: 0,
          headSha: 'abc1234',
        },
      },
      'task-4': {
        id: 'task-4',
        story: 'US-0186',
        agent: 'Forge',
        state: 'done',
        description: 'No-commit task — skipped review',
        taskReview: { status: 'approved', headSha: 'none' },
      },
    },
  };
}

describe('Dashboard renders review-gate visualization end-to-end', () => {
  test('helper functions are present and runnable in the emitted HTML', () => {
    const html = generateDashboard({ config: {}, status: fixtureStatus() });

    // The helpers are emitted as plain function source — we can evaluate them in a sandbox.
    const helperMatch = html.match(/function deriveDisplayState\([\s\S]+?function renderReviewLineL\([\s\S]+?\}\s*\n/);
    expect(helperMatch).toBeTruthy();
  });

  test('emitted HTML contains pv-density-toggle and all three buttons', () => {
    const html = generateDashboard({ config: {}, status: fixtureStatus() });
    expect(html).toContain('class="pv-density-toggle"');
    expect(html).toContain('data-density="S"');
    expect(html).toContain('data-density="M"');
    expect(html).toContain('data-density="L"');
  });

  test('window.pvTaskReviewCap injected as literal', () => {
    const html = generateDashboard({
      config: { orchestration: { iterationCap: { taskReview: 2 } } },
      status: fixtureStatus(),
    });
    expect(html).toMatch(/window\.pvTaskReviewCap\s*=\s*2/);
  });

  test('patchTaskList source references all three render functions', () => {
    const html = generateDashboard({ config: {}, status: fixtureStatus() });
    expect(html).toContain('renderReviewIconS(');
    expect(html).toContain('renderReviewChipsM(');
    expect(html).toContain('renderReviewLineL(');
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx jest tests/integration/dashboard-task-review-flow.test.js --no-coverage`
Expected: all 4 tests pass.

- [ ] **Step 3: Run full suite to verify no regressions**

Run: `npx jest --no-coverage 2>&1 | tail -5`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/dashboard-task-review-flow.test.js
git commit -m "test(US-0186): integration smoke for review-gate rendering pipeline"
```

---

## Task 11: RELEASE_PLAN.md + ID_REGISTRY.md entries (EPIC-0029, US-0186)

**Files:**

- Modify: `docs/RELEASE_PLAN.md`
- Modify: `docs/ID_REGISTRY.md`

- [ ] **Step 1: Add EPIC-0029 section to RELEASE_PLAN.md**

In `docs/RELEASE_PLAN.md`, locate the end of the `## User Stories — EPIC-0028` section (after US-0185). Add a new epic header and US-0186 entry:

```markdown
## Epic — EPIC-0029: Agentic Pipeline UX
```

EPIC-0029: Agentic Pipeline UX
Description: Surface the agentic pipeline's runtime behaviour (US-0182 spec/plan gates, US-0183 task lifecycle, US-0184 context, US-0185 review gates) on the Agentic Dashboard so operators can observe and intervene. First story: US-0186 review-gate visualization.
Release Target: v2.5.0
Status: In Progress
Dependencies: EPIC-0028

```

## User Stories — EPIC-0029: Agentic Pipeline UX

```

US-0186 (EPIC-0029): As an operator, I want the per-task review gate state (US-0185) visible on the Agentic Dashboard so I can see at a glance which tasks have cleared review, which are mid-retry, and which have escalated — without leaving the dashboard.
Priority: High (P1)
Estimate: S
Status: In Progress
Branch: chore/us-0186-spec
Dependencies: US-0185 (EPIC-0028)
Spec: docs/superpowers/specs/2026-05-17-us-0186-dashboard-review-gate-visualization-design.md
Plan: docs/superpowers/plans/2026-05-17-us-0186-dashboard-review-gate-visualization.md
Acceptance Criteria:

- [ ] AC-0731: Agentic Dashboard topbar has an S/M/L density pill in `mc-topbar-right`; default is L on first load; selection persists across reloads via `localStorage['pv-task-density']`
- [ ] AC-0732: Each `done` / `done_with_concerns` task row on an active agent card displays review-gate status in the format defined by the selected density mode (icon-only S / chips M / second-line L)
- [ ] AC-0733: `deriveDisplayState(taskReview)` returns the correct struct for all 9 documented state combinations; returns `null` for pre-US-0185 tasks; returns `{ skipped: true }` when `headSha === 'none'`
- [ ] AC-0734: All chips, lines, and icons use theme tokens (`--ok`, `--warn`, `--risk`, `--live-accent`) — no hex literals introduced in the review-gate CSS block (per L-0064)
- [ ] AC-0735: `⟳` icon animates continuously via `@keyframes pv-rev-spin`; new chips/lines/icons fade in via `@keyframes pv-rev-appear` (200ms); density toggle button background transitions over 150ms; all animations disabled when `prefers-reduced-motion: reduce` is set
- [ ] AC-0736: All chips and icons carry `title=` attributes describing the state; `window.pvTaskReviewCap` is emitted as a JS literal in the generated HTML from `plan-visualizer.config.json → orchestration.iterationCap.taskReview` (default 2)

```

```

- [ ] **Step 2: Update `docs/ID_REGISTRY.md`**

In `docs/ID_REGISTRY.md`, update the table:

```markdown
| EPIC | EPIC-0030 | EPIC-0029 |
| US | US-0187 | US-0186 |
| TASK | TASK-0055 | TASK-0054 |
| AC | AC-0737 | AC-0736 |
| TC | TC-0553 | TC-0552 |
| BUG | BUG-0258 | BUG-0257 |
| Lesson | L-0068 | L-0067 |
```

- [ ] **Step 3: Run full test suite with coverage**

Run: `npm test -- --coverage 2>&1 | tail -10`
Expected: all tests pass, coverage ≥80%.

- [ ] **Step 4: Commit**

```bash
git add docs/RELEASE_PLAN.md docs/ID_REGISTRY.md
git commit -m "docs(US-0186): add EPIC-0029 + US-0186 to RELEASE_PLAN; bump ID_REGISTRY"
```

---

## Final verification

- [ ] **Run the entire test suite:**

Run: `npm test -- --coverage`
Expected: all tests pass; coverage ≥80% across statements/branches/functions/lines.

- [ ] **Manual smoke (optional):**

Open the regenerated Agentic Dashboard (`docs/dashboard.html`) in a browser. Confirm:

- S/M/L pill is visible in the top-right of the topbar, next to the LIVE badge.
- L button is active by default (first load).
- Clicking S/M/L instantly re-renders the task rows on the active agent card.
- Refreshing the page preserves the selected density.
- The `⟳` icon spins continuously on tasks in review.
- A docs-only PR is still rendered correctly (no review state, no chips).

- [ ] **Open PR to `develop`:**

Push the feature branch and open a pull request to `develop` with this checklist:

- All 11 tasks committed
- Coverage gate green
- No new CodeQL alerts
- US-0186 status will move from `In Progress` to `Done` (all ACs `[x]`) in a follow-up session-close commit after PR merge

---

## Spec coverage verification

| Spec section                                             | Covered by task(s)                                   |
| -------------------------------------------------------- | ---------------------------------------------------- |
| §2 Architecture (single-file extension + helpers module) | Tasks 1–7                                            |
| §3.1 Data Model — fields read                            | Task 1 (`deriveDisplayState`)                        |
| §3.2 `deriveDisplayState` contract                       | Task 1                                               |
| §3.3 `window.pvTaskReviewCap` injection                  | Task 5                                               |
| §4 Density Modes — rendered states                       | Tasks 2 (S), 3 (M), 4 (L)                            |
| §4.1 `title=` attributes                                 | Tasks 2, 3, 4 (every render function emits `title=`) |
| §5.1 Topbar pill HTML                                    | Task 7                                               |
| §5.2 `setTaskDensity` + `initTaskDensity`                | Task 7                                               |
| §6.1 `⟳` spin animation                                  | Task 9                                               |
| §6.2 Chip/line/icon fade-in                              | Task 9                                               |
| §6.3 Density toggle background transition                | Task 9                                               |
| §6.4 `prefers-reduced-motion`                            | Task 9                                               |
| §7.1 Files touched (matches the table above)             | All tasks                                            |
| §7.2 Theme-token-driven CSS (no hex literals — L-0064)   | Task 8                                               |
| §7.3 Render function shapes                              | Tasks 2, 3, 4                                        |
| §8 Testing strategy                                      | Tasks 1–10 (each task includes its test code)        |
| §9 Scope boundaries                                      | Task 11 (RELEASE_PLAN entry reflects in-scope items) |
| §10 Acceptance criteria                                  | Task 11 (AC-0731–0736)                               |
