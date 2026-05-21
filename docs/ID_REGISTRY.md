# ID Registry

Single source of truth for the next available ID in every artefact sequence.
**Update this file immediately whenever a new artefact is created.**

| **Sequence** | **Next Available ID** | **Last Assigned** |
| ------------ | --------------------- | ----------------- |
| EPIC         | EPIC-0045             | EPIC-0044         |
| US           | US-0259               | US-0258           |
| TASK         | TASK-0057             | TASK-0056         |
| AC           | AC-1014               | AC-1013           |
| TC           | TC-0553               | TC-0552           |
| BUG          | BUG-0264              | BUG-0263          |
| Lesson       | L-0080                | L-0079            |
| ENH          | ENH-0005              | ENH-0004          |

**Rules:**

- Consult this file before creating any artefact to get the next available ID.
- Update immediately after assigning — before writing the artefact content.
- IDs are permanent. Retired artefacts are marked `Status: Retired`, never deleted.
- All cross-references must use the full ID (e.g., `US-0003`, not "the login story").
- Zero-padding to 4 digits is cosmetic. IDs beyond 9999 use 5+ digits naturally (e.g. AC-10000). All parser regexes accept variable-length digit sequences.
