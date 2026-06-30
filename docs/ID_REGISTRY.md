# ID Registry

Single source of truth for the next available ID in every artefact sequence.
**Update this file immediately whenever a new artefact is created.**

| **Sequence** | **Next Available ID** | **Last Assigned** |
| ------------ | --------------------- | ----------------- |
| EPIC         | EPIC-0050             | EPIC-0049         |
| US           | US-0274               | US-0273           |
| TASK         | TASK-0071             | TASK-0070         |
| AC           | AC-1063               | AC-1062           |
| TC           | TC-0555               | TC-0554           |
| BUG          | BUG-0270              | BUG-0269          |
| Lesson       | L-0098                | L-0097            |
| ENH          | ENH-0016              | ENH-0015          |

**Rules:**

- Consult this file before creating any artefact to get the next available ID.
- Update immediately after assigning — before writing the artefact content.
- IDs are permanent. Retired artefacts are marked `Status: Retired`, never deleted.
- All cross-references must use the full ID (e.g., `US-0003`, not "the login story").
- Zero-padding to 4 digits is cosmetic. IDs beyond 9999 use 5+ digits naturally (e.g. AC-10000). All parser regexes accept variable-length digit sequences.
