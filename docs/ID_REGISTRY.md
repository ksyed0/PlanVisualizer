# ID Registry

Single source of truth for the next available ID in every artefact sequence.
**Update this file immediately whenever a new artefact is created.**

| **Sequence** | **Next Available ID** | **Last Assigned** |
| ------------ | --------------------- | ----------------- |
| EPIC         | EPIC-0042             | EPIC-0041         |
| US           | US-0253               | US-0252           |
| TASK         | TASK-0055             | TASK-0054         |
| AC           | AC-0980               | AC-0979           |
| TC           | TC-0553               | TC-0552           |
| BUG          | BUG-0260              | BUG-0259          |
| Lesson       | L-0066                | L-0065            |

**Rules:**

- Consult this file before creating any artefact to get the next available ID.
- Update immediately after assigning — before writing the artefact content.
- IDs are permanent. Retired artefacts are marked `Status: Retired`, never deleted.
- All cross-references must use the full ID (e.g., `US-0003`, not "the login story").
- Zero-padding to 4 digits is cosmetic. IDs beyond 9999 use 5+ digits naturally (e.g. AC-10000). All parser regexes accept variable-length digit sequences.
