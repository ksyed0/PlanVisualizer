# EPIC-0025 GitHub Issues Sync — Design Spec

**Date:** 2026-05-03
**Session:** 37
**Next IDs at writing time:** EPIC-0025, US-0170, AC-0611, TC-0553, BUG-0253, L-0054

---

## Overview

EPIC-0025 adds optional, bidirectional synchronisation between PlanVisualizer's
`docs/BUGS.md` / `docs/RELEASE_PLAN.md` and a GitHub repository's Issues. The
feature is off by default, enabled via `plan-visualizer.config.json`, and
configured through a new Settings tab in `plan-status.html`.

Both source files are machine-written in human-readable format — writing back to
them is consistent with existing project patterns.

---

## Architecture

### New files

| File                          | Purpose                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `tools/sync-github.js`        | CLI entry point: `node tools/sync-github.js [--dry-run]`             |
| `tools/lib/github-client.js`  | Thin GitHub REST API wrapper (Node `https`, no extra deps)           |
| `tools/lib/sync-bugs.js`      | Bidirectional BUGS.md ↔ Issues logic                                 |
| `tools/lib/sync-stories.js`   | Bidirectional RELEASE_PLAN.md ↔ Issues logic                         |
| `docs/github-sync-state.json` | Machine-written sync state — idempotency guard + conflict timestamps |

### Trigger

`generate-plan.js` calls `sync-github.js` at the end of its pipeline, guarded
by `config.github?.enabled === true`. If `GITHUB_TOKEN` env var is absent, sync
is skipped with a `[sync-github] GITHUB_TOKEN not set — skipping` warning.
Dashboard generation continues regardless.

### Configuration

New `github` block in `plan-visualizer.config.json`:

```json
"github": {
  "enabled": true,
  "repo": "owner/repo",
  "syncBugs": true,
  "syncStories": false,
  "labelMap": {
    "Critical": "critical",
    "High": "high",
    "Medium": "medium",
    "Low": "low"
  },
  "defaultLabels": ["planvisualizer"]
}
```

### Token

`GITHUB_TOKEN` environment variable only. Never stored in config or rendered in
the UI. The Settings panel shows `✓ Set` / `✗ Not set` based on a boolean flag
embedded at generation time.

---

## Sync Logic

### State file schema

`docs/github-sync-state.json` is updated after every sync run:

```json
{
  "lastSyncAt": "2026-05-03T14:32:00Z",
  "lastError": null,
  "summary": { "created": 3, "closed": 1, "updated": 0, "skipped": 12 },
  "entries": [
    {
      "id": "BUG-0253",
      "ghIssueNumber": 42,
      "lastKnownGhStatus": "open",
      "lastSyncedAt": "2026-05-03T14:32:00Z"
    }
  ]
}
```

### ID linkage fields

BUGS.md entries gain an optional `GH Issue: #NNN` field written by the sync tool
after a GitHub Issue is created. RELEASE_PLAN.md stories gain the same field when
`syncStories: true`.

### Conflict resolution

**Most-recent-change wins**, using `lastSyncedAt` from the state file:

- If PlanVisualizer status changed after `lastSyncedAt` → push to GitHub
- If GitHub status changed after `lastSyncedAt` → pull to PlanVisualizer
- If both changed → PlanVisualizer wins (it is the source of truth for content)

### PlanVisualizer → GitHub (push)

| PlanVisualizer event                               | GitHub action                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| New BUG entry, no `GH Issue:` field                | Create Issue: `[BUG-XXXX] <title>`, labels = severity label + `defaultLabels`, body = steps/expected/actual |
| BUG `Status: Fixed` or `Retired`                   | Close linked Issue                                                                                          |
| BUG `Status: Open` or `In Progress`                | Reopen linked Issue if closed                                                                               |
| New US entry (`syncStories: true`), no `GH Issue:` | Create Issue: `[US-XXXX] <title>`, labels = `story` + priority label + `defaultLabels`                      |
| US `Status: Done`                                  | Close linked Issue                                                                                          |

After creating an Issue, sync writes `GH Issue: #NNN` back to BUGS.md /
RELEASE_PLAN.md.

### GitHub → PlanVisualizer (pull)

| GitHub event                                                  | PlanVisualizer action                                                                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Issue with a `defaultLabels` label, no matching BUG entry | Append new BUG entry to BUGS.md — severity inferred from labels, status = Open, ID allocated from ID_REGISTRY.md atomically via `orchestrator/atomic-write.js` |
| Issue closed externally                                       | Set matching BUG/US `Status: Fixed`                                                                                                                            |
| Issue reopened externally                                     | Set matching BUG/US `Status: Open`                                                                                                                             |
| Issue title edited                                            | No action — PlanVisualizer is source of truth for titles                                                                                                       |

### Rate limiting

