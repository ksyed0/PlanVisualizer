# LESSONS.md — Hard-Won Lessons & Permanent Rules

Encode every bug fix and discovery as a permanent rule. Applied to all future sessions.

---

## L-0001 — Jest upgrade eliminates transitive deprecation warnings
**Rule:** Always upgrade Jest to the latest stable major when transitive dependencies emit deprecation warnings — do not attempt to override or suppress them with resolutions.
*Learned when `inflight@1.0.6` and `glob@7` deprecation warnings appeared after `npm install`. Both are transitive dependencies of `jest@29` and could not be directly overridden. Upgrading to `jest@30` eliminated both with zero test changes.*
**Date:** 2026-03-10

---

## L-0002 — CodeQL requires its own workflow file for custom triggers
**Rule:** Never place CodeQL in the same workflow file as other CI jobs if you need to restrict its triggers. GitHub Actions does not support per-job `on:` conditions — the trigger applies to the entire workflow.
*Learned when designing the CI pipeline. A single ci.yml with CodeQL would run CodeQL on every branch push, burning CI minutes unnecessarily. The fix was a separate codeql.yml with its own `on:` block.*
**Date:** 2026-03-10

---

## L-0003 — Release plan artifacts must be inside fenced code blocks
**Rule:** Never place EPIC/US/TASK definitions outside of triple-backtick fenced code blocks in RELEASE_PLAN.md. The parser (`parse-release-plan.js`) only reads content inside fenced blocks — narrative prose outside is silently ignored.
*Learned when writing the first version of RELEASE_PLAN.md. Artifacts outside code blocks produced zero parsed results.*
**Date:** 2026-03-10
