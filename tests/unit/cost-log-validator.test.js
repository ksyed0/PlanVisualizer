'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { lintCostLog, lintCostLogContent } = require('../../tools/lib/repository/validators/cost-log');

describe('lintCostLogContent', () => {
  it('returns no warnings for clean content', () => {
    const clean = fs.readFileSync(path.join(__dirname, '../fixtures/AI_COST_LOG.md'), 'utf8');
    expect(lintCostLogContent(clean)).toEqual([]);
  });

  it('flags conflict-marker lines', () => {
    const warnings = lintCostLogContent(
      '| a | b |\n<<<<<<< Updated upstream\n| c | d |\n=======\n| e | f |\n>>>>>>> Stashed changes\n',
    );
    const codes = warnings.map((w) => w.code);
    expect(codes).toEqual(['cost-log-corruption', 'cost-log-corruption', 'cost-log-corruption']);
  });

  it('flags lines with the corrupted "> > > > > > > " prefix', () => {
    const warnings = lintCostLogContent('> > > > > > > | 2026-05-05 | sess | branch | 1 | 1 | 1 | 0.1 |\n');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('cost-log-corruption');
    expect(warnings[0].line).toBe(1);
  });

  it('does not flag a normal markdown table row', () => {
    expect(lintCostLogContent('| 2026-05-05 | sess | branch | 1 | 1 | 1 | 0.1 |\n')).toEqual([]);
  });
});

describe('lintCostLog (file-based)', () => {
  it('returns [] when the target file does not exist', () => {
    expect(lintCostLog({ root: os.tmpdir(), file: 'does-not-exist.md' })).toEqual([]);
  });

  it('reads and lints the real repo file with zero violations post-cleanup', () => {
    expect(lintCostLog({ root: path.join(__dirname, '../..') })).toEqual([]);
  });

  it('flags a corrupted fixture written to a temp file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-log-lint-'));
    fs.writeFileSync(path.join(dir, 'docs-cost.md'), '<<<<<<< Updated upstream\n| a | b |\n=======\n');
    const warnings = lintCostLog({ root: dir, file: 'docs-cost.md' });
    expect(warnings.length).toBeGreaterThan(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
