'use strict';
const { parseArgs } = require('../../tools/agent-spec-plan');

describe('parseArgs', () => {
  test('subcommand only', () => {
    expect(parseArgs(['node', 'agent-spec-plan.js', 'spec-start'])).toEqual(
      expect.objectContaining({ cmd: 'spec-start' }),
    );
  });

  test('--story flag', () => {
    expect(parseArgs(['node', 'x', 'spec-start', '--story', 'US-0181']).story).toBe('US-0181');
  });

  test('--gate flag', () => {
    expect(parseArgs(['node', 'x', 'approve', '--gate', 'spec']).gate).toBe('spec');
  });

  test('--verdict flag', () => {
    expect(parseArgs(['node', 'x', 'spec-review-result', '--verdict', 'APPROVED']).verdict).toBe('APPROVED');
  });

  test('--reason captures string with spaces', () => {
    expect(parseArgs(['node', 'x', 'reject', '--reason', 'scope creep here']).reason).toBe('scope creep here');
  });

  test('--field and --value pair', () => {
    const r = parseArgs(['node', 'x', 'spec-update', '--field', 'uiSurface', '--value', 'true']);
    expect(r.field).toBe('uiSurface');
    expect(r.value).toBe('true');
  });

  test('--findings-file flag', () => {
    expect(parseArgs(['node', 'x', 'spec-review-result', '--findings-file', '/tmp/f.md']).findingsFile).toBe(
      '/tmp/f.md',
    );
  });

  test('--author flag', () => {
    expect(parseArgs(['node', 'x', 'plan-start', '--author', 'Keystone']).author).toBe('Keystone');
  });

  test('--dir flag for apply-pending', () => {
    expect(parseArgs(['node', 'x', 'apply-pending', '--dir', '/tmp/p']).dir).toBe('/tmp/p');
  });

  test('--state filter for list', () => {
    expect(parseArgs(['node', 'x', 'list', '--state', 'ready_for_dispatch']).state).toBe('ready_for_dispatch');
  });

  test('--phase for escalate', () => {
    expect(parseArgs(['node', 'x', 'escalate', '--story', 'US-0181', '--phase', 'spec']).phase).toBe('spec');
  });

  test('returns all expected fields with defaults', () => {
    const r = parseArgs(['node', 'x', 'spec-start']);
    expect(r).toHaveProperty('cmd');
    expect(r).toHaveProperty('story');
    expect(r).toHaveProperty('gate');
    expect(r).toHaveProperty('verdict');
    expect(r).toHaveProperty('reason');
    expect(r).toHaveProperty('field');
    expect(r).toHaveProperty('value');
    expect(r).toHaveProperty('findingsFile');
    expect(r).toHaveProperty('author');
    expect(r).toHaveProperty('dir');
    expect(r).toHaveProperty('state');
    expect(r).toHaveProperty('phase');
  });
});
