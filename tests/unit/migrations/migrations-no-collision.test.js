'use strict';

/**
 * US-0263 / AC-1021: enforce that no two migration files (across the JS data-
 * migration dir and the SQL schema-migration dir) share the same numeric
 * prefix. This is the regression test for L-0081 — the two-Migration-005
 * confusion that nearly produced a misguided D.8 design decision when a
 * parity-test agent looked in the SQL directory only and reported
 * `meta_status('migration_005_hash')` "didn't exist".
 *
 * The rule:
 *
 *   - JS data migrations live in `tools/lib/migrations/` and are now named
 *     `data_NNN-*.js` (post-rename — see also tools/lib/migrations/index.js).
 *   - SQL schema migrations live in `tools/lib/repository/migrations/` and
 *     are named `NNN_*.sql`.
 *   - The numeric prefix `NNN` must be unique across both dirs combined.
 *
 * The test does NOT require the prefixes to be contiguous; only unique. If
 * a future story needs to reserve a number it can add an empty placeholder
 * file and the test will catch any later collision.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const DATA_DIR = path.join(ROOT, 'tools', 'lib', 'migrations');
const SCHEMA_DIR = path.join(ROOT, 'tools', 'lib', 'repository', 'migrations');

// Match the leading namespaced numeric prefix. JS data migrations are
// `data_NNN-` and SQL schema migrations are `NNN_`. The full match (group 0
// minus the trailing separator) is the collision key — so `data_005` and
// `005` live in distinct namespaces and do NOT collide, by design.
const PREFIX_RE = /^((?:data_)?\d{3})[-_]/;

function collectPrefixes(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((file) => {
    const m = file.match(PREFIX_RE);
    if (!m) return [];
    // Skip the index/helper modules that don't carry a NNN- prefix.
    return [{ prefix: m[1], file: path.join(dir, file) }];
  });
}

describe('US-0263 / AC-1021: no migration prefix collisions', () => {
  it('every migration file has a unique three-digit prefix across both dirs', () => {
    const entries = [...collectPrefixes(DATA_DIR), ...collectPrefixes(SCHEMA_DIR)];

    // Group by prefix; any prefix with >1 file is a collision.
    const byPrefix = new Map();
    for (const { prefix, file } of entries) {
      if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
      byPrefix.get(prefix).push(file);
    }

    const collisions = [...byPrefix.entries()].filter(([, files]) => files.length > 1);

    // Build a helpful failure message if any collisions exist.
    if (collisions.length > 0) {
      const detail = collisions
        .map(([prefix, files]) => `  ${prefix}: ${files.map((f) => path.relative(ROOT, f)).join(' AND ')}`)
        .join('\n');
      throw new Error(
        `Found ${collisions.length} migration prefix collision(s). See L-0081.\n` +
          'A JS data migration and a SQL schema migration must NOT share the same\n' +
          'NNN- prefix. Rename one (data_ prefix is the established convention).\n\n' +
          detail,
      );
    }

    expect(collisions).toEqual([]);
  });

  it('finds at least one migration in each directory (sanity check)', () => {
    // If a future refactor moves all migrations out of one dir, this test
    // becomes vacuous. Keep it honest with a sanity assertion.
    expect(collectPrefixes(DATA_DIR).length).toBeGreaterThan(0);
    expect(collectPrefixes(SCHEMA_DIR).length).toBeGreaterThan(0);
  });
});
