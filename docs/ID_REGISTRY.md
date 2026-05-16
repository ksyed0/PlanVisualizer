# ID Registry

Single source of truth for the next available ID in every artefact sequence.
**Update this file immediately whenever a new artefact is created.**

| **Sequence** | **Next Available ID** | **Last Assigned** |
| ------------ | --------------------- | ----------------- |
| EPIC         | EPIC-0028             | EPIC-0027         |
| US           | US-0185               | US-0184           |
| TASK         | TASK-0055             | TASK-0054         |
| AC           | AC-0726               | AC-0725           |
| TC           | TC-0553               | TC-0552           |
| BUG          | BUG-0258              | BUG-0257          |
| Lesson       | L-0057                | L-0056            |

**Rules:**

- Consult this file before creating any artefact to get the next available ID.
- Update immediately after assigning — before writing the artefact content.
- IDs are permanent. Retired artefacts are marked `Status: Retired`, never deleted.
- All cross-references must use the full ID (e.g., `US-0003`, not "the login story").
- Zero-padding to 4 digits is cosmetic. IDs beyond 9999 use 5+ digits naturally (e.g. AC-10000). All parser regexes accept variable-length digit sequences.
