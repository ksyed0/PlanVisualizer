# EPIC-0011: Global Search — Design Spec

**Date:** 2026-04-07  
**Stories:** US-0069, US-0070, US-0071, US-0072  
**Status:** Approved

---

## Context

The PlanVisualizer dashboard is a single-page static HTML file with multiple tabs (Hierarchy, Bugs, Lessons, Trends, Costs, etc.). As the project grows, finding a specific story, bug, or lesson requires knowing which tab it lives in and scrolling through potentially long lists. EPIC-0011 adds a global search that lets users jump directly to any item by ID or keyword, across all tabs, without leaving the current view.

---

## Entry Point & Trigger

### Desktop

An **adaptive pill button** sits in the topbar between the project title and the About button, displaying `🔍 ⌘K`. Two ways to open the modal:

- Press `⌘K` (Mac) / `Ctrl+K` (Windows/Linux)
- Click the pill button

### Mobile (`< 640px`)

The pill collapses to a `🔍` icon-only. Tapping it opens the same modal. No floating action button or separate mobile UI.

### Modal behaviour

- Opens with the search input auto-focused
- `Escape` or clicking the backdrop closes it with no navigation
- Reopening the modal clears the previous query and restores the recent searches state

---

## Modal Layout

**Size:** `560px` wide on desktop, `92vw` on mobile. Anchored at `top: 20vh`, centered horizontally, with a dark semi-transparent backdrop.

**Structure:**

```
┌──────────────────────────────────────────────┐
│  🔍  [search input]              ESC to close │
├──────────────────────────────────────────────┤
│  STORIES                                      │  ← section header (hidden if 0 results)
│    📋  US-0031 · authentication flow…          │  ← auto-highlighted first row
│    📋  US-0019 · OAuth auth provider…         │
├──────────────────────────────────────────────┤
│  BUGS                                         │
│    🐛  BUG-0015 · Auth redirect fails…        │
├──────────────────────────────────────────────┤
│  LESSONS                                      │
│    💡  L-0007 · Always validate auth…         │
├──────────────────────────────────────────────┤
│       ↑↓ navigate  ·  ↵ jump  ·  ESC close   │  ← hint bar
└──────────────────────────────────────────────┘
```

**Result rows** show: type icon · matched text with `<strong>` on matched characters · sub-label (epic ID for stories, severity for bugs, lesson ID only for lessons).

**Max results:** 4 stories, 4 bugs, 3 lessons (11 total). Modal body scrolls if content overflows.

**Groups with zero matches** are hidden entirely — no empty section headers shown.

---

## Empty & No-Results States

**Empty input (focused):** Shows a "Recent Searches" section with up to 5 clickable pills and a `× Clear` link (US-0072). No section headers shown.

**No results:** Single centred message — `No results for "xyz"`.

---

## Keyboard Navigation

| Key       | Action                                                      |
| --------- | ----------------------------------------------------------- |
| `↑` / `↓` | Move highlight cursor through results (wraps across groups) |
| `Enter`   | Navigate to the highlighted result                          |
| `Escape`  | Close modal, no navigation                                  |

The first result row is auto-highlighted when results appear, so `Enter` always works immediately.

---

## Post-Navigation Behaviour

When a result is selected (click or Enter):

1. Modal closes immediately
2. `showTab(tabName)` switches to the correct tab
3. If the item is inside a collapsed epic section, `toggleSection()` expands it
4. After a 50ms delay, `el.scrollIntoView({ behavior: 'smooth', block: 'center' })` centres the item
5. CSS class `search-highlight` is added — a blue ring (`outline: 2px solid rgba(96,165,250,0.5)`) that fades out over 1.5s via `@keyframes`, then the class is removed via an `animationend` listener
6. The search query is saved to `localStorage['recentSearches']` (max 5, deduped, newest first)

**Story DOM IDs:** Stories currently have no per-item DOM IDs. This implementation adds `id="story-${story.id}"` to story `<tr>` rows (column view) and outermost card `<div>` (card view) as part of this work.

---

## Search Index

**New file: `tools/lib/search-index.js`** — exports `buildSearchIndex(data)` and `scoreMatch(entry, query)` as pure functions. This keeps them unit-testable independently of the HTML renderer.

`render-html.js` requires this module and calls `buildSearchIndex(data)` to embed `window.SEARCH_INDEX = [...]` in the generated HTML. No runtime fetch, no external dependencies.

**Entry shapes:**

