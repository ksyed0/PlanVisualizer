<!-- tests/e2e/fixtures/RELEASE_PLAN.md -->

# RELEASE_PLAN.md — E2E Test Fixture

> This file uses T-namespace IDs (EPIC-T, US-T, AC-T) to avoid colliding
> with production ID sequences. Do not use these IDs in real project files.

## Epics

- EPIC-T001: E2E Fixture — Completed Work
- EPIC-T002: E2E Fixture — Active Work
- EPIC-T003: E2E Fixture — Planned Work

---

## Epic — EPIC-T001: E2E Fixture — Completed Work

```
EPIC-T001: E2E Fixture — Completed Work
Description: Completed stories used as e2e test fixtures. All stories Done.
Status: Done
```

## User Stories — EPIC-T001

```
US-T001 (EPIC-T001): E2E-Fixture: As a user, I want to log in so that I can access my account.
Priority: High (P0)
Estimate: S
Status: Done
Acceptance Criteria:

- [x] AC-T001: Login form accepts email and password and submits on Enter
- [x] AC-T002: Invalid credentials show an inline error message within 500 ms
```

```
US-T002 (EPIC-T001): E2E-Fixture: As a user, I want my session to persist across page reloads.
Priority: High (P0)
Estimate: XS
Status: Done
Acceptance Criteria:

- [x] AC-T003: Reloading the page does not redirect to login when a valid session exists
- [x] AC-T004: Session expires after 30 minutes of inactivity
```

```
US-T003 (EPIC-T001): E2E-Fixture: As an admin, I want to view an audit log of all user actions.
Priority: Medium (P1)
Estimate: M
Status: Done
Acceptance Criteria:

- [x] AC-T005: Audit log table shows actor, action, and timestamp columns
- [x] AC-T006: Audit log is paginated at 50 rows per page
```

---

## Epic — EPIC-T002: E2E Fixture — Active Work

```
EPIC-T002: E2E Fixture — Active Work
Description: Stories currently in flight for e2e testing coverage of in-progress states.
Status: In Progress
```

## User Stories — EPIC-T002

```
US-T004 (EPIC-T002): E2E-Fixture: As a user, I want to search records by keyword so that I can find items quickly.
Priority: High (P1)
Estimate: M
Status: In Progress
Acceptance Criteria:

- [x] AC-T007: Search input debounces at 300 ms before sending a request
- [ ] AC-T008: Search results highlight the matching keyword in each row
```

```
US-T005 (EPIC-T002): E2E-Fixture: As a user, I want to export data as CSV so that I can analyse it offline.
Priority: Medium (P1)
Estimate: S
Status: Blocked
Acceptance Criteria:

- [ ] AC-T009: Export button generates a valid RFC 4180 CSV file
- [ ] AC-T010: CSV filename includes the current date in YYYY-MM-DD format
```

```
US-T006 (EPIC-T002): E2E-Fixture: As a developer, I want all mutations to emit structured events so that integrations can react to changes.
Priority: Low (P2)
Estimate: L
Status: Planned
Acceptance Criteria:

- [ ] AC-T011: Each mutation emits an event with type, payload, and timestamp fields
- [ ] AC-T012: Events are published to a configurable webhook URL if set
```

---

## Epic — EPIC-T003: E2E Fixture — Planned Work

```
EPIC-T003: E2E Fixture — Planned Work
Description: Stories not yet started, covering planned and to-do states.
Status: Planned
```

## User Stories — EPIC-T003

```
US-T007 (EPIC-T003): E2E-Fixture: As a manager, I want a summary dashboard so that I can see key metrics at a glance.
Priority: High (P1)
Estimate: L
Status: Planned
Acceptance Criteria:

- [ ] AC-T013: Dashboard shows total record count, active users, and error rate
- [ ] AC-T014: Metrics refresh automatically every 60 seconds
```

```
US-T008 (EPIC-T003): E2E-Fixture: As an operator, I want API rate limiting so that the service remains stable under load.
Priority: High (P0)
Estimate: M
Status: To Do
Acceptance Criteria:

- [ ] AC-T015: Requests exceeding 100 per minute per IP receive HTTP 429
- [ ] AC-T016: Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining) are included in every response
```

```
US-T009 (EPIC-T003): E2E-Fixture: As a developer, I want webhook delivery retries so that transient failures do not cause data loss.
Priority: Medium (P1)
Estimate: M
Status: To Do
Acceptance Criteria:

- [ ] AC-T017: Failed webhook deliveries are retried up to 3 times with exponential back-off
- [ ] AC-T018: After 3 failures the event is written to a dead-letter queue
```

```
US-T010 (EPIC-T003): E2E-Fixture: As a mobile user, I want the UI to be responsive so that I can use it on a phone.
Priority: Medium (P2)
Estimate: S
Status: To Do
Acceptance Criteria:

- [ ] AC-T019: All primary actions are reachable on a 375 px wide viewport
- [ ] AC-T020: No horizontal scrollbar appears on screens narrower than 400 px
```

```
US-T011 (EPIC-T003): E2E-Fixture: As a user, I want dark mode so that I can use the app comfortably at night.
Priority: Low (P2)
Estimate: S
Status: Planned
Acceptance Criteria:

- [ ] AC-T021: Dark mode activates when the OS prefers-color-scheme is dark
- [ ] AC-T022: A toggle in the settings panel overrides the OS preference
```

```
US-T012 (EPIC-T003): E2E-Fixture: As an SRE, I want performance monitoring so that I can detect regressions before they affect users.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:

- [ ] AC-T023: P95 response time is reported per endpoint in the metrics dashboard
- [ ] AC-T024: An alert fires when P95 exceeds 500 ms for more than 5 minutes
```
