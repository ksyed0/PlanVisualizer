# `docs/.pv-backup/` — PlanVisualizer state snapshots

> This directory is **gitignored** (see top-level `.gitignore`). Snapshots
> live only on the developer machine that took them; CI replays start from
> a clean tree. The contents of a snapshot are documented below so a future
> reader can interpret one if they need to inspect it manually.

Snapshots written by `npm run pv:upgrade` before applying any migration, and
restored by `npm run pv:rollback --to <label>`.

Each snapshot directory contains:

- `sdlc-status.json` — copy of the JSON mirror at snapshot time. Kept for
  human review and emergency manual recovery. **Not** the canonical state on
  rollback — the rollback command re-renders this file from the restored SQL
  rows, because in Phase D SQL is the source of truth.
- `sql/sdlc_events.json` — full row array for the `sdlc_events` table.
- `sql/sdlc_tasks.json` — full row array for the `sdlc_tasks` table.
- `sql/sdlc_programme.json` — full row array for the `sdlc_programme` table.
- `sql/meta_status.json` — captured `meta_status` keys (today: just
  `migration_005_hash`).
- `manifest.json` — metadata: `createdAt`, `label`, row `counts`,
  `metaKeysCaptured`.

Snapshot labels are filesystem-safe ISO timestamps
(`pre-upgrade-2026-05-21T13-14-15-678Z` for `pv:upgrade`, or `pre-<migration-id>`
for the per-migration flat-file snapshots authored by `tools/lib/migrations/backup.js`).

Format choice: JSON row arrays rather than SQLite binary dumps. Pros:

1. Human-reviewable in `git diff`.
2. Portable across `better-sqlite3` versions.
3. Phase D's invariant — the JSON mirror is a pure function of SQL state —
   means a JSON snapshot of SQL rows preserves exactly what the system needs
   to round-trip on rollback.

It is safe to prune older snapshots that pre-date the most recent applied
migration.
