-- tools/lib/repository/migrations/005_sdlc_task_lifecycle_fields.sql
-- Adds the lifecycle-bookkeeping columns that `tools/agent-lifecycle.js`
-- needs after migrating to the D.1 entity repos (US-0234 / TASK-0058).
--
-- The legacy JSON writer carried these per-task fields directly in
-- docs/sdlc-status.json; the SQL schema must be able to round-trip them
-- through SdlcTaskRepo.upsert() so the file-locked JSON mirror stays a
-- pure function of SQL state (see L-0076: never silently drops fields).
--
-- All columns are nullable — older rows ingested by migration 005
-- (`tools/lib/migrations/005-ingest-sdlc-status.js`) that did not carry
-- these fields simply remain NULL.
ALTER TABLE sdlc_tasks ADD COLUMN description TEXT;
ALTER TABLE sdlc_tasks ADD COLUMN concerns TEXT;
ALTER TABLE sdlc_tasks ADD COLUMN blocked_reason TEXT;
ALTER TABLE sdlc_tasks ADD COLUMN blocked_resolutions_json TEXT;
ALTER TABLE sdlc_tasks ADD COLUMN retry_count INTEGER;
