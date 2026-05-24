US-0259 (EPIC-0045): As a dashboard consumer, I want to read SDLC status through a single dual-read accessor module so that the migration window between US-0259 merge and Migration 006 ingest (US-0262) doesn't blank the dashboard, and so that the dashboard + browser-side ticker share one source of truth for the 9 legacy keys.
Priority: High (P1)
Estimate: M
Status: Done
Branch: feature/US-0259-accessor-and-dashboard
PR: #1102
Dependencies: EPIC-0039 (Phase D — SdlcStatus cutover)
Acceptance Criteria:

- [x] AC-1015: tools/lib/repository/sdlc-status-reader.js exports 10 dual-read accessor functions (programme + 9 keys); 85 unit tests prove state-A (canonical-only programme.\*) and state-B (legacy top-level) return deep-equal values for every non-container accessor; module coverage 100% stmts/branch/func/lines
- [x] AC-1016: tools/generate-dashboard.js + the regenerated docs/dashboard.html route every status.{agents,metrics,stories,epics,phases,cycles,currentPhase,githubStatus,project} read through the accessor (Node side via require, browser side via injected window.pvReader); generateHTML() renders against state-A/B/C fixtures with all 4 canonical agent names visible
