# Phase E test fixtures

Shared fixtures for US-0259..US-0263 (EPIC-0045). See `docs/superpowers/specs/2026-05-22-phase-e-consumer-migration-design.md` §6.1.1 and `docs/superpowers/specs/2026-05-22-us-0259-accessor-api-design.md` §5.

| Fixture                    | Shape                                            | Used to prove                                                    |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| `state-a.json`             | Canonical-only — `programme.*`                   | Post-Phase-E target; accessor reads `programme.*` directly       |
| `state-b.json`             | Legacy-only — top-level keys, `programme: {}`    | Pre-D.4 shape; accessor dual-read falls back to top level        |
| `state-c.json`             | Both `programme.*` AND top-level, in sync        | Preservation-doubled (transitional)                              |
| `state-c-conflict.json`    | Both populated, top-level `agents` diverged      | Migration 006 divergence handling (US-0262)                      |
| `malformed-programme.json` | `{programme: null}`                              | Accessors must not crash                                         |
| `wrong-type-cycles.json`   | `programme.cycles: null`, top-level `cycles: ""` | `cycles()` defends against non-array values                      |
| `current-phase-zero.json`  | `programme.currentPhase: 0`                      | Regression: `currentPhase` must NOT fall through `\|\|` chain    |
| `github-status-null.json`  | `programme.githubStatus: null`                   | `githubStatus()` returns `null` (not `{}`) as the absence signal |
| `empty-programme.json`     | `{programme: {}}`                                | Every accessor falls through to its safe default                 |

`state-a.json` and `state-b.json` are **content-equivalent** by construction: the accessor module must return identical values for every key against both fixtures. This is the core AC-1015 assertion.

`_canonical-content.json` is the shared source content used to build `state-a.json` and `state-b.json`. It is not consumed directly by tests.
