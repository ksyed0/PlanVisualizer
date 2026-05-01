# Plan-Status Quality Sweep — Design Spec

**Date:** 2026-05-01
**Bugs addressed:** BUG-0223, BUG-0184, BUG-0183
**Approach:** A — Three surgical patches, one PR
**Estimated implementation time:** ~2 hours
**Primary file:** `tools/lib/render-tabs.js`
**Branch:** `bugfix/BUG-0183-0184-0223-plan-status-quality`

---

## Root Diagnosis

Three independent low-severity bugs all touching `render-tabs.js` and `plan-status.html`:

1. **BUG-0223** — Bugs tab card/compact view epic groups are expanded on load (table view already fixed in BUG-0167; other views missed)
2. **BUG-0184** — Chart colour palette drifts: progress sparklines in `_renderFullStatusHero` use `var(--plan-accent)` (violet) for "Done" stories and the burn SVG; Charts/Trends tabs correctly use `pvChartColors.ok` (green) for the same concept
3. **BUG-0183** — Status tab hero is hard to land: verdict is a small pill chip (not a headline), forecast is buried below sparklines, sparklines are 32px tall (hard to read trend shape), and when `data.trends` is sparse the fallbacks make the hero look empty

---

## Section 1 — BUG-0223: Bugs tab card/compact views collapsed by default

### What exists

The **table-view** bug epic groups are already default-collapsed (from BUG-0167): the content `<tbody id="${beid}">` has `class="hidden"` and the arrow span contains `▶`.

Two other rendering paths in `renderBugsTab` were not updated:

- **Card view** (`bceid` groups): content div rendered without `hidden`, arrow shows `▼`
- **Compact view** (`bcceid` groups): same omission

### Changes

For each of the two unfixed views, make the same two changes that were applied for BUG-0167:

1. Add `hidden` to the content container's class list
2. Change the arrow span text from `▼` (open) to `▶` (closed)

`toggleSection()` already handles both show/hide and arrow flip — no JS changes required.

### Tests

