# UI Redesign — Design Spec (US-0048)

**Date:** 2026-03-29
**Branch:** `feature/US-0048-ui-redesign-sidebar`
**Epic:** EPIC-0007 — Visual Design Overhaul
**Status:** Approved

---

## Problem

The current dashboard has six identified UI weaknesses:

1. **Header** — Blue gradient feels generic; doesn't match the neutral dark palette of the rest of the UI.
2. **Navigation** — 7 horizontal tabs crowd on small screens; no screen-reader semantics.
3. **Kanban** — Column headers scroll out of view; no per-column scroll zone.
4. **Stats Tiles** — Only 3 tiles (Projected, AI Actual, Coverage); misses In Progress count and open bugs.
5. **Typography & Density** — Mixed font sizing; no consistent rule for UI copy vs. metrics/IDs.
6. **Accessibility** — No ARIA roles, no `aria-current`, some colour contrast gaps.

---

## Scope

Shell-only changes. No tab content altered (Hierarchy, Traceability, Charts, Costs, Bugs, Lessons panels stay identical). Changes are entirely within `tools/lib/render-html.js`.

---

## Design Decisions

### Navigation

- **Desktop (≥1024px):** Vertical `<aside>` sidebar, 200px wide, with inline SVG icon + full label per item.
- **Tablet portrait / unfolded foldable (768–1023px):** 160px sidebar, same icons, abbreviated labels (11px).
- **Phone landscape / folded foldable (480–767px):** 44px icon-only sidebar.
- **Phone portrait (<480px):** 44px icon-only sidebar; topbar wraps to 2 rows; only 3 stat chips shown.
- **Mobile nav behaviour:** Tap icon → navigate directly. No drawer, no tooltip.
- **Foldable unfolded:** `@media (horizontal-viewport-segments: 2)` ensures layout spans both segments.
- **Phone landscape compact topbar:** `@media (max-height: 500px) and (orientation: landscape)` reduces topbar to 40px.

### Topbar

- Replaces blue gradient (`linear-gradient(135deg, #003087 …)`) with `var(--clr-topbar-bg)` + bottom border + subtle shadow.
- Retains: project name, tagline, commit SHA, theme toggle, About button.
- **5 stat chips** (replacing 3 tiles):

| Chip        | Content                  | Responsive       |
| ----------- | ------------------------ | ---------------- |
| Stories     | `done / total`           | Always visible   |
| In Progress | `N` stories              | Always visible   |
| Bugs Open   | `N` (conditional colour) | Always visible   |
| Coverage    | `97.5%`                  | Hidden on <480px |
| AI Cost     | `$218.40` (mono font)    | Hidden on <480px |

- **Bug chip colour logic:**
  - Red (`text-red-400`): 1+ Critical or High severity open bugs
  - Amber (`text-amber-400`): only Medium/Low open bugs
  - Muted (`text-slate-400`): 0 open bugs

### Colour Palette

#### Dark mode (`html.dark`)

| Token                  | Value     |
| ---------------------- | --------- |
| `--clr-bg`             | `#0f172a` |
| `--clr-surface`        | `#1e293b` |
| `--clr-content`        | `#111827` |
| `--clr-border`         | `#334155` |
| `--clr-sidebar-bg`     | `#1e293b` |
| `--clr-topbar-bg`      | `#0f172a` |
| `--clr-accent`         | `#8b5cf6` |
| `--clr-text-primary`   | `#f1f5f9` |
| `--clr-text-secondary` | `#94a3b8` |
| `--clr-text-muted`     | `#64748b` |

#### Light mode (`:root`)

| Token                  | Value     |
| ---------------------- | --------- |
| `--clr-bg`             | `#f1f5f9` |
| `--clr-surface`        | `#f8fafc` |
| `--clr-content`        | `#ffffff` |
| `--clr-border`         | `#e2e8f0` |
| `--clr-sidebar-bg`     | `#f8fafc` |
| `--clr-topbar-bg`      | `#ffffff` |
| `--clr-accent`         | `#7c3aed` |
| `--clr-text-primary`   | `#0f172a` |
| `--clr-text-secondary` | `#475569` |
| `--clr-text-muted`     | `#94a3b8` |

### Typography

- **UI copy** (labels, nav items, filter selects): Inter
- **Metrics, IDs, costs, SHAs, code**: JetBrains Mono
- No mixed font sizes in the same row.

### Kanban

- Outer wrapper: `display: flex; gap: 12px; overflow-x: auto`
- Each column: fixed height `calc(100vh - 160px)`, `overflow-y: auto`
- Column header: `position: sticky; top: 0; z-index: 10` with surface background

### Accessibility

- `<nav id="sidebar-nav" aria-label="Main navigation">`
- Active nav button: `aria-current="page"` (toggled by `showTab()` JS)
- Tab panels: `role="tabpanel"` + `aria-labelledby="tab-btn-{name}"`
- Filter selects: `aria-label` attributes
- Filter search input: `aria-label="Search stories"`

### Security Fixes (same file, same PR)

- **BUG-0058:** `githubUrl` validated — only `https://` prefix allowed in `<a href>`.
- **BUG-0059:** All IDs in `onclick` attribute strings passed through `esc()`.

---

## Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│ #topbar-fixed (position: fixed, height: 56px)            │
│  [project name · tagline · sha] [chip chip chip chip]    │
└──────────────────────────────────────────────────────────┘
┌────────────┬─────────────────────────────────────────────┐
│ #sidebar   │ #main-content                               │
│ (sticky)   │  ┌───────────────────────────────────────┐  │
│ ≥1024: 200px│  │ #filter-sticky (sticky top: 0)        │  │
│ 768-1023:  │  └───────────────────────────────────────┘  │
│  160px     │  #tab-content                               │
│ <768: 44px │   (tab panels)                              │
└────────────┴─────────────────────────────────────────────┘
```

---

## Files Changed

- `tools/lib/render-html.js` — all changes
- `docs/superpowers/specs/2026-03-29-ui-redesign-design.md` — this file
