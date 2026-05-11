'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseArgs, dispatch } = require('../../tools/agent-spec-plan');

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

describe('dispatch — spec phase', () => {
  let tmpdir;
  let sdlcPath;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-cli-'));
    sdlcPath = path.join(tmpdir, 'sdlc-status.json');
    fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0181': { status: 'Planned' } } }));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('spec-start creates specPhase + planPhase, writes to sdlc-status', () => {
    const exitCode = dispatch({ cmd: 'spec-start', story: 'US-0181', uiSurface: 'false' }, { sdlcPath });
    expect(exitCode).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('in_progress');
  });

  test('spec-start exits 1 if story missing', () => {
    const exitCode = dispatch({ cmd: 'spec-start', story: 'US-9999' }, { sdlcPath });
    expect(exitCode).toBe(1);
  });

  test('spec-await-ac exits 2 (await signal)', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    const exitCode = dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    expect(exitCode).toBe(2);
  });

  test('approve --gate ac transitions awaiting_ac_approval → in_progress', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    const exitCode = dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    expect(exitCode).toBe(0);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.acApprovedAt).toBeTruthy();
  });

  test('spec-update sets uiSurface field', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-update', story: 'US-0181', field: 'uiSurface', value: 'true' }, { sdlcPath });
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.uiSurface).toBe(true);
  });

  test('iteration cap auto-escalates and returns exit 1', () => {
    dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(0);
    expect(dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath })).toBe(1);
    const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
    expect(data.stories['US-0181'].specPhase.state).toBe('escalated');
  });
});
