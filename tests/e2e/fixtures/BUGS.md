<!-- tests/e2e/fixtures/BUGS.md -->

# BUGS.md — E2E Test Fixture

---

### BUG-T001 — Login redirect loop on expired token

Status: Fixed
Severity: High
Reported: 2026-01-10
Fixed: 2026-01-12

**Root cause:** Token expiry check ran after redirect, not before.
**Fix:** Moved expiry check to middleware.

---

### BUG-T002 — CSV export omits the header row

Status: Fixed
Severity: Medium
Reported: 2026-01-15
Fixed: 2026-01-16

**Root cause:** Header write was conditional on a flag that defaulted false.
**Fix:** Default the flag to true.

---

### BUG-T003 — Search results flicker on rapid keystrokes

Status: Open
Severity: Low
Reported: 2026-02-01

**Steps to reproduce:** Type quickly in the search field. Results flash blank between keystrokes.

---

### BUG-T004 — Webhook retries do not honour exponential back-off

Status: In Progress
Severity: High
Reported: 2026-02-10

**Root cause under investigation.** Retry interval appears to be fixed at 1 second regardless of attempt count.

---

### BUG-T005 — Dark mode toggle ignored on Safari

Status: WontFix
Severity: Low
Reported: 2026-02-20

**Decision:** Safari < 16 does not support the CSS `color-scheme` property. Supporting it requires a JavaScript polyfill. Deferred indefinitely — browser share < 2%.