Entries processed in batches of 10 with 100ms delay between batches. GitHub
authenticated REST API allows 5,000 requests/hour — sufficient for projects with
hundreds of bugs at any realistic sync frequency.

### `--dry-run` flag

Prints a preview diff of all planned changes (creates, closes, updates) without
making API calls or writing files.

---

## Settings Panel UI

New **"⚙ Settings"** tab added to the plan-status.html sidebar, rendered
server-side with current config values embedded at generation time. All fields
save to `localStorage` on change.

**Layout:**

```
┌─ GitHub Issues Sync ──────────────────────────────────┐
│  Enabled  [ toggle ]                                   │
│                                                        │
│  Repository   [ owner/repo          ]                  │
│  Sync bugs    [ ✓ ]   Sync stories  [ _ ]              │
│  Default labels  [ planvisualizer        ]             │
│                                                        │
│  Severity → Label mapping                             │
│  Critical → [ critical ] High → [ high ]              │
│  Medium   → [ medium   ] Low  → [ low  ]              │
│                                                        │
│  ⓘ Token: set GITHUB_TOKEN environment variable       │
│    Status: ✓ Set (detected at generation time)         │
│                                                        │
│  [ Copy config JSON ]   [ Reset to defaults ]          │
│                                                        │
│  Last sync: 2026-05-03 14:32 UTC · 3 created · 1 closed│
│  (badge: ⚠ Last sync failed — see github-sync-state)  │
└────────────────────────────────────────────────────────┘
```

**Behaviour:**

- **"Copy config JSON"** generates the `"github": { ... }` block pre-filled from
  current field values for the user to paste into `plan-visualizer.config.json`
- **Last sync status** embedded at generation time from `github-sync-state.json`;
  shows `—` if never synced
- **Warning badge** on the Settings tab icon when `lastError` is non-null in the
  state file
- Toggle visually enables/disables all fields; actual enable/disable is the
  `enabled` key in config (localStorage is informational/display only)

---

## Error Handling

GitHub API failures are **non-fatal**:

1. Sync logs a warning to stderr
2. Error message written to `github-sync-state.json` as `"lastError"`
3. `generate-plan.js` continues — dashboard generates normally
4. Settings tab shows a warning badge on next generation

---

## Acceptance Criteria

### EPIC-0025 stories (next IDs from registry)

**US-0171 — Core sync engine**

- AC-0611: `sync-github.js` CLI runs without error when `GITHUB_TOKEN` is set and `config.github.enabled` is true
- AC-0612: `--dry-run` flag prints planned changes without modifying any files or calling the GitHub API
- AC-0613: A new BUG entry with no `GH Issue:` field creates a GitHub Issue with correct title, labels, and body
- AC-0614: A BUG marked Fixed closes the linked GitHub Issue
- AC-0615: A GitHub Issue closed externally updates the matching BUG status to Fixed in BUGS.md
- AC-0616: A GitHub Issue with a `defaultLabels` label and no matching BUG entry creates a new BUG entry in BUGS.md with an allocated BUG ID
- AC-0617: `docs/github-sync-state.json` is written after every sync run with correct summary counts
- AC-0618: If `GITHUB_TOKEN` is absent, sync is skipped with a warning and `generate-plan.js` exits 0

**US-0172 — Settings panel**

- AC-0619: A "Settings" tab appears in the plan-status.html sidebar
- AC-0620: Settings tab renders current `config.github` values embedded at generation time
- AC-0621: "Copy config JSON" button copies the JSON block to the clipboard
- AC-0622: Last sync summary (date, created, closed counts) is displayed when `github-sync-state.json` exists
- AC-0623: A warning badge appears on the Settings tab icon when `lastError` is non-null
- AC-0624: Token status shows `✓ Set` or `✗ Not set` based on the generation-time flag; the token value is never rendered

**US-0173 — Story sync (opt-in)**

- AC-0625: When `syncStories: true`, new US entries without `GH Issue:` create GitHub Issues
- AC-0626: When a US reaches `Status: Done`, the linked GitHub Issue is closed
- AC-0627: `syncStories` defaults to `false`; story sync is entirely opt-in

---

## Out of Scope

- Webhook-based real-time sync (polling on generate is sufficient)
- Sync of PR/commit links from GitHub back to stories
- Multi-repo sync (single `repo` per config)
- GitHub Projects / Milestones integration
- Audio chime on sync completion

---

## Companion Story

**US-0170 — Artefact ID sequences: remove 4-digit cap**
Tracked in EPIC-0024 (backlog housekeeping). Update all parser regexes from
`\d{4}` to `\d+` across 6 files so IDs beyond 9999 render correctly. Zero-
padding becomes optional beyond 4 digits. No existing ID migration required.
AC-0611–AC-0614 (see session notes).
