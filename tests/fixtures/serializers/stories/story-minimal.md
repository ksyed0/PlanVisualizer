US-0241 (EPIC-0040): As a story creator, I want repo.idRegistry.allocate(sequence, count) that bypasses the index and reads/writes ID_REGISTRY.md under a file lock, so that allocations never collide across concurrent writers.
Priority: High (P1)
Estimate: M
Status: To Do
Plan Task: E.2
Related Bug: BUG-0258
Acceptance Criteria:

- [ ] AC-0943: id-allocator.js reads ID_REGISTRY.md inside withFileLock, bumps next_id by count, returns the allocated IDs
- [ ] AC-0944: bumps last_assigned to the highest allocated ID; rewrites the registry table row in place preserving column alignment
- [ ] AC-0945: count=1 returns a string; count>1 returns an array of contiguous IDs
