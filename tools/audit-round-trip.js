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

const OUT_DIR = '/tmp/docs-pre-norm';
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
fs.writeFileSync(OUT_PATH, lines.join('\n'));
console.log(`Wrote ${OUT_PATH} (${report.totalDivergences} divergences across ${report.totalEntities} entities).`);
if (report.totalDivergences > 0) process.exit(1);
