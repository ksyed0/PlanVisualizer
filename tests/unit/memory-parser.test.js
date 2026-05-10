'use strict';
const { parseMemory } = require('../../tools/lib/memory-parser');

describe('parseMemory', () => {
  test('splits H2 sections', () => {
    const text = [
      '# MEMORY.md',
      '',
      'Intro paragraph.',
      '',
      '---',
      '',
      '## Section One',
      '',
      'Body of one.',
      '',
      '## Section Two',
      '',
      'Body of two.',
    ].join('\n');
    const result = parseMemory(text);
    expect(result.header).toContain('# MEMORY.md');
    expect(result.header).toContain('Intro paragraph');
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toBe('Section One');
    expect(result.sections[0].body.trim()).toBe('Body of one.');
    expect(result.sections[1].heading).toBe('Section Two');
    expect(result.sections[1].body.trim()).toBe('Body of two.');
  });

  test('preserves heading whitespace and content verbatim in raw', () => {
    const text = '## My Title\n\n- item one\n- item two\n';
    const result = parseMemory(text);
    expect(result.sections[0].raw).toBe('## My Title\n\n- item one\n- item two\n');
  });

  test('handles empty input', () => {
    expect(parseMemory('')).toEqual({ header: '', sections: [] });
  });

  test('treats H3+ as part of section body, not as section break', () => {
    const text = '## Outer\n\n### Inner\n\nbody\n\n## Another';
    const result = parseMemory(text);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toBe('Outer');
    expect(result.sections[0].body).toContain('### Inner');
  });

  test('handles section with no body (heading only)', () => {
    const text = '## Empty Section\n\n## Next';
    const result = parseMemory(text);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toBe('Empty Section');
    expect(result.sections[0].body.trim()).toBe('');
  });
});
