# GitHub Status Monitoring — Design Spec

**Date:** 2026-05-07
**Status:** Approved
**Author:** Session 41 brainstorm

---

## Overview

Surface GitHub PR status, CI check results, and deployment history inside both PlanVisualizer dashboards. Read-only. No changes to the existing write path (bug/story sync). Authenticated via the existing `GITHUB_TOKEN` env var and `github.repo` config key.

---

## Scope

| In scope                           | Out of scope                                 |
| ---------------------------------- | -------------------------------------------- |
| Open PR list with CI status per PR | Writing to GitHub (PRs, comments, labels)    |
| Per-PR CI check results            | GitHub Actions workflow dispatch             |
| Latest deployment status           | Webhook ingestion                            |
| PR-to-story linkage                | Dedicated PR Status tab (deferred → US-0174) |
| Staleness timestamps               |                                              |

---

## Shared Infrastructure

### `tools/lib/fetch-github-status.js`

New pure module. No file I/O. Wraps existing `github-client.js`.

**Exports:** `fetchGitHubStatus(config, token) → Promise<GitHubStatusData>`

**Return shape:**

```js
{
  prs: [
    {
      number: 994,
      title: "feat: US-0174 — GitHub status monitoring",
      url: "https://github.com/owner/repo/pull/994",
      headBranch: "feature/US-0174-github-status-monitoring",
      storyId: "US-0174",       // null if branch doesn't match US-\d{4} or BUG-\d{4}
      bugId: null,
      ciStatus: "success",      // "success" | "failure" | "pending" | "skipped" | null
      reviewCount: 1,
      createdAt: "2026-05-05T10:00:00Z"  // raw ISO — render layer formats to "2d ago"
    }
  ],
  ciSummary: {
    total: 3,
    passing: 2,
    failing: 1,
    pending: 0
  },
  deployment: {
    environment: "gh-pages",
    status: "success",
    ref: "v2.2.0",
    createdAt: "2026-05-07T11:00:00Z",
    url: "https://ksyed0.github.io/PlanVisualizer/plan-status.html"
  },
  fetchedAt: "2026-05-07T13:34:00Z"
}
```

**API calls made:**

1. `GET /repos/{owner}/{repo}/pulls?state=open&per_page=30` — open PRs
2. `GET /repos/{owner}/{repo}/commits/{headSha}/check-runs` — CI checks per PR (batched via existing `batchedRequests`)
3. `GET /repos/{owner}/{repo}/deployments?per_page=1` + `GET /repos/{owner}/{repo}/deployments/{id}/statuses?per_page=1` — latest deployment

**PR-to-story matching:** extract `US-\d{4}` or `BUG-\d{4}` from `headBranch` using the same regex as `normalizeStoryRef()`. Returns `null` if no match (e.g. external contributor PRs, chore branches).

**Called when:** `GITHUB_TOKEN` is set and `config.github.enabled === true`. Returns `null` (not an error) when disabled or token absent — callers must null-guard.

---

## plan-status.html

### Fetch timing

`generate-plan.js` calls `fetchGitHubStatus()` at generate time, after all other data is computed. Result stored at `data.githubStatus`. If `null`, all GitHub UI surfaces are hidden.

### Topbar chips

Two new chips appended to the existing chip row when `data.githubStatus` is non-null:

| Chip       | Logic                          | Examples                       |
| ---------- | ------------------------------ | ------------------------------ |
| CI summary | `${passing}/${total} PRs ✓ CI` | `2/3 PRs ✓ CI`, `3/3 PRs ✓ CI` |
| Open PRs   | `${total} open PRs`            | `3 open PRs`                   |

CI chip is hidden when `total === 0` (no open PRs — nothing to report). The "open PRs" chip still shows `0 open PRs` in that case.

CI chip background:

- All passing → green (`rgba(34,197,94,...)`)
- Any failing → red (`rgba(239,68,68,...)`)
- Any pending, none failing → amber (`rgba(245,158,11,...)`)

### Status tab additions

**Deployment banner** — inserted below the release health hero, above the metric tiles:

```
↑ Latest deployment  [● success]  v2.2.0 → gh-pages  ·  2h ago  [view on GitHub →]
```

Hidden if `deployment` is null.

**CI Status tile** — 4th tile alongside Overall Progress / Test Coverage / Open Bugs:

```
CI STATUS
● Passing        (green, all passing)
⚠ 1 failing      (red, any failing)
⟳ Pending        (amber, any pending, none failing)
```

Subtitle: `N checks · N PRs`.

**Open PRs list** — new collapsible section at the bottom of the Status tab. Columns: PR#, title (linked), CI badge, review count, age. Collapsed by default.

### Hierarchy / Kanban story rows

Each story row gets two optional elements appended to its right edge:

- CI badge: `✓` (green) / `✗` (red) / `⟳` (amber) — shown only when `storyId` matches a PR
- PR link: `#994 →` (linked to GitHub PR) — shown only when matched

Stories with no matching PR show nothing (not a "no PR" indicator — absence is sufficient).

