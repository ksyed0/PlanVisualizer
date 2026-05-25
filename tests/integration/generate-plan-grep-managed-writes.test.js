'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'tools', 'generate-plan.js');

// EXEMPT classification — generated outputs, debug, cache, /tmp.
const EXEMPT_BASENAME_RES = [
  /plan-status\.(json|html)/, // generated dashboard outputs
  /\.cache\//,
  /\/tmp\//,
];

// MANAGED classification — source-of-truth; must go through repo.
const MANAGED_FILENAMES = new Set([
  'RELEASE_PLAN.md',
  'BUGS.md',
  'LESSONS.md',
  'TEST_CASES.md',
  'ID_REGISTRY.md',
  'sdlc-status.json',
]);

describe('US-0245 / AC-0957..0958: generate-plan.js managed-path write gate', () => {
  const source = fs.readFileSync(FILE, 'utf8');

  it('no fs.write/append call targets a known managed file by name', () => {
    const callRe = /fs\.(writeFileSync|appendFileSync)\s*\(\s*([^,)\s]+)/g;
    const hits = [];
    let m;
    while ((m = callRe.exec(source)) !== null) {
      const lineNum = source.slice(0, m.index).split('\n').length;
      const ctxStart = Math.max(0, m.index - 200);
      const ctxEnd = Math.min(source.length, m.index + 200);
      const ctx = source.slice(ctxStart, ctxEnd);
      for (const fname of MANAGED_FILENAMES) {
        if (ctx.includes(fname)) {
          hits.push({ line: lineNum, call: m[0], filename: fname });
        }
      }
    }
    if (hits.length > 0) {
      throw new Error(
        `generate-plan.js writes to managed paths directly:\n` +
          hits.map((h) => `  L${h.line}: ${h.call} → mentions ${h.filename}`).join('\n'),
      );
    }
  });

  it('every remaining fs.write call resolves to an EXEMPT path (sanity check)', () => {
    const callRe = /fs\.writeFileSync\s*\(\s*(\w+)/g;
    const varHits = [];
    let m;
    while ((m = callRe.exec(source)) !== null) {
      const lineNum = source.slice(0, m.index).split('\n').length;
      varHits.push({ varName: m[1], line: lineNum, index: m.index });
    }
    for (const v of varHits) {
      // Search backwards from the writeFileSync call to find the variable assignment
      const beforeCall = source.slice(0, v.index);
      const varName = v.varName;

      // Look for: const varName = ... or varName = ...
      const defRe = new RegExp(`(?:const\\s+)?${varName}\\s*=\\s*([^;]+);`, 'g');
      const matches = [...beforeCall.matchAll(defRe)];

      if (matches.length === 0) {
        // Variable not found locally, might be a parameter or global — skip
        continue;
      }

      const lastMatch = matches[matches.length - 1];
      const defText = lastMatch[0];
      const isExempt = EXEMPT_BASENAME_RES.some((re) => re.test(defText));

      expect({ var: varName, line: v.line, def: defText, exempt: isExempt }).toMatchObject({ exempt: true });
    }
  });
});
