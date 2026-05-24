US-0242 (EPIC-0040): As any multi-entity writer, I want repo.transaction((tx) => ...) that batches markdown writes until commit in lexicographic lock order, so that story+ACs+ID-registry mutations are atomic.
Priority: High (P1)
Estimate: L
Status: To Do
Plan Task: E.3
Dependencies: US-0240 (EPIC-0040), US-0241 (EPIC-0040)
Acceptance Criteria:

- [ ] AC-0946: transaction(fn) opens a SQLite BEGIN, runs fn against a proxy, acquires file locks in lexicographic path order, flushes pending markdown writes, COMMITs
- [ ] AC-0947: throw inside fn rolls back SQLite and discards staged markdown writes (no files modified)
- [ ] AC-0948: tx.idRegistry.allocate inside a transaction reserves IDs but doesn't write ID_REGISTRY.md until commit; another process blocks on the lock
- [ ] AC-0949: each entity repo implements an \*InTransaction variant that stages into ctx.pendingWrites
