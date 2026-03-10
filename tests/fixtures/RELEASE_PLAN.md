# RELEASE_PLAN.md — Fixture

## Epics

```
EPIC-0001: Code Editing
Description: Core editor.
Release Target: MVP (v0.1)
Status: In Progress
Dependencies: None

EPIC-0002: File Management
Description: File Explorer.
Release Target: MVP (v0.1)
Status: Planned
Dependencies: EPIC-0001
```

## User Stories

### EPIC-0001: Code Editing

```
US-0001 (EPIC-0001): As a developer, I want to open a file, so that I can edit code.
Priority: High (P0)
Estimate: M
Status: In Progress
Branch: feature/US-0001-open-file
Acceptance Criteria:
  - [ ] AC-0001: File picker opens
  - [x] AC-0002: Content loads in editor
Dependencies: None
```

```
US-0002 (EPIC-0001): As a developer, I want syntax highlighting, so that I can read code.
Priority: High (P0)
Estimate: L
Status: Planned
Branch:
Acceptance Criteria:
  - [ ] AC-0003: TypeScript highlighted correctly
Dependencies: US-0001
```

## Tasks

```
TASK-0001 (US-0001): Implement CodeMirror 6 in WebView
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0001-open-file
Notes: Evaluate bundle size
```
