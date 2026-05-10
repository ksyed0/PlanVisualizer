'use strict';
const fs = require('fs');
const path = require('path');
const { readEntries, renderIndex } = require('./memory-index');

function validateMemory(opts) {
  const { root } = opts;
  const entries = readEntries(root);
  const memoryPath = path.join(root, 'MEMORY.md');
  const memoryExists = fs.existsSync(memoryPath);

  // Fresh install: no docs/memory, no MEMORY.md → ok.
  if (entries.length === 0 && !memoryExists) return { ok: true, diff: '' };
  // Topic files exist but MEMORY.md missing → drift.
  if (entries.length > 0 && !memoryExists) {
    return { ok: false, diff: 'MEMORY.md is missing but topic files exist in docs/memory/.' };
  }
  // No topic files but MEMORY.md exists → pre-migration state; treat as ok.
  if (entries.length === 0 && memoryExists) return { ok: true, diff: '' };

  const expected = renderIndex(entries) + '\n';
  const actual = fs.readFileSync(memoryPath, 'utf8');
  if (actual === expected) return { ok: true, diff: '' };

  const expLines = expected.split('\n');
  const actLines = actual.split('\n');
  const diffLines = ['--- MEMORY.md (current)', '+++ MEMORY.md (expected)'];
  const max = Math.max(expLines.length, actLines.length);
  for (let i = 0; i < max; i++) {
    if (actLines[i] !== expLines[i]) {
      if (actLines[i] !== undefined) diffLines.push(`-${actLines[i]}`);
      if (expLines[i] !== undefined) diffLines.push(`+${expLines[i]}`);
    }
  }
  return { ok: false, diff: diffLines.join('\n') };
}

module.exports = { validateMemory };
