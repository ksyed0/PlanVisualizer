US-0262 (EPIC-0045): As a developer upgrading from a pre-Phase-E PlanVisualizer, I want Migration 006 to ingest the 9 legacy top-level keys of docs/sdlc-status.json into sdlc_programme SQL on first pv:upgrade, so that consumers reading via reader.X() see the populated programme.\* shape post-migration.
Priority: High (P1)
Estimate: M
Status: Done
Branch: feature/US-0262-migration-006
PR: #1111
Dependencies: US-0259 (EPIC-0045)
Acceptance Criteria:

- [x] AC-1019: tools/lib/migrations/data*006-ingest-legacy-programme.js implements the spec §4.2 algorithm — hash-based idempotency via meta_status('migration_006_hash'); single BEGIN/COMMIT SQL transaction wrapping per-key INSERT…ON CONFLICT; state-B → C ingest happy path; state-C divergence detection via warningsChannel (kind: migration_006_conflict*{K}); single mirror.write() after commit. AC-1019 verified by 19 unit tests in tests/unit/migrations/data_006-ingest-legacy-programme.test.js + 1 integration test in tests/integration/repository/data_006-rollback-roundtrip.test.js (state-B → pv:upgrade → pv:rollback round trip); module coverage 91.48% stmts (≥90% target per spec §6.4)
