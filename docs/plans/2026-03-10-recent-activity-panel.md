# Recent Activity Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the floating bottom-right Recent Activity widget with a full-height fixed right panel that collapses to a 40px strip with a vertical label.

**Architecture:** The panel uses `position: fixed; right: 0; top: 0; height: 100vh`. Body gets `padding-right: 280px` by default so tab content is never obscured. JS toggles both width and padding together. State persists in `localStorage`. Only `renderRecentActivity()`, `renderScripts()`, and `renderPrintCSS()` in `tools/lib/render-html.js` change — no other functions are touched.

**Tech Stack:** Vanilla JS, Tailwind CSS (CDN), inline CSS for transition and writing-mode

---

### Task 1: Update the unit test first (TDD)

**Files:**
- Modify: `tests/unit/render-html.test.js`

**Step 1: Read the existing traceability test block**

Open `tests/unit/render-html.test.js` and find the block:
```
describe('renderHtml — no recent activity', () => {
```
This test currently checks `expect(html).not.toMatch(/Recent Activity/)` when `recentActivity` is empty — that behaviour is unchanged, so it will still pass.

**Step 2: Add new tests for the panel structure**

After the existing `renderHtml — no recent activity` block, add:

```js
describe('renderHtml — recent activity panel', () => {
  it('renders full-height panel with activity items', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/id="activity-panel"/);
    expect(html).toMatch(/id="activity-expanded"/);
    expect(html).toMatch(/id="activity-collapsed"/);
    expect(html).toMatch(/toggleActivityPanel/);
  });

  it('panel starts at 280px width by default', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/width:280px/);
    expect(html).toMatch(/padding-right:\s*280px/);
  });

  it('collapsed strip contains vertical label text', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/writing-mode:vertical-rl/);
    expect(html).toMatch(/initActivityPanel/);
  });
});
```

**Step 3: Run tests to confirm new tests fail**

```bash
npm test -- --testPathPattern=render-html
```
Expected: 3 new tests FAIL (panel structure not implemented yet), all existing tests pass.

---

### Task 2: Rewrite `renderRecentActivity()`

**Files:**
- Modify: `tools/lib/render-html.js` — `renderRecentActivity` function (lines ~388–398)

**Step 1: Replace the function body**

Find the existing function:
```js
function renderRecentActivity(data) {
  if (!data.recentActivity.length) return '';
  const items = data.recentActivity.map(a =>
    `<li class="text-sm"><span class="text-slate-400 text-xs mr-2">${a.date}</span>${a.summary}</li>`
  ).join('');
  return `
  <div class="fixed bottom-4 right-4 w-80 bg-white border border-slate-200 rounded-lg shadow-lg p-4 print:hidden">
    <h4 class="text-xs font-semibold text-slate-500 uppercase mb-2">Recent Activity</h4>
    <ul class="space-y-1">${items}</ul>
  </div>`;
}
```

Replace with:
```js
function renderRecentActivity(data) {
  if (!data.recentActivity.length) return '';
  const items = data.recentActivity.map(a =>
    `<li class="py-2 border-b border-slate-100 last:border-0">
      <span class="text-xs text-slate-400 block">${a.date}</span>
      <span class="text-sm text-slate-700">${a.summary}</span>
    </li>`
  ).join('');
  return `
  <div id="activity-panel" class="activity-panel fixed top-0 right-0 h-screen bg-white border-l border-slate-200 shadow-lg flex flex-col" style="width:280px;z-index:50;transition:width 0.25s ease">
    <div id="activity-expanded" class="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
      <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent Activity</h4>
      <button onclick="toggleActivityPanel()" class="text-slate-400 hover:text-slate-700 leading-none px-1" title="Collapse">&#9664;</button>
    </div>
    <ul id="activity-list" class="flex-1 overflow-y-auto px-4 py-2">${items}</ul>
    <div id="activity-collapsed" class="hidden flex-col items-center pt-3 pb-4 gap-3">
      <button onclick="toggleActivityPanel()" class="text-slate-400 hover:text-slate-700 leading-none px-1" title="Expand">&#9654;</button>
      <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide select-none" style="writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap">Recent Activity</span>
    </div>
  </div>`;
}
```

**Step 2: Run tests**

```bash
npm test -- --testPathPattern=render-html
```
Expected: the 3 new panel tests now pass. All 121 tests pass.

