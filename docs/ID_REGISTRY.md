# ID Registry

Single source of truth for the next available ID in every artefact sequence.
**Update this file immediately whenever a new artefact is created.**

| **Sequence** | **Next Available ID** | **Last Assigned** |
| ------------ | --------------------- | ----------------- |
| EPIC         | EPIC-0047             | EPIC-0046         |
| US           | US-0269               | US-0268           |
| TASK         | TASK-0071             | TASK-0070         |
| AC           | AC-1048               | AC-1047           |
| TC           | TC-0553               | TC-0552           |
| BUG          | BUG-0267              | BUG-0266          |
| Lesson       | L-0092                | L-0091            |
| ENH          | ENH-0005              | ENH-0004          |

**Rules:**

- Consult this file before creating any artefact to get the next available ID.
- Update immediately after assigning — before writing the artefact content.
- IDs are permanent. Retired artefacts are marked `Status: Retired`, never deleted.
- All cross-references must use the full ID (e.g., `US-0003`, not "the login story").
- Zero-padding to 4 digits is cosmetic. IDs beyond 9999 use 5+ digits naturally (e.g. AC-10000). All parser regexes accept variable-length digit sequences.