### Staleness

Every surface that displays GitHub data shows a muted `GitHub · last updated X ago` line using the `fetchedAt` timestamp. Format: `Xm ago` / `Xh ago` / `>1d ago`.

---

## dashboard.html

### Fetch timing

The Conductor writes GitHub status into `sdlc-status.json` at four specific pipeline transitions:

```bash
node tools/update-sdlc-status.js github-status --token $GITHUB_TOKEN
```

Triggered after: `story-start`, `story-complete`, `review`, and `test-pass`. These are the moments when PR/CI state is most likely to have changed. All other transitions (`phase`, `log`, `coverage`, etc.) do not trigger a GitHub fetch.

`update-sdlc-status.js` gains a new `github-status` command handler that:

1. Calls `fetchGitHubStatus()` to get fresh data
2. Diffs the result against the existing `sdlcStatus.githubStatus` to detect state changes
3. Pushes change events into `sdlcStatus.log` (e.g. `{ agent: 'GitHub', message: 'CI ✓ passed on #994', type: 'ci' }`)
4. Writes the new `githubStatus` object (including `ciPollUntil` if any PR is pending — see below)

`generate-dashboard.js` reads `sdlcStatus.githubStatus` — no direct GitHub API calls in the generator.

**Change detection rules for event emission:**

- `pending → success/failure/cancelled` on any PR → emit CI result event
- New PR appears in list → emit PR opened event
- PR disappears from open list → emit PR merged/closed event
- `deployment.status` changes to `success`/`failure` → emit deployment event

### CI poll-until mechanism

The `github-status` handler itself sets `ciPollUntil` whenever it observes any PR with `ciStatus: "pending"` after writing new state — regardless of which Conductor transition triggered the call:

```json
"githubStatus": {
  "...",
  "ciPollUntil": "2026-05-07T13:49:00Z"
}
```

This means `ciPollUntil` is always set at the right moment (when pending CI is first observed) without the Conductor needing to know about it. If a subsequent handler call finds all CI terminal, it clears `ciPollUntil` before writing.

A companion poll loop (a `setInterval` inside `generate-dashboard.js --watch`, not a separate process) checks every 60 seconds:

- If `now < ciPollUntil` and any PR has `ciStatus: "pending"` → invoke the `github-status` handler directly, which updates `sdlc-status.json` and emits any change events
- If all PRs reach terminal state (`success`/`failure`/`cancelled`) → handler clears `ciPollUntil`; poll loop sees it gone and stops
- If `now >= ciPollUntil` → stop polling, leave status as-is (staleness timestamp will be visible)

The poll loop uses the same `atomicReadModifyWriteJson` pattern as the rest of `update-sdlc-status.js` to prevent write conflicts if a Conductor event and a poll tick fire simultaneously.

TTL: 15 minutes. Max additional API calls per CI run: ~15.

### Live bar

When `githubStatus` is non-null and the active story has a linked PR, a CI chip appears in the live bar next to the story ID:

```
ON AIR  |  Pixel · US-0174  [✓ CI]  |  165:48:04  LIVE
```

Chip colours follow the same pass/fail/pending scheme as plan-status.

If no linked PR exists for the active story, the chip is omitted (not shown as "no PR").

### Event Log

GitHub events are injected into the existing event log stream with an indigo left-border (`border-left: 2px solid oklch(60% 0.18 260)`). Source label: `[GitHub]`.

Events logged:

- CI check completed (pass or fail) on any open PR
- PR opened
- PR merged / closed
- Deployment succeeded / failed

Events are derived from state _changes_ between successive `github-status` fetches — i.e. a `pending → success` transition emits a "CI ✓ passed" event, not every poll that sees `pending`.

### GITHUB sidebar widget

New widget in the right sidebar, between "Needs Attention" and "Phase Progress":

```
GITHUB
#994 review pending       (indigo)
#992 approved             (green)
↑ v2.2.0 · 2h ago        (muted)
GitHub · last updated Xm ago
```

**Bootstrap / empty state:** When `githubStatus` is null or absent in `sdlc-status.json`, the widget renders:

```
GITHUB
Starting up — no data yet
```

The widget is always shown (never hidden) when `github.enabled = true`, so the user can see it's configured but waiting.

### Needs Attention

When `githubStatus.prs` contains any PR with `reviewCount === 0`, appends to Needs Attention:

```
⚠ N PRs need review
```

---

## Configuration

No new config keys required. Existing keys used:

```json
{
  "github": {
    "enabled": true,
    "repo": "ksyed0/PlanVisualizer"
  }
}
```

`GITHUB_TOKEN` env var required. If absent: feature is silently disabled, no errors thrown, all UI surfaces hidden.

---

## What is NOT in this feature

- No dedicated GitHub tab (deferred → US-0174)
- No webhook ingestion
- No browser-side GitHub API calls (PAT stays server-side)
- No config UI for the PAT (managed via environment)

---

## Future work

- **US-0174** — Dedicated PR Status tab with full PR list, CI drill-down, and deployment history
