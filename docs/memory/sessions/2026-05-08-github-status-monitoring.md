# GitHub Status Monitoring (Session 41, 2026-05-08)

- `tools/lib/fetch-github-status.js` — pure module, exports `fetchGitHubStatus(config, token)` and `summarizeCIStatus`. Returns `null` when disabled/no-token. Fetches open PRs, CI check-runs per PR (batched), latest deployment. Returns `{ prs, ciSummary, deployment, fetchedAt }`. PR shape: `{ number, title, url, headBranch, storyId, bugId, ciStatus, reviewCount, createdAt }` — `createdAt` is raw ISO string (NOT pre-formatted).
- `generate-plan.js` is now `async`; calls `fetchGitHubStatus` before `renderHtml`; sets `data.githubStatus = null` when GitHub disabled or GITHUB_TOKEN absent.
- **plan-status surfaces:** Masthead CI chip (`N/M PRs ✓ CI`, hidden when total=0) + open PRs chip. Status tab: deployment banner (`pv-gh-deploy-banner`), CI STATUS 5th KPI tile, PR list `<details>` table. Hierarchy/Kanban story rows: `renderGhBadge(id, githubStatus)` inline CI badge + PR link.
- **dashboard surfaces:** GITHUB sidebar widget (between Needs Attention and Event Log); "N PRs need review" in Needs Attention; live bar CI chip via pre-computed `lbCiChip` variable; GitHub event log entries get `border-left:3px solid oklch(60% 0.18 260)` (indigo); `_managePollTimer` in `--watch` mode polls every 60s when `ciPollUntil` is set and any PR CI is pending.
- **Conductor path:** `update-sdlc-status.js` `github-status` async handler writes `sdlcStatus.githubStatus`; detects CI transitions (pending→success/failure), new PRs (opened), disappeared PRs (merged/closed), deployment changes; sets `ciPollUntil = now + 15min` when any PR is pending, clears to null when all terminal.
- Deployment object fields: `{ environment, status, createdAt, ref, url }` — render-tabs must use these names (NOT `env`, `state`, `updatedAt`).
- **Nested template literal pattern:** `generate-dashboard.js` uses one giant template literal — never embed backtick sub-expressions inline. Pre-compute as `const myVar = (() => { ... })()` before `return \``.

---
