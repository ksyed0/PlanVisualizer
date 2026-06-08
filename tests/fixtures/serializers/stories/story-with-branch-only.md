US-0260 (EPIC-0045): As a non-dashboard consumer of sdlc-status.json (generate-plan, agent-context, agent-spec-plan, init-sdlc-status), I want my reads to go through the US-0259 accessor and my writes to land in canonical {tasks, log, programme} shape, so that the data path is unified and pre-Phase-E fixtures continue to work via the transitional fallback.
Priority: High (P1)
Estimate: M
Status: Done
Branch: feature/US-0260-non-dashboard-consumers
PR: #1106
Acceptance Criteria:

- [x] AC-1017: tools/generate-plan.js:263, tools/agent-context.js:84, tools/agent-spec-plan.js#readStories() all read SDLC stories via reader.stories(sdlc); integration test (tests/integration/non-dashboard-consumers-accessor.test.js) source-grep + accessor-read assertions pass against state-A/B/C fixtures
- [x] AC-1018: tools/init-sdlc-status.js seeds programme.{agents, phases, project} via SdlcProgrammeRepo.set(); fresh init writes Object.keys(json).sort() === ['log','programme','tasks'] and Object.keys(json.programme).sort() === ['agents','phases','project']; idempotent merge — repeat init without --force preserves existing rows; --force overwrites. 8 tests in tests/unit/init-sdlc-status-repeat.test.js cover empty/partial/force scenarios + accessor round-trip
