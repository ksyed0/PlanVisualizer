#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { auditAll } = require('./lib/repository/round-trip-audit');

const ROOT = process.cwd();
const TARGETS = [
  { path: path.join(ROOT, 'docs', 'RELEASE_PLAN.md'), kind: 'release-plan' },
  { path: path.join(ROOT, 'docs', 'BUGS.md'), kind: 'bugs' },
  { path: path.join(ROOT, 'docs', 'LESSONS.md'), kind: 'lessons' },
  { path: path.join(ROOT, 'docs', 'TEST_CASES.md'), kind: 'test-cases' },
];

// Project-local cache (gitignored). Was /tmp/docs-pre-norm/ but CodeQL's
// js/insecure-temporary-file rule flagged any write to a predictable /tmp
// path. Relocating here makes the audit report discoverable next to the
// project and sidesteps the rule entirely.
const OUT_DIR = path.join(ROOT, '.pv-cache', 'docs-pre-norm');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_PATH = path.join(OUT_DIR, '_round-trip-audit.txt');

const report = auditAll(TARGETS.filter((t) => fs.existsSync(t.path)));
const lines = [];
lines.push(`Round-trip completeness audit — ${new Date().toISOString()}`);
lines.push(`Total files: ${report.totalFiles}`);
lines.push(`Total entities parsed: ${report.totalEntities}`);
lines.push(`Total divergences: ${report.totalDivergences}`);
lines.push('');
for (const f of report.perFile) {
  lines.push(`=== ${f.path} (${f.kind}) ===`);
  lines.push(`  entities parsed: ${f.entitiesParsed}`);
  lines.push(`  divergences: ${f.divergences.length}`);
  for (const d of f.divergences) {
    lines.push(`    - ${d.entityKind}/${d.entityId} field=${d.field}`);
    lines.push(`        original:     ${JSON.stringify(d.original)}`);
    lines.push(`        roundTripped: ${JSON.stringify(d.roundTripped)}`);
  }
  lines.push('');
}
// Write with O_NOFOLLOW for defense-in-depth: even though OUT_DIR is now
// project-local, a hostile process could still plant a symlink inside
// .pv-cache/ before the CLI runs. O_NOFOLLOW makes that case throw ELOOP
// rather than clobber the symlink target.
const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW;
const fd = fs.openSync(OUT_PATH, flags, 0o644);
fs.writeSync(fd, lines.join('\n'));
fs.closeSync(fd);
console.log(`Wrote ${OUT_PATH} (${report.totalDivergences} divergences across ${report.totalEntities} entities).`);
if (report.totalDivergences > 0) process.exit(1);
