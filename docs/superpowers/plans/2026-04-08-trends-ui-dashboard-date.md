# Trends Tab UI Polish + Agentic Dashboard Date — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 Trends chart visual issues and add full date to the agentic dashboard footer.

**Architecture:** All changes are isolated CSS/JS option patches inside existing template functions — no new files, no new modules, no parser changes.

**Tech Stack:** Node.js, Chart.js (client-side, already loaded), vanilla JS.

---

### Task 1: Agentic dashboard "Last refreshed" date (US-0085)

**File:** `tools/generate-dashboard.js`

- [ ] **Step 1: Find the `now` assignment (~line 65)**

  Locate the line that builds the current time string, e.g.:

  ```js
  const now = new Date().toLocaleTimeString(...);
  ```

- [ ] **Step 2: Replace with full datetime format**

  ```js
  const now = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  ```

- [ ] **Step 3: Update footer (~line 631)**

  Change `Auto-refreshes every 5 seconds` (or the existing time-only string) to:

  ```
  Last refreshed: ${now}
  ```

  Keep any other footer text (e.g. the project name / DASH_META.footer prefix) unchanged.

- [ ] **Step 4: Verify**

  ```bash
  node tools/generate-dashboard.js
  ```

  Open `docs/dashboard.html` — footer should read e.g. `Apr 8, 2026, 04:32 PM`.

- [ ] **Step 5: Commit**

  ```bash
  git add tools/generate-dashboard.js
  git commit -m "feat: add full date to agentic dashboard Last refreshed footer"
  ```

---

### Task 2: Trends x-axis label density fix (US-0084 AC-0264)

**File:** `tools/lib/render-html.js`, lines 671–732 (all 7 chart configs)

- [ ] **Step 1: In each chart's `scales.x.ticks` block, replace `ticks: { color: tc }` with:**

  ```js
  ticks: {
    color: tc,
    maxTicksLimit: 8,
    callback: function(val, i, ticks) {
      var d = new Date(this.getLabelForValue(val));
      return isNaN(d) ? val : (d.getMonth()+1) + '/' + d.getDate();
    }
  }
  ```

  Apply to all 7 charts (Progress, Cost, Coverage, Velocity, Tokens, At-Risk, Bugs).

- [ ] **Step 2: Verify**

  ```bash
  node tools/generate-plan.js
  ```

  Open Trends tab — x-axis labels show `3/2`, `4/8` style with ≤8 visible, no overlap.

---

### Task 3: Dark-mode aware grid lines (US-0084 AC-0266)

**File:** `tools/lib/render-html.js`

- [ ] **Step 1: Replace ALL occurrences of `grid: { color: '#e2e8f0' }` with:**

  ```js
  grid: {
    color: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.07)' : '#e2e8f0';
  }
  ```

  Use `replace_all: true` — the same pattern appears in all 7 charts.

- [ ] **Step 2: Verify** — toggle dark mode on Trends tab, grid lines should be subtle.

---

### Task 4: Token y-axis abbreviation (US-0084 AC-0265)

**File:** `tools/lib/render-html.js`

- [ ] **Step 1: Find the Tokens chart (chart 5, ~line 721). In `scales.y.ticks`, replace `ticks: { color: tc }` with:**

  ```js
  ticks: {
    color: tc,
    callback: function(v) {
      if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M';
      if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
      return v;
    },
  }
  ```

- [ ] **Step 2: Verify** — Token chart shows `45M` not `45,000,000`.

---

### Task 5: At-Risk chart scale fix (US-0084 AC-0267)

**File:** `tools/lib/render-html.js`

- [ ] **Step 1: Find the At-Risk chart (chart 6, ~line 732). Add `suggestedMax: 5` to `scales.y`:**

  Current:

  ```js
  y: { ticks: { color: tc }, grid: { color: ... }, beginAtZero: true }
  ```

  Replace with:

  ```js
  y: { ticks: { color: tc }, grid: { color: ... }, beginAtZero: true, suggestedMax: 5 }
  ```

- [ ] **Step 2: Verify** — At-Risk chart y-axis goes to at least 5 (not 1.0).

---

### Task 6: Final verification + PR

- [ ] Run `npx jest --no-coverage` — all tests pass
- [ ] Run `npx prettier --write tools/generate-dashboard.js tools/lib/render-html.js`
- [ ] Mark US-0084 and US-0085 Done in `docs/RELEASE_PLAN.md`, check all ACs
- [ ] Commit all remaining changes
- [ ] Push branch `feature/US-0084-trends-ui-polish` and open PR to `develop`
