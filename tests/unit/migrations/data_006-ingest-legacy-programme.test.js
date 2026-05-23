'use strict';

/**
 * US-0262 / AC-1019: Migration 006 — ingest legacy top-level into SQL.
 *
 * Test matrix (spec §6.2):
 *   1. State A (already canonical)     — no-op, hash persisted.
 *   2. State B → C (ingest happy path) — all 9 rows present in sdlc_programme.
 *   3. State C (divergence)            — warning logged, SQL unchanged.
 *   4. Idempotency                     — second run returns {skipped:'idempotent'}.
 *   5. Snapshot completeness           — per-migration snapshot has all 9 keys.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const mig = require('../../../tools/lib/migrations/data_006-ingest-legacy-programme');
const { Repository } = require('../../../tools/lib/repository');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'fixtures', 'phase-e');
const loadFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));

function mkRoot(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

function writeFixtureToRoot(root, name) {
  const fixture = loadFixture(name);
  fs.writeFileSync(path.join(root, 'docs', 'sdlc-status.json'), JSON.stringify(fixture, null, 2));
  return fixture;
}

describe('Migration 006 — data_006-ingest-legacy-programme', () => {
  afterEach(() => Repository._reset());

  describe('module surface', () => {
    it('exports up, touches, HASH_KEY', () => {
      expect(typeof mig.up).toBe('function');
      expect(Array.isArray(mig.touches)).toBe(true);
      expect(mig.touches).toContain('docs/sdlc-status.json');
      expect(typeof mig.HASH_KEY).toBe('string');
      expect(mig.HASH_KEY).toBe('migration_006_hash');
    });
  });

  describe('state A (canonical-only) — no-op happy path', () => {
    let root;
    let result;

    beforeAll(async () => {
      root = mkRoot('us0262-stateA-');
      const fixture = writeFixtureToRoot(root, 'state-a.json');
      // Seed SQL with the programme data from the fixture (state-A assumes
      // SQL is already authoritative and populated).
      Repository._reset();
      const repo = Repository.getInstance({ root });
      for (const [k, v] of Object.entries(fixture.programme || {})) {
        await repo.sdlcProgramme.set(k, v);
      }
      Repository._reset();
      result = await mig.up({ root });
    });

    afterAll(() => {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('returns ingested counts (zero on state-A since legacy top-level is empty)', () => {
      expect(result).toHaveProperty('ingested');
      expect(result.ingested).toBe(0);
    });

    it('does not mutate the existing programme rows (state-A had them populated already)', () => {
      Repository._reset();
      const repo = Repository.getInstance({ root });
      // state-a fixture has programme.agents populated; migration must NOT clobber it.
      const agents = repo.sdlcProgramme.get('agents');
      expect(agents).not.toBeNull();
      expect(Object.keys(agents).length).toBeGreaterThan(0);
    });

    it('persists migration_006_hash in meta_status', () => {
      Repository._reset();
      const repo = Repository.getInstance({ root });
      const row = repo.index.prepare('SELECT value FROM meta_status WHERE key=?').get(mig.HASH_KEY);
      expect(row).toBeDefined();
      expect(typeof row.value).toBe('string');
      expect(row.value.length).toBe(64); // sha256 hex
    });
  });

  describe('idempotency — second invocation is a no-op', () => {
    let root;

    beforeAll(async () => {
      root = mkRoot('us0262-idem-');
      const fixture = writeFixtureToRoot(root, 'state-a.json');
      Repository._reset();
      const repo = Repository.getInstance({ root });
      for (const [k, v] of Object.entries(fixture.programme || {})) {
        await repo.sdlcProgramme.set(k, v);
      }
      Repository._reset();
      await mig.up({ root });
      Repository._reset();
    });

    afterAll(() => {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('returns {skipped: "idempotent"} on second call with matching mirror hash', async () => {
      const second = await mig.up({ root });
      expect(second).toEqual({ skipped: 'idempotent' });
    });
  });
});
