#!/usr/bin/env node
'use strict';

/**
 * check-id-registry.js — Validate docs/ID_REGISTRY.md against actual IDs in use.
 *
 * Scans source markdown files for the highest ID in each sequence and compares
 * against the "Next Available ID" in ID_REGISTRY.md.
 *
 * Usage:
 *   node tools/check-id-registry.js           # report drift only
 *   node tools/check-id-registry.js --fix     # also update ID_REGISTRY.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'ID_REGISTRY.md');

const SOURCES = {
  EPIC: ['docs/RELEASE_PLAN.md', 'docs/BUGS.md'],
  US: ['docs/RELEASE_PLAN.md', 'docs/BUGS.md'],
  TASK: ['docs/RELEASE_PLAN.md'],
  AC: ['docs/RELEASE_PLAN.md'],
  TC: ['docs/TEST_CASES.md', 'docs/RELEASE_PLAN.md'],
  BUG: ['docs/BUGS.md'],
  L: ['docs/LESSONS.md'],
  ENH: ['docs/RELEASE_PLAN.md', 'docs/BUGS.md'],
};

function findMax(files, prefix) {
  const re = new RegExp(`\\b${prefix}-(\\d+)\\b`, 'g');
  let max = 0;
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    let m;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

function readRegistry() {
  return fs.readFileSync(REGISTRY_PATH, 'utf8');
}

function parseRegistryNext(content, prefix) {
  const re = new RegExp(`^\\|\\s*${prefix}\\s*\\|\\s*${prefix}-(\\d+)\\s*\\|`, 'm');
  const m = content.match(re);
  return m ? parseInt(m[1], 10) : null;
}

function updateRegistryNext(content, prefix, nextNum) {
  const padded = String(nextNum).padStart(4, '0');
  const lastNum = String(nextNum - 1).padStart(4, '0');
  // Match the table row for this prefix and replace both ID columns
  return content.replace(
    new RegExp(`(\\|\\s*${prefix}\\s*\\|\\s*)${prefix}-\\d+(\\s*\\|\\s*)${prefix}-\\d+(\\s*\\|)`, 'm'),
    `$1${prefix}-${padded}$2${prefix}-${lastNum}$3`,
  );
}

const fix = process.argv.includes('--fix');
let content = readRegistry();
let anyDrift = false;
let anyFix = false;

console.log(`\nID Registry check — ${REGISTRY_PATH}\n`);

for (const [prefix, files] of Object.entries(SOURCES)) {
  const maxActual = findMax(files, prefix);
  const currentNext = parseRegistryNext(content, prefix);

  if (currentNext === null) {
    console.log(`  SKIP  ${prefix}: not found in registry`);
    continue;
  }

  const needsNext = maxActual + 1;
  if (currentNext <= maxActual) {
    anyDrift = true;
    const curStr = `${prefix}-${String(currentNext).padStart(4, '0')}`;
    const maxStr = `${prefix}-${String(maxActual).padStart(4, '0')}`;
    const fixStr = `${prefix}-${String(needsNext).padStart(4, '0')}`;
    if (fix) {
      content = updateRegistryNext(content, prefix, needsNext);
      anyFix = true;
      console.log(`  FIXED ${prefix}: ${curStr} → ${fixStr}  (max in use: ${maxStr})`);
    } else {
      console.log(`  DRIFT ${prefix}: registry=${curStr} but max in use=${maxStr}, should be ${fixStr}`);
    }
  } else {
    const maxStr = maxActual > 0 ? `${prefix}-${String(maxActual).padStart(4, '0')}` : '(none found)';
    console.log(`  OK    ${prefix}: next=${prefix}-${String(currentNext).padStart(4, '0')}  (max in use: ${maxStr})`);
  }
}

if (anyFix) {
  fs.writeFileSync(REGISTRY_PATH, content);
  console.log('\n✅  ID_REGISTRY.md updated. Run again to verify.\n');
} else if (anyDrift) {
  console.error('\n⚠  Drift detected. Run with --fix to update ID_REGISTRY.md.\n');
  process.exit(1);
} else {
  console.log('\n✅  All sequences in sync.\n');
}
