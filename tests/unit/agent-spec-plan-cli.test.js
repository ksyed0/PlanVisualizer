'use strict';

/**
 * Post-D.6 (US-0237 / TASK-0061), dispatch is async and writes through the
 * D.1 entity repos rather than directly to docs/sdlc-status.json. The on-disk
 * JSON is now a pure function of SQL state — stories live under
 * `programme.stories` (matching D.4's shape), and the transitional-debt
 * scaffolding in sdlc-mirror.js preserves any pre-existing top-level
 * `stories` from the seed for the duration of Phase D.
 *
 * Tests therefore read `data.programme.stories[id]` for orchestration state.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseArgs, dispatch } = require('../../tools/agent-spec-plan');
const { Repository } = require('../../tools/lib/repository');

function getStory(sdlcPath, id) {
  const data = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  return data.programme && data.programme.stories ? data.programme.stories[id] : undefined;
}

afterEach(() => {
  Repository._reset();
});

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

  test('spec-start creates specPhase + planPhase, writes to sdlc-status', async () => {
    const exitCode = await dispatch({ cmd: 'spec-start', story: 'US-0181', uiSurface: 'false' }, { sdlcPath });
    expect(exitCode).toBe(0);
    expect(getStory(sdlcPath, 'US-0181').specPhase.state).toBe('in_progress');
  });

  test('spec-start exits 1 if story missing', async () => {
    const exitCode = await dispatch({ cmd: 'spec-start', story: 'US-9999' }, { sdlcPath });
    expect(exitCode).toBe(1);
  });

  test('spec-await-ac exits 2 (await signal)', async () => {
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    const exitCode = await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    expect(exitCode).toBe(2);
  });

  test('approve --gate ac transitions awaiting_ac_approval → in_progress', async () => {
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    const exitCode = await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    expect(exitCode).toBe(0);
    expect(getStory(sdlcPath, 'US-0181').specPhase.acApprovedAt).toBeTruthy();
  });

  test('spec-update sets uiSurface field', async () => {
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'spec-update', story: 'US-0181', field: 'uiSurface', value: 'true' }, { sdlcPath });
    expect(getStory(sdlcPath, 'US-0181').specPhase.uiSurface).toBe(true);
  });

  test('iteration cap auto-escalates and returns exit 1', async () => {
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    expect(
      await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath }),
    ).toBe(0);
    expect(
      await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath }),
    ).toBe(0);
    expect(
      await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'REQUEST_CHANGES' }, { sdlcPath }),
    ).toBe(1);
    expect(getStory(sdlcPath, 'US-0181').specPhase.state).toBe('escalated');
  });
});

describe('dispatch — plan phase + helpers', () => {
  let tmpdir, sdlcPath, pendingDir;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-cli-'));
    sdlcPath = path.join(tmpdir, 'sdlc-status.json');
    pendingDir = path.join(tmpdir, 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0181': { status: 'Planned' } } }));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  async function fullSpecApproval() {
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'ac' }, { sdlcPath });
    await dispatch({ cmd: 'spec-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-final', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'spec' }, { sdlcPath });
  }

  test('plan-start requires spec approved', async () => {
    expect(await dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath })).toBe(1);
  });

  test('plan-start works after spec approved', async () => {
    await fullSpecApproval();
    expect(await dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath })).toBe(0);
    expect(getStory(sdlcPath, 'US-0181').planPhase.author).toBe('Keystone');
  });

  test('plan-spec-gap reopens spec phase', async () => {
    await fullSpecApproval();
    await dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath });
    expect(await dispatch({ cmd: 'plan-spec-gap', story: 'US-0181', reason: 'AC missing X' }, { sdlcPath })).toBe(0);
    const st = getStory(sdlcPath, 'US-0181');
    expect(st.specPhase.state).toBe('in_progress');
    expect(st.planPhase.state).toBe('pending');
  });

  test('full happy path reaches ready_for_dispatch', async () => {
    await fullSpecApproval();
    await dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath });
    await dispatch({ cmd: 'plan-review-result', story: 'US-0181', verdict: 'APPROVED' }, { sdlcPath });
    expect(await dispatch({ cmd: 'plan-await-approval', story: 'US-0181' }, { sdlcPath })).toBe(2);
    expect(await dispatch({ cmd: 'approve', story: 'US-0181', gate: 'plan' }, { sdlcPath })).toBe(0);
    expect(getStory(sdlcPath, 'US-0181').planPhase.state).toBe('approved');
  });

  test('escalate forces escalated state', async () => {
    await fullSpecApproval();
    await dispatch({ cmd: 'plan-start', story: 'US-0181', author: 'Keystone' }, { sdlcPath });
    expect(await dispatch({ cmd: 'escalate', story: 'US-0181', phase: 'plan' }, { sdlcPath })).toBe(0);
    expect(getStory(sdlcPath, 'US-0181').planPhase.state).toBe('escalated');
  });

  test('show-pending lists stories with open gates', async () => {
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    const log = [];
    const exitCode = await dispatch({ cmd: 'show-pending' }, { sdlcPath, log: (m) => log.push(m) });
    expect(exitCode).toBe(0);
    expect(log.join('\n')).toMatch(/US-0181/);
    expect(log.join('\n')).toMatch(/ac/);
  });

  test('list filters by --state', async () => {
    await fullSpecApproval();
    const log = [];
    await dispatch({ cmd: 'list', state: 'plan' }, { sdlcPath, log: (m) => log.push(m) });
    expect(log.join('\n')).toContain('US-0181');
  });

  test('apply-pending applies valid flag and deletes it', async () => {
    await dispatch({ cmd: 'spec-start', story: 'US-0181' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0181' }, { sdlcPath });
    const flagPath = path.join(pendingDir, 'approve-US-0181-ac.flag');
    fs.writeFileSync(
      flagPath,
      JSON.stringify({
        story: 'US-0181',
        gate: 'ac',
        action: 'approve',
        timestamp: '2026-05-11T12:00:00Z',
      }),
    );
    expect(await dispatch({ cmd: 'apply-pending', dir: pendingDir }, { sdlcPath })).toBe(0);
    expect(fs.existsSync(flagPath)).toBe(false);
    expect(getStory(sdlcPath, 'US-0181').specPhase.acApprovedAt).toBeTruthy();
  });

  test('apply-pending leaves malformed flag in place', async () => {
    const flagPath = path.join(pendingDir, 'approve-US-0181-ac.flag');
    fs.writeFileSync(flagPath, 'not json');
    await dispatch({ cmd: 'apply-pending', dir: pendingDir }, { sdlcPath });
    expect(fs.existsSync(flagPath)).toBe(true);
  });
});

describe('dispatch — plan-update', () => {
  let tmpdir, sdlcPath;
  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'agt-plan-upd-'));
    sdlcPath = path.join(tmpdir, 'sdlc-status.json');
    fs.writeFileSync(sdlcPath, JSON.stringify({ stories: { 'US-0183': { status: 'Planned' } } }));
  });
  afterEach(() => fs.rmSync(tmpdir, { recursive: true, force: true }));

  test('plan-update sets planPath on planPhase', async () => {
    // Set up spec + plan phase
    await dispatch({ cmd: 'spec-start', story: 'US-0183' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-ac', story: 'US-0183' }, { sdlcPath });
    await dispatch({ cmd: 'approve', story: 'US-0183', gate: 'ac' }, { sdlcPath });
    await dispatch({ cmd: 'spec-review-result', story: 'US-0183', verdict: 'APPROVED' }, { sdlcPath });
    await dispatch({ cmd: 'spec-await-final', story: 'US-0183' }, { sdlcPath });
    await dispatch({ cmd: 'approve', story: 'US-0183', gate: 'spec' }, { sdlcPath });
    await dispatch({ cmd: 'plan-start', story: 'US-0183', author: 'Keystone' }, { sdlcPath });
    const code = await dispatch(
      {
        cmd: 'plan-update',
        story: 'US-0183',
        field: 'planPath',
        value: 'docs/superpowers/plans/2026-05-14-us-0183.md',
      },
      { sdlcPath },
    );
    expect(code).toBe(0);
    expect(getStory(sdlcPath, 'US-0183').planPhase.planPath).toBe('docs/superpowers/plans/2026-05-14-us-0183.md');
  });
});