Add Jest assertions to `tests/unit/render-tabs.test.js` (or `render-html.test.js` if that's where bug tab tests live):

- Card-view group content divs contain `class="hidden"` in generated HTML
- Card-view arrow spans contain `▶` not `▼`
- Compact-view same two assertions

---

## Section 2 — BUG-0184: Chart palette full audit

### Semantic colour mapping (enforce everywhere)

| Concept                              | Token                  | OKLCH value           |
| ------------------------------------ | ---------------------- | --------------------- |
| Done / complete / passing / progress | `pvChartColors.ok`     | `oklch(66% 0.17 145)` |
| In Progress / active                 | `pvChartColors.info`   | `oklch(60% 0.14 185)` |
| Planned / pending / gap              | `pvChartColors.mute`   | `oklch(65% 0.014 95)` |
| At risk / warning                    | `pvChartColors.warn`   | `oklch(76% 0.17 80)`  |
| Blocked / failed / critical          | `pvChartColors.risk`   | `oklch(58% 0.22 25)`  |
| AI cost / spend                      | `pvChartColors.accent` | `oklch(56% 0.22 264)` |

**Note:** `pvChartColors` is a JS runtime object (lives in embedded `<script>` blocks). For server-side rendered SVG/inline-style colours in `render-tabs.js` template strings, use the matching OKLCH literal from `theme.js` — not the JS object reference.

### Changes in `_renderFullStatusHero` (`render-tabs.js` ~line 820–870)

1. **Progress sparkline bars** — change `color-mix(in oklab, var(--plan-accent) ...)` to `color-mix(in oklab, oklch(66% 0.17 145) ${Math.max(pct, 8)}%, var(--border))`. "Done stories" = green, not violet.

2. **Burn SVG** — change `stroke="var(--plan-accent)"` to `stroke="oklch(66% 0.17 145)"` and update the gradient `stop-color` to match. Velocity/throughput is a "done" concept → green.

3. **Coverage dots** — currently use `var(--ok)` / `var(--warn)` / `var(--risk)`. These are semantically correct; change to OKLCH literals for consistency with the rest of the hero (`oklch(66% 0.17 145)` / `oklch(72% 0.19 38)` / `oklch(58% 0.22 25)`).

### Audit of Charts and Trends tabs

Based on code review, Charts and Trends tabs already route through `pvChartColors.*` correctly — no changes needed there. The drift is localised to `_renderFullStatusHero`.

### Tests

Add assertions to the render-tabs test file:

- `_renderFullStatusHero` output does not contain `var(--plan-accent)` in any colour-bearing attribute (style, stroke, fill, stop-color)
- Progress bar style contains `oklch(66% 0.17 145)` (the ok green)
- SVG stroke contains `oklch(66% 0.17 145)`

---

## Section 3 — BUG-0183: Status hero prominence fixes

### Changes in `_renderFullStatusHero` (`render-tabs.js` ~line 773–960)

**1. Verdict — increase size and add eyebrow**

Replace the small verdict chip with:

```html
<div
  style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-mute);margin-bottom:6px"
>
  Release Health
</div>
<div
  style="font-family:var(--font-display);font-size:28px;font-weight:800;line-height:1;color:${verdictColor};margin-bottom:6px"
>
  ${verdict}
</div>
```

The `verdictColor` variable already exists and maps correctly to `var(--ok)` / `var(--warn)` / `var(--risk)`.

**2. Forecast — move above sparklines**

Currently the forecast row (likelyDate, rangeStart–rangeEnd, velocityWeeks) is rendered after the three sparkline columns. Move it immediately after the narrative paragraph, before the sparkline section:

```html
<div
  style="display:flex;gap:0;background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:12px"
>
  <div style="flex:1;padding:8px 12px;border-right:1px solid var(--border)">
    <div style="font-size:8px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">
      Forecast
    </div>
    <div style="font-size:14px;font-weight:700">${forecastLabel}</div>
    <div style="font-size:9px;color:var(--text-mute);margin-top:1px">likely date</div>
  </div>
  <div style="flex:1;padding:8px 12px;border-right:1px solid var(--border)">
    <div style="font-size:8px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">
      Range
    </div>
    <div style="font-size:12px;font-weight:700">${rangeLabel}</div>
    <div style="font-size:9px;color:var(--text-mute);margin-top:1px">80% confidence</div>
  </div>
  <div style="flex:1;padding:8px 12px">
    <div style="font-size:8px;color:var(--text-mute);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">
      Velocity
    </div>
    <div style="font-size:14px;font-weight:700">${velocityLabel}</div>
    <div style="font-size:9px;color:var(--text-mute);margin-top:1px">rolling avg</div>
  </div>
</div>
```

When `comp` is null (no completion forecast), render a muted "Forecast unavailable — insufficient velocity data" message in place of the banner rather than hiding it.

**3. Sparklines — increase bar max height**

Change progress bar height cap from `32` to `48`:

```javascript
// BEFORE:
height:${Math.max(Math.round((doneCounts[i] / maxDone) * 32), 4)}px
// AFTER:
height:${Math.max(Math.round((doneCounts[i] / maxDone) * 48), 4)}px
```

Change the SVG viewBox height from `H = 44` to `H = 56` to match.

**4. Sparse data fallbacks**

When `data.trends` has fewer than 2 data points, the three sparkline columns currently show "No history" / "No data" plain text which makes the hero look broken. Replace with muted placeholder bars at minimum height so the layout holds:

```javascript
// In progressBars fallback:
return Array(14)
  .fill(null)
  .map(
    () =>
      `<div style="width:8px;background:var(--border);border-radius:2px;height:4px;align-self:flex-end;flex-shrink:0"></div>`,
  )
  .join('');
```

Apply the same placeholder pattern to `coverageDots` and `burnUpSvg` fallbacks.

### Tests

- `_renderFullStatusHero` output contains `font-size:28px` for the verdict element
- Output contains `Release Health` eyebrow text
- Forecast banner appears before the first sparkline `<div` in the HTML string
- Sparkline bar height formula uses `48` not `32`
- When called with empty trends, output does not contain `"No history"` or `"No data"` (replaced with placeholder)

---

## Files Changed

| File                             | Change                                                                      |
| -------------------------------- | --------------------------------------------------------------------------- |
| `tools/lib/render-tabs.js`       | BUG-0223 card/compact collapse; BUG-0184 colour audit; BUG-0183 hero layout |
| `tests/unit/render-tabs.test.js` | New assertions for all three bugs                                           |
| `docs/BUGS.md`                   | BUG-0183, BUG-0184, BUG-0223 marked Fixed                                   |
| `docs/LESSONS.md`                | L-0053 added                                                                |
| `docs/ID_REGISTRY.md`            | L-0054 next                                                                 |

---

## Out of Scope

- Redesigning the KPI tiles below the sparklines
- Adding new data fields to `_renderFullStatusHero`
- Any changes to `renderStakeholderTab` (it calls `_renderFullStatusHero` too and will benefit automatically)
- Dark mode specific changes (all colours use CSS custom properties that already handle both modes)
- Mobile responsive changes to the forecast banner
