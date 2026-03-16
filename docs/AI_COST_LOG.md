# AI Cost Log

Append-only ledger of AI session costs. Never edit or delete rows.
Updated automatically by the Claude Code stop hook (`tools/capture-cost.js`).

Rows marked `[est]` are manually estimated for sessions that predate the capture-cost hook.
Pricing basis: Claude Sonnet 4.6 — Input $3/MTok · Output $15/MTok · Cache Read $0.30/MTok

---

## Keeping Costs Accurate

**If the AI Cost column in the dashboard is blank or zero for a story**, it means no cost log row has a `Branch` value matching that story's `Branch:` field exactly. Two common causes:

1. **Sessions predating the capture-cost hook** — add estimated rows manually using the `-est` suffix convention (e.g. `sess_NNNN-est`).
2. **Branch name mismatch** — the branch in the cost log row must exactly match the `Branch:` field in RELEASE_PLAN.md (case-sensitive).

**To estimate and backfill costs**, ask your AI assistant:

> "Look at `docs/AI_COST_LOG.md` and `docs/RELEASE_PLAN.md`. For any story whose branch has no matching cost log row, estimate the token usage based on the work described and the t-shirt size, then append new `[est]` rows. Use Claude Sonnet 4.6 pricing: Input $3/MTok · Output $15/MTok · Cache Read $0.30/MTok."

**Human cost** is computed automatically from t-shirt size × hourly rate in `plan-visualizer.config.json`. To update the hourly rate, change `costs.hourlyRate` in the config.

---

| Date | Session ID | Branch | Input Tokens | Output Tokens | Cache Read Tokens | Cost USD |
|---|---|---|---|---|---|---|
| 2026-03-09 | sess_0001-est | feature/US-0001-parse-release-plan | 90000 | 22000 | 45000 | 0.6135 |
| 2026-03-09 | sess_0002-est | feature/US-0002-parse-test-cases | 65000 | 16000 | 35000 | 0.4455 |
| 2026-03-09 | sess_0003-est | feature/US-0003-parse-bugs | 55000 | 13000 | 30000 | 0.3690 |
| 2026-03-09 | sess_0004-est | feature/US-0004-parse-cost-log | 60000 | 14000 | 35000 | 0.4005 |
| 2026-03-09 | sess_0005-est | feature/US-0005-parse-coverage | 45000 | 10000 | 25000 | 0.2925 |
| 2026-03-09 | sess_0006-est | feature/US-0006-parse-progress | 55000 | 13000 | 30000 | 0.3690 |
| 2026-03-09 | sess_0007-est | feature/US-0007-compute-costs | 55000 | 12000 | 25000 | 0.3525 |
| 2026-03-09 | sess_0008-est | feature/US-0008-detect-at-risk | 55000 | 12000 | 25000 | 0.3525 |
| 2026-03-09 | sess_0009-est | feature/US-0009-render-html | 140000 | 35000 | 70000 | 0.9660 |
| 2026-03-09 | sess_0010-est | feature/US-0009-render-html | 120000 | 30000 | 100000 | 0.8400 |
| 2026-03-09 | sess_0011-est | feature/US-0009-render-html | 100000 | 28000 | 110000 | 0.7530 |
| 2026-03-09 | sess_0012-est | feature/US-0009-render-html | 80000 | 18000 | 100000 | 0.5400 |
| 2026-03-09 | sess_0013-est | feature/US-0011-install-script | 65000 | 16000 | 40000 | 0.4470 |
| 2026-03-09 | sess_0014-est | feature/US-0012-capture-cost | 55000 | 13000 | 30000 | 0.3690 |
| 2026-03-09 | sess_0015-est | feature/US-0013-config-system | 50000 | 12000 | 25000 | 0.3375 |
| 2026-03-10 | sess_0016-est | main | 120000 | 28000 | 60000 | 0.7980 |
| 2026-03-10 | sess_0017-est | main | 220000 | 65000 | 100000 | 1.6650 |
| 2026-03-10 | sess_0018-est | develop | 60000 | 14000 | 30000 | 0.3990 |
| 2026-03-10 | sess_0019-est | develop | 65000 | 15000 | 35000 | 0.4305 |
| 2026-03-10 | sess_0020-est | develop | 70000 | 18000 | 40000 | 0.4920 |
| 2026-03-10 | sess_0021-est | feature/US-0019-design-docs | 75000 | 20000 | 40000 | 0.5370 |
| 2026-03-10 | sess_0022-est | feature/US-0020-release-plan | 80000 | 22000 | 45000 | 0.5835 |
| 2026-03-11 | sess_0023-est | feature/US-0021-test-cases | 70000 | 25000 | 40000 | 0.5970 |
| 2026-03-11 | sess_0024-est | feature/US-0022-project-files | 75000 | 20000 | 40000 | 0.5370 |
| 2026-03-11 | sess_0025-est | feature/US-0022-project-files | 65000 | 15000 | 35000 | 0.4305 |
