'use strict';
const { suggestModel, tokenise, escapeRegex } = require('../../tools/lib/memory-model-suggester');

const baseEntry = (overrides = {}) => ({
  category: 'topics',
  title: '',
  file: '',
  date: null,
  complexity: null,
  headBody: '',
  ...overrides,
});

describe('tokenise', () => {
  test('lowercases and splits on whitespace + punctuation', () => {
    expect(tokenise('Fix the BUG in render-tabs.js')).toEqual(['fix', 'bug', 'render', 'tabs']);
  });

  test('drops stopwords', () => {
    expect(tokenise('the of and a')).toEqual([]);
  });

  test('drops tokens shorter than 3 chars', () => {
    expect(tokenise('a be do go')).toEqual([]);
  });

  test('handles empty input', () => {
    expect(tokenise('')).toEqual([]);
  });
});

describe('escapeRegex', () => {
  test('escapes regex special characters', () => {
    expect(escapeRegex('c++')).toBe('c\\+\\+');
    expect(escapeRegex('node.js')).toBe('node\\.js');
    expect(escapeRegex('plain')).toBe('plain');
  });
});

describe('suggestModel — empty task', () => {
  test('throws when task is empty', () => {
    expect(() => suggestModel([], '')).toThrow(/task/i);
  });

  test('throws when task is all stopwords', () => {
    expect(() => suggestModel([], 'the of and')).toThrow(/task description too short/i);
  });
});

describe('suggestModel — word-boundary matching', () => {
  test('"render" matches "render-tabs" in title', () => {
    const entries = [baseEntry({ title: 'render-tabs handling', complexity: 'low' })];
    const r = suggestModel(entries, 'fix render output');
    expect(r.matched.length).toBe(1);
    expect(r.matched[0].matchedTokens).toContain('render');
  });

  test('"render" matches "renderer" (prefix-match via left word boundary)', () => {
    const entries = [baseEntry({ title: 'Renderer architecture', complexity: 'medium' })];
    const r = suggestModel(entries, 'review renderer changes');
    expect(r.matched.length).toBe(1);
  });

  test('"render" does NOT match "surrender" (no left word boundary)', () => {
    const entries = [baseEntry({ title: 'Surrender protocol', complexity: 'low' })];
    const r = suggestModel(entries, 'review render output');
    expect(r.matched.length).toBe(0);
  });
});

describe('suggestModel — score threshold', () => {
  test('single body hit (score=1) is NOT matched (threshold >= 2)', () => {
    const entries = [baseEntry({ title: 'X', complexity: 'low', headBody: 'mentions render once' })];
    const r = suggestModel(entries, 'render bug');
    expect(r.matched.length).toBe(0);
  });

  test('title hit alone (score=2) IS matched', () => {
    const entries = [baseEntry({ title: 'render bug', complexity: 'low' })];
    const r = suggestModel(entries, 'render output');
    expect(r.matched.length).toBe(1);
  });

  test('two body hits (score=2) IS matched', () => {
    const entries = [baseEntry({ title: 'X', complexity: 'low', headBody: 'render once\nrender twice' })];
    const r = suggestModel(entries, 'render bug');
    expect(r.matched.length).toBe(1);
  });
});

describe('suggestModel — aggregation', () => {
  test('all-low matched → haiku', () => {
    const entries = [
      baseEntry({ title: 'render basics', complexity: 'low' }),
      baseEntry({ title: 'render advanced', complexity: 'low' }),
    ];
    const r = suggestModel(entries, 'render output');
    expect(r.model).toBe('haiku');
    expect(r.reason).toMatch(/low/i);
  });

  test('any medium matched → sonnet', () => {
    const entries = [
      baseEntry({ title: 'render basics', complexity: 'low' }),
      baseEntry({ title: 'render core', complexity: 'medium' }),
    ];
    const r = suggestModel(entries, 'render output');
    expect(r.model).toBe('sonnet');
  });

  test('any high matched → sonnet', () => {
    const entries = [baseEntry({ title: 'render contract', complexity: 'high' })];
    const r = suggestModel(entries, 'render output');
    expect(r.model).toBe('sonnet');
    expect(r.reason).toMatch(/high/i);
  });

  test('null complexity treated as medium → sonnet', () => {
    const entries = [baseEntry({ title: 'render output', complexity: null })];
    const r = suggestModel(entries, 'render bug');
    expect(r.model).toBe('sonnet');
    expect(r.matched[0].complexitySource).toBe('default');
  });

  test('explicit complexity tagged "explicit" in complexitySource', () => {
    const entries = [baseEntry({ title: 'render output', complexity: 'low' })];
    const r = suggestModel(entries, 'render bug');
    expect(r.matched[0].complexitySource).toBe('explicit');
  });
});

describe('suggestModel — fallback', () => {
  test('zero matches → sonnet with safe-default reason', () => {
    const entries = [baseEntry({ title: 'unrelated topic', complexity: 'low' })];
    const r = suggestModel(entries, 'completely different task');
    expect(r.model).toBe('sonnet');
    expect(r.matched.length).toBe(0);
    expect(r.reason).toMatch(/no topics matched/i);
  });
});
