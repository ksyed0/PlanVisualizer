# Release Plan Format Rules

<!-- complexity: high -->

Artifacts (EPIC/US/TASK) must be inside triple-backtick fenced code blocks. Within each block, artifacts are separated by blank lines (2+ newlines). Format:

```
EPIC-XXXX: Title
Description: ...
Release Target: MVP (v1.0)
Status: Done | In Progress | Planned
Dependencies: None | EPIC-XXXX

US-XXXX (EPIC-XXXX): As a ..., I want ..., so that ...
Priority: High (P0) | Medium (P1) | Low (P2)
Estimate: S | M | L | XL
Status: Done | In Progress | Planned | Blocked | To Do
Branch: feature/US-XXXX-short-name
Acceptance Criteria:
  - [ ] AC-XXXX: Text
  - [x] AC-XXXX: Text (done)
Dependencies: None | US-XXXX

TASK-XXXX (US-XXXX): Imperative description
Type: Dev | Test | Design | docs | Infra | Bug
Assignee: Agent | Human
Status: To Do | In Progress | Done | Blocked
Branch: feature/...
Notes: ...
```

---
