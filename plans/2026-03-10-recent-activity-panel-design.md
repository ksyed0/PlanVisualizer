# Recent Activity Panel — Design Document

**Date:** 2026-03-10
**Status:** Approved
**Feature:** Collapsible right-side panel for Recent Activity

---

## Goal

Move the Recent Activity section from a floating bottom-right widget into a full-height collapsible right-side panel that spans the entire page alongside all content including the top bar, filter bar, and tab bar.

---

## Layout

**Approach:** Fixed right panel + body padding-right (Option A)

The panel uses `position: fixed; right: 0; top: 0; height: 100vh`. The `<body>` receives `padding-right` equal to the panel width so tab content is never obscured. Both the panel width and body padding transition simultaneously via CSS `transition: width 0.25s ease` and an inline style update via JS.

No restructuring of existing layout functions is required.

---

## Dimensions

| State     | Panel width | Body padding-right |
|-----------|-------------|-------------------|
| Expanded  | 280px       | 280px             |
| Collapsed | 40px        | 40px              |

---

## Expanded State

- White background, left border `border-l border-slate-200`, shadow
- Header row: "Recent Activity" label (left) + collapse button ◀ (right)
- Activity list: scrollable `overflow-y-auto`, date + summary per item
- `print:hidden` class retained

## Collapsed State

- 40px-wide strip, same background and border
- Expand button ▶ at top of strip
- Vertical "Recent Activity" label below button, centered in strip
  - CSS: `writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap`

---

## Default & Persistence

- Default: **expanded** on first load
- State key: `localStorage.getItem('activityPanelCollapsed')`
- On load: read state and apply immediately (no flash)

---

## Implementation Scope

Only two functions in `tools/lib/render-html.js` change:

| Function | Change |
|----------|--------|
| `renderRecentActivity(data)` | Replace fixed bottom-right widget with full-height fixed right panel; add toggle button, collapsed-state strip |
| `renderScripts(data)` | Add `toggleActivityPanel()` JS function; add `initActivityPanel()` called on DOMContentLoaded to restore localStorage state |
| `renderPrintCSS()` | Ensure `.activity-panel` is hidden on print |

One unit test in `tests/unit/render-html.test.js` needs updating to match new HTML structure.

---

## No-Change Scope

- All other `render*` functions: untouched
- Tab bar, filter bar, top bar, tab content: no changes
- `generate-plan.js`: no changes