---

### Task 3: Add JS to `renderScripts()`

**Files:**
- Modify: `tools/lib/render-html.js` — `renderScripts` function

**Step 1: Find the closing of the `<script>` block**

Inside `renderScripts`, the template string ends with:
```js
  function clearFilters() {
    ['f-epic','f-status','f-priority','f-type'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-search').value = '';
    applyFilters();
  }
  </script>`;
```

**Step 2: Add the two new functions before `</script>`**

Replace:
```js
  </script>`;
```
With:
```js
  function toggleActivityPanel() {
    const panel = document.getElementById('activity-panel');
    if (!panel) return;
    const isCollapsed = panel.style.width === '40px';
    const expanded = document.getElementById('activity-expanded');
    const list = document.getElementById('activity-list');
    const collapsed = document.getElementById('activity-collapsed');
    if (isCollapsed) {
      panel.style.width = '280px';
      document.body.style.paddingRight = '280px';
      expanded.classList.remove('hidden');
      list.classList.remove('hidden');
      collapsed.classList.add('hidden');
      collapsed.classList.remove('flex');
      localStorage.setItem('activityPanelCollapsed', 'false');
    } else {
      panel.style.width = '40px';
      document.body.style.paddingRight = '40px';
      expanded.classList.add('hidden');
      list.classList.add('hidden');
      collapsed.classList.remove('hidden');
      collapsed.classList.add('flex');
      localStorage.setItem('activityPanelCollapsed', 'true');
    }
  }

  function initActivityPanel() {
    const panel = document.getElementById('activity-panel');
    if (!panel) return;
    document.body.style.transition = 'padding-right 0.25s ease';
    document.body.style.paddingRight = '280px';
    if (localStorage.getItem('activityPanelCollapsed') === 'true') {
      panel.style.width = '40px';
      document.body.style.paddingRight = '40px';
      document.getElementById('activity-expanded').classList.add('hidden');
      document.getElementById('activity-list').classList.add('hidden');
      const collapsed = document.getElementById('activity-collapsed');
      collapsed.classList.remove('hidden');
      collapsed.classList.add('flex');
    }
  }

  document.addEventListener('DOMContentLoaded', initActivityPanel);
  </script>`;
```

**Step 3: Run tests**

```bash
npm test -- --testPathPattern=render-html
```
Expected: all 121 tests pass.

---

### Task 4: Update `renderPrintCSS()` and body default padding

**Files:**
- Modify: `tools/lib/render-html.js` — `renderPrintCSS` and `renderHtml`

**Step 1: Add `.activity-panel` to print CSS**

In `renderPrintCSS()`, find:
```js
    #filter-bar, #tab-bar, .fixed { display: none !important; }
```
Replace with:
```js
    #filter-bar, #tab-bar, .fixed, .activity-panel { display: none !important; }
    body { padding-right: 0 !important; }
```

**Step 2: Add body default padding-right**

In `renderHtml()`, find:
```js
<body class="bg-slate-50 min-h-screen">
```
Replace with:
```js
<body class="bg-slate-50 min-h-screen" style="padding-right:280px">
```
This ensures correct layout before JS runs (no flash of unpadded content).

**Step 3: Run all tests**

```bash
npm test
```
Expected: 9 suites, 121 tests — all pass.

---

### Task 5: Verify output and commit

**Step 1: Generate the dashboard**

```bash
node tools/generate-plan.js
```
Expected:
```
[generate-plan] Done. 5 epics, 22 stories, 23 TCs, 0 bugs.
```

**Step 2: Open the generated file**

```bash
open docs/plan-status.html
```
Verify:
- Right panel is visible and expanded by default
- Click ◀ → panel collapses to 40px strip with vertical "Recent Activity" label
- Click ▶ → panel re-expands
- Reload page → panel state is preserved from localStorage
- Tab content does not go under the panel

**Step 3: Commit**

```bash
git add tools/lib/render-html.js tests/unit/render-html.test.js
git commit -m "feat: replace floating activity widget with collapsible right panel

Fixed full-height right panel (280px expanded, 40px collapsed).
Toggle button collapses to vertical 'Recent Activity' label strip.
Default expanded; state persisted in localStorage."
```

**Step 4: Push**

```bash
git push origin main
```
