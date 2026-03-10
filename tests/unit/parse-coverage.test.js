// tests/unit/parse-coverage.test.js
'use strict';
const { parseCoverage } = require('../../tools/lib/parse-coverage');

const fixture = require('../fixtures/coverage-summary.json');

describe('parseCoverage', () => {
  let result;
  beforeAll(() => { result = parseCoverage(fixture); });

  it('returns lines pct', () => expect(result.lines).toBe(84.5));
  it('returns statements pct', () => expect(result.statements).toBe(83.2));
  it('returns functions pct', () => expect(result.functions).toBe(87.1));
  it('returns branches pct', () => expect(result.branches).toBe(81.0));
  it('returns overall as min of all four', () => expect(result.overall).toBe(81.0));
  it('returns meetsTarget true when all >= 80', () => expect(result.meetsTarget).toBe(true));
});
