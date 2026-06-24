# CI Contract

> **For Keystone:** Copy this file to `docs/ci-contract.md` and fill in all fields
> during Phase 2 (Architect). Deploy reads `docs/ci-contract.md` before creating
> or updating any CI/CD workflow files.

## Test Commands

- Unit tests: `<command>`
- Coverage: `<command>`
- Coverage threshold: <N>%

## Lint

- Command: `<command>`
- Fail on: errors only (warnings allowed)

## Build

- Command: `<command>` (or "none" if no build step)

## Required Secrets

- `<SECRET_NAME>`: <purpose>

## Deploy Targets

- staging: <platform> (branch/trigger: <branch>)
- production: <platform> (branch/trigger: <branch>)

## Additional Checks

- Dependency audit: `<command>`
- CodeQL: <yes/no — language, query pack>
- Other: <any additional CI steps>

```

```