```js
// Story
{ type: 'story', id: 'US-0031', title: 'Authentication flow redesign',
  epicId: 'EPIC-0004', status: 'In Progress',
  tabName: 'hierarchy', domId: 'story-US-0031' }

// Bug
{ type: 'bug', id: 'BUG-0015', title: 'Auth redirect fails on mobile',
  severity: 'High', status: 'Open',
  tabName: 'bugs', domId: 'bug-row-BUG-0015' }

// Lesson
{ type: 'lesson', id: 'L-0007', rule: 'Always validate auth tokens server-side',
  tabName: 'lessons', domIdCol: 'lesson-col-L-0007', domIdCard: 'lesson-card-L-0007' }
```

All strings pass through `esc()` before JSON embedding to prevent XSS.

**Scope:** Stories, bugs, and lessons only. Test cases are not indexed (not specified in ACs).

---

## Scoring & Matching

No external libraries. Pure client-side JS, runs against `window.SEARCH_INDEX` on each debounced input (200ms).

| Score | Condition                                                 |
| ----- | --------------------------------------------------------- |
| 4     | Exact ID match (`entry.id.toLowerCase() === query`)       |
| 3     | Any indexed field starts with query                       |
| 2     | Any indexed field contains query (substring)              |
| 1     | Fuzzy character-sequence match across concatenated fields |
| 0     | No match — excluded from results                          |

Results within each group sorted by score descending. Groups with all-zero scores are hidden.

---

## Implementation Scope

**Files changed:**

- **`tools/lib/search-index.js`** (new) — `buildSearchIndex(data)` and `scoreMatch(entry, query)`
- **`tools/lib/render-html.js`** — all HTML/CSS/JS changes:
  1. `require('./search-index')` and embed `window.SEARCH_INDEX` via `buildSearchIndex(data)`
  2. Add `id="story-${story.id}"` to story rows (column view `<tr>` and card view outermost `<div>`)
  3. Add adaptive pill button to topbar HTML
  4. Add modal HTML (hidden by default via `display:none`)
  5. Add `search-highlight` CSS `@keyframes` animation
  6. Add client-side JS: `openSearch()`, `closeSearch()`, `runSearch(q)`, `navigateTo(entry)`, recent searches helpers, `⌘K`/`Ctrl+K` global listener, backdrop click listener, `↑↓↵` keyboard handler

**RELEASE_PLAN.md:** Mark US-0069, US-0070, US-0071, US-0072 as `Done`, check all ACs.

---

## Testing

**New file:** `tools/lib/__tests__/search-index.test.js` — tests `buildSearchIndex` and `scoreMatch` imported from `tools/lib/search-index.js`

| Test                                                                | Covers   |
| ------------------------------------------------------------------- | -------- |
| `buildSearchIndex` returns entries for all stories, bugs, lessons   | US-0069  |
| Story entry has correct `type`, `id`, `epicId`, `tabName`, `domId`  | US-0069  |
| Bug entry has correct `severity`, `domId` format `bug-row-BUG-XXXX` | US-0069  |
| Lesson entry has correct `domIdCol` and `domIdCard`                 | US-0069  |
| Titles containing `<script>` are HTML-escaped                       | Security |
| `scoreMatch` exact ID → 4                                           | US-0070  |
| `scoreMatch` starts-with → 3                                        | US-0071  |
| `scoreMatch` substring → 2                                          | US-0071  |
| `scoreMatch` fuzzy → 1                                              | US-0071  |
| `scoreMatch` no match → 0                                           | US-0071  |
| `scoreMatch` empty query → -1                                       | US-0069  |

Coverage gate: overall ≥ 80%.

---

## Verification Checklist

1. `node tools/generate-plan.js` — no errors
2. Open `docs/plan-status.html`:
   - Topbar shows `🔍 ⌘K` pill on desktop; shrinks to `🔍` at narrow width
   - Click pill → modal opens, input focused
   - Type `US-0042` → single result; press Enter → navigates to story, blue ring fades
   - Type `bug auth` → Bugs group shows matching results
   - Type `xyz999` → "No results for…" message shown
   - Type `stor` → fuzzy-matched stories appear, matched chars bolded
   - Navigate 5 times → recent searches pills appear on next open
   - Click `× Clear` → recent searches cleared
   - Press Escape → modal closes, no navigation
   - `⌘K` shortcut opens modal
3. Resize to `< 640px` → pill shows icon only; tap → modal opens
4. `npx jest --coverage` — all tests pass, coverage ≥ 80%
