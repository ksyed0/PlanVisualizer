# AI Cost Log

Append-only ledger of AI session costs. Never edit or delete rows.
Updated automatically by the Claude Code stop hook (`tools/capture-cost.js`).

Rows marked `[est]` are manually estimated for sessions that predate the capture-cost hook.
Pricing basis: Claude Sonnet 4.6 — Input $3/MTok · Cache Write $3.75/MTok · Output $15/MTok · Cache Read $0.30/MTok
Input Tokens column = direct input + cache-write tokens; cost computed with distinct rates internally.

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
| 2026-03-16 | sess_0026-est | claude/fix-mobile-top-area-C7evU | 150000 | 40000 | 80000 | 1.0740 |
| 2026-03-16 | sess_0027-est | claude/fix-mobile-top-area-C7evU | 120000 | 35000 | 60000 | 0.9030 |
| 2026-03-16 | sess_0028-est | claude/improvements-C7evU | 180000 | 45000 | 100000 | 1.2450 |
| 2026-03-16 | sess_0029-est | claude/improvements-C7evU | 160000 | 42000 | 90000 | 1.1370 |
| 2026-03-16 | sess_0030-est | claude/improvements-C7evU | 140000 | 38000 | 80000 | 1.0140 |
| 2026-03-17 | sess_0031-est | feature/US-0023-about-dialog | 130000 | 32000 | 65000 | 0.8880 |
| 2026-03-17 | sess_0032-est | feature/US-0023-about-dialog | 110000 | 28000 | 55000 | 0.7560 |
| 2026-03-17 | sess_0033-est | feature/US-0023-about-dialog | 90000 | 22000 | 45000 | 0.6135 |
| 2026-03-18 | sess_0034-est | feature/docs-update-readme-update-prompt | 120000 | 30000 | 60000 | 0.8280 |
| 2026-03-18 | sess_0035-est | feature/docs-update-readme-update-prompt | 100000 | 25000 | 50000 | 0.6900 |
| 2026-03-18 | sess_0036-est | feature/US-0030-bug-fix-costs-tab | 115000 | 28000 | 55000 | 0.7815 |
| 2026-03-18 | sess_0037-est | feature/US-0030-bug-fix-costs-tab | 95000 | 24000 | 48000 | 0.6555 |
| 2026-03-18 | sess_0038-est | feature/US-0031-dashboard-ux-fixes | 160000 | 40000 | 80000 | 1.1040 |
| 2026-03-18 | sess_0039-est | feature/US-0031-dashboard-ux-fixes | 130000 | 33000 | 65000 | 0.8985 |
| 2026-03-18 | sess_bug0001-est | bugfix/BUG-0001-coverage-na | 116667 | 40000 | 166667 | 1.0000 |
| 2026-03-18 | sess_bug0003-est | bugfix/BUG-0003-tc-statuses | 29167 | 10000 | 41667 | 0.2500 |
| 2026-03-18 | sess_bug0004-est | bugfix/BUG-0004-sticky-header | 29167 | 10000 | 41667 | 0.2500 |
| 2026-03-18 | sess_bug0005-est | bugfix/BUG-0005-xss-escape-html | 58333 | 20000 | 83333 | 0.5000 |
| 2026-03-18 | sess_bug0006-est | bugfix/BUG-0006-0009-0010-render-html | 110833 | 38000 | 158333 | 0.9500 |
| 2026-03-18 | sess_bug0007-est | bugfix/BUG-0007-0011-parser-fixes | 81667 | 28000 | 116667 | 0.7000 |
| 2026-03-18 | sess_bug0008-est | bugfix/BUG-0008-0014-0015-0016-misc | 122500 | 42000 | 175000 | 1.0500 |
| 2026-03-18 | sess_bug0012-est | bugfix/BUG-0012-0013-0017-ci-config-fixes | 105000 | 36000 | 150000 | 0.9000 |
| 2026-03-18 | sess_bug0019-est | bugfix/BUG-0019-node24-actions | 29167 | 10000 | 41667 | 0.2500 |
| 2026-03-18 | sess_0040-est | feature/dark-mode-readability | 180000 | 45000 | 90000 | 1.2420 |
| 2026-03-18 | sess_0041-est | feature/dark-mode-readability | 150000 | 38000 | 75000 | 1.0425 |
| 2026-03-18 | sess_0042-est | feature/dark-mode-readability | 140000 | 35000 | 70000 | 0.9660 |
| 2026-03-18 | sess_0043-est | feature/dark-mode-readability | 100000 | 25000 | 50000 | 0.6900 |
| 2026-03-22 | sess_0044-est | feature/US-0040-visual-design-overhaul | 220000 | 58000 | 160000 | 1.5930 |
| 2026-03-22 | sess_0045-est | feature/US-0040-visual-design-overhaul | 180000 | 48000 | 140000 | 1.3020 |
| 2026-03-26 | f655eb8e-96ab-4c4a-bdb6-ab0a6023ce09 | chore/fix-version-workflows | 365343 | 35439 | 18487655 | 7.4478 |
