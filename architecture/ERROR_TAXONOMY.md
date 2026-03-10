# Error Taxonomy — PlanVisualizer

Defines the project-wide error classification hierarchy for consistent error handling.

---

## Error Categories

### ValidationError
Bad or unexpected input from the user or a config file.

**Examples:**
- `plan-visualizer.config.json` contains an invalid JSON syntax
- A required config key is present but has the wrong type (e.g., `costs.hourlyRate` is a string)
- A markdown file path in config does not exist (logged as a warning, not fatal — parsers handle missing files gracefully)

**Handling:** Log the issue to stderr; fall back to defaults where possible; exit with code 1 only if the error is unrecoverable.

---

### IntegrationError
An external system (filesystem, git, stdin) failed.

**Examples:**
- `git rev-parse --abbrev-ref HEAD` exits non-zero (not in a git repo)
- `fs.writeFileSync` fails due to permissions or a full disk
- `process.stdin` yields no data in `capture-cost.js`

**Handling:** Catch with a try/catch; log to `process.stderr`; degrade gracefully (e.g., use `'unknown'` as branch name when git is unavailable). Do not crash the process unless the output cannot be written.

---

### BusinessLogicError
A constraint of the domain was violated.

**Examples:**
- A story references an epic ID that does not exist in the release plan
- A test case references a story ID not found in the release plan
- Coverage threshold is configured below 0 or above 100

**Handling:** Log a warning to stderr during HTML generation; render the dashboard with the available data; do not crash.

---

### SystemError
An unexpected internal failure — a catch-all for unanticipated exceptions.

**Examples:**
- An uncaught exception in a parser due to an unexpected markdown format
- A regex with a catastrophic backtrack (should never happen with current patterns)
- An out-of-memory condition during large document generation

**Handling:** Catch at the top level of `main()` in `generate-plan.js`; log the stack trace to stderr; exit with code 1.

---

## Error Logging Standard

All errors must be logged to `process.stderr` with:
- `[module-name]` prefix (e.g., `[generate-plan]`, `[capture-cost]`)
- Error category (where applicable)
- Human-readable message
- Context (which file, which story ID, which config key)

Example:
```
[generate-plan] IntegrationError: Could not read Docs/RELEASE_PLAN.md — using empty data
[capture-cost] IntegrationError: git rev-parse failed — using branch 'unknown'
```

Do not expose internal stack traces to end users. Log stack traces to stderr only in `SystemError` scenarios.
