// tests/unit/memory-cli.test.js
'use strict';
const { parseArgs } = require('../../tools/memory');

describe('parseArgs', () => {
  test('subcommand only', () => {
    expect(parseArgs(['node', 'memory.js', 'compact'])).toEqual({
      cmd: 'compact',
      dry: false,
      force: false,
      days: null,
      push: false,
      pr: false,
      noTest: false,
    });
  });
  test('dry flag', () => {
    expect(parseArgs(['node', 'memory.js', 'compact', '--dry']).dry).toBe(true);
  });
  test('force flag', () => {
    expect(parseArgs(['node', 'memory.js', 'migrate', '--force']).force).toBe(true);
  });
  test('days flag', () => {
    expect(parseArgs(['node', 'memory.js', 'archive', '--days', '30']).days).toBe(30);
  });
  test('returns null cmd when no args', () => {
    expect(parseArgs(['node', 'memory.js']).cmd).toBeNull();
  });
  test('--push flag', () => {
    expect(parseArgs(['node', 'memory.js', 'migrate-commit', '--push']).push).toBe(true);
  });
  test('--pr flag sets both pr and push', () => {
    const r = parseArgs(['node', 'memory.js', 'migrate-commit', '--pr']);
    expect(r.pr).toBe(true);
    expect(r.push).toBe(true);
  });
  test('--no-test flag', () => {
    expect(parseArgs(['node', 'memory.js', 'migrate-commit', '--no-test']).noTest).toBe(true);
  });
});
