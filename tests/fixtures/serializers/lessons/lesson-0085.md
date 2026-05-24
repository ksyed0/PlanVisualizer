## L-0085 — Subagents drift out of scope when fixing test failures inline; verify the actual file list against the expected scope before accepting "DONE"

**Rule:** After any subagent's `Status: DONE`, the controller MUST verify the commit against the expected file list before accepting the report.

_Session 59, EPIC-0045 Phase E._

**Date:** 2026-05-24

**Bugs:** BUG-0003
