'use strict';
const { parseLensFindings, CANONICAL_PERSONAS } = require('../../tools/lib/lens-findings-parser');

describe('parseLensFindings', () => {
  test('parses single-tag finding: primary set, cc empty', () => {
    const md = `## Findings
- @compass: AC-007 missing edge case for empty list`;
    const f = parseLensFindings(md);
    expect(f).toHaveLength(1);
    expect(f[0].primary).toBe('compass');
    expect(f[0].cc).toEqual([]);
    expect(f[0].text).toContain('AC-007 missing edge case');
  });

  test('parses multi-tag finding: first tag = primary, rest = cc', () => {
    const md = `## Findings
- @compass @keystone: behavior X is underspecified`;
    const f = parseLensFindings(md);
    expect(f[0].primary).toBe('compass');
    expect(f[0].cc).toEqual(['keystone']);
  });

  test('parses multiple findings into array', () => {
    const md = `## Findings
- @compass: missing AC
- @palette: contrast ratio too low
- @pixel: form error state missing`;
    const f = parseLensFindings(md);
    expect(f).toHaveLength(3);
    expect(f.map((x) => x.primary)).toEqual(['compass', 'palette', 'pixel']);
  });

  test('lowercases tags', () => {
    const md = `## Findings
- @Compass: x
- @PALETTE: y`;
    const f = parseLensFindings(md);
    expect(f[0].primary).toBe('compass');
    expect(f[1].primary).toBe('palette');
  });

  test('skips bullets without @persona tags', () => {
    const md = `## Findings
- this is a free-form comment
- @compass: actual finding
- another comment`;
    const f = parseLensFindings(md);
    expect(f).toHaveLength(1);
    expect(f[0].primary).toBe('compass');
  });

  test('returns empty array when no findings section', () => {
    expect(parseLensFindings('## Other Section\n- @compass: x')).toEqual([]);
  });

  test('returns empty array on empty input', () => {
    expect(parseLensFindings('')).toEqual([]);
  });

  test('handles findings section at end of file without trailing newline', () => {
    const md = `## Findings\n- @compass: x`;
    expect(parseLensFindings(md)).toHaveLength(1);
  });

  test('stops parsing at next ## section', () => {
    const md = `## Findings
- @compass: x
## Other
- @palette: should not be parsed`;
    expect(parseLensFindings(md)).toHaveLength(1);
  });

  test('exports canonical persona list', () => {
    expect(CANONICAL_PERSONAS).toContain('compass');
    expect(CANONICAL_PERSONAS).toContain('palette');
    expect(CANONICAL_PERSONAS).toContain('pixel');
    expect(CANONICAL_PERSONAS).toContain('keystone');
    expect(CANONICAL_PERSONAS).toContain('lens');
    expect(CANONICAL_PERSONAS).toContain('forge');
    expect(CANONICAL_PERSONAS).toContain('sentinel');
    expect(CANONICAL_PERSONAS).toContain('circuit');
    expect(CANONICAL_PERSONAS).toContain('plan-author');
  });

  test('flags unknown personas with warning property on finding', () => {
    const md = `## Findings
- @unknown-bot: this won't route anywhere known`;
    const f = parseLensFindings(md);
    expect(f[0].primary).toBe('unknown-bot');
    expect(f[0].warning).toMatch(/unknown persona/i);
  });
});
