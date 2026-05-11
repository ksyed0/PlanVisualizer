# Parser Contracts

<!-- complexity: high -->

All parsers: `(markdown: string) → Array` — never throw, empty string input returns `[]`.

| Module                  | Input                 | Key output fields                                                                                                                |
| ----------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `parse-release-plan.js` | RELEASE_PLAN.md       | `epics[]`, `stories[]`, `tasks[]`                                                                                                |
| `parse-test-cases.js`   | TEST_CASES.md         | `testCases[{ id, relatedStory, relatedAC, status }]`                                                                             |
| `parse-bugs.js`         | BUGS.md               | `bugs[{ id, severity, relatedStory, status, fixBranch }]`                                                                        |
| `parse-cost-log.js`     | AI_COST_LOG.md        | `rows[{ date, branch, inputTokens, outputTokens, costUsd }]`                                                                     |
| `parse-coverage.js`     | coverage-summary.json | `{ lines, statements, functions, branches, overall, meetsTarget, available }` — `available: false` when file absent or malformed |
| `parse-progress.js`     | progress.md           | `activity[{ date, summary }]`                                                                                                    |

---
