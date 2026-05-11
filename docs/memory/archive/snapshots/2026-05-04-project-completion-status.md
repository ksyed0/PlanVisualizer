# Project Completion Status (as of 2026-05-04 Session 38)

v2.1.0 released. Next: EPIC-0025 (GitHub Issues Sync). Dependabot PR #532 (ESLint bump) open.
Next IDs: always check `docs/ID_REGISTRY.md` — as of end of Session 38: Next BUG = BUG-0254.

Key additions (Session 38):

- **BUG-0253/0254 (PR #534)**: `.mc-idle-portrait` height 80px → 160px; image src `-64.png` → `-160.png`; three stacked text divs (name/role/badge) replaced with `.mc-idle-info` single flex row — `Name · Role IDLE` on one line, role truncates with ellipsis.
- **v2.1.0 release**: tag `v2.1.0` → commit `a88cb4b` on main; GitHub release live. `release/2.1.0` branch deleted.
- **Dependabot PR #532**: ESLint 10.2.1 → 10.3.0 — open, needs a quick approve+merge at start of next session.
- **EPIC-0025 implementation order**: US-0170 (ID regex `\d{4}` → `\d+`, prerequisite) → US-0171 (sync engine) → {US-0172 (Settings UI) ∥ US-0173 (story sync)}. Plan at `docs/superpowers/plans/2026-05-03-epic-0025-github-issues-sync.md`.
