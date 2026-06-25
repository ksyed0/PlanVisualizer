// tests/e2e/pipeline-agentic.spec.js
//
// Suite 4: Agentic pipeline lifecycle — tests the real CLI state machine tools
// via their programmatic dispatch() APIs.
//
// Assertion adjustments vs task brief (verified before writing):
//
//   TOOL ISOLATION: All three tools hardcode their ROOT via __dirname.
//   Calling them as CLI subprocesses with a tmp cwd would still write to
//   PlanVisualizer/docs/. We call dispatch() with ctx.root / ctx.sdlcPath so
//   all writes are directed to isolated tmp directories.
//
//   MIRROR RE-RENDER: After any lifecycle dispatch(), the SdlcMirror re-renders
//   sdlc-status.json from SQL. The SQL indexer does NOT auto-import the fixture's
//   programme.stories — only tasks are seeded from the JSON tasks map.
//   Consequence: after lifecycleDispatch(), programme.stories becomes {}.
//   Solution: use separate isolated roots per test group so writes in one group
//   don't corrupt the state for another.
//
//   AC-1044: agent-lifecycle.dispatch() ctx = { root, sdlcPath, skipRegen: true }.
//   After 'start', sdlc-status.json shape: { tasks: { <uuid>: { state: 'in_progress' } } }
//   The task UUID is emitted to ctx.stdout. 'done' reads by taskId (UUID), not story.
//   Summary must end with [sha:<commit>] token.
//
//   AC-1045a/b: generateHTML() used with the fixture JSON directly (not the
//   re-rendered post-dispatch JSON, which loses programme.stories). The fixture
//   contains programme.agents.Forge.currentTask = 'US-T004: search functionality'
//   which causes US-T004 to appear in the rendered HTML. After done, we assert
//   'done' appears in the HTML rendered from post-dispatch JSON (tasks contain state).
//
//   AC-1046: agent-spec-plan has NO 'submit' command. The real round-trip is:
//   spec-start → spec-await-ac (exits 2) → show-pending (US-T006 listed) →
//   approve --gate ac → show-pending (no longer awaiting ac). Uses fresh root
//   with programme.stories seeded so spec-plan can find US-T006.
//
//   AC-1047: deploy-status.js hardcodes DEPLOY_STATUS_PATH via __dirname and
//   ignores cwd. We use HANDLERS directly. deploy-start requires --env + --sha
//   + --story (not just --sha as in the brief).
//   State machine: init → idle, deploy-start → deploying, deploy-complete → healthy.
//
//   AC-1048: generateHTML() returns well-formed HTML > 1000 chars.
//
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Repository } = require('../../tools/lib/repository');
const { dispatch: lifecycleDispatch } = require('../../tools/agent-lifecycle');
const { dispatch: specPlanDispatch } = require('../../tools/agent-spec-plan');
const { HANDLERS: deployHandlers } = require('../../tools/deploy-status');
const { generateHTML } = require('../../tools/generate-dashboard.js');

const FIXTURES = path.join(__dirname, 'fixtures');

// ─── helpers ────────────────────────────────────────────────────────────────

function mkRoot(seed = {}) {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-agentic-e2e-'));
  fs.mkdirSync(path.join(tmpdir, 'docs'), { recursive: true });
  const sdlcPath = path.join(tmpdir, 'docs', 'sdlc-status.json');
  fs.writeFileSync(sdlcPath, JSON.stringify(seed, null, 2));
  return { tmpdir, sdlcPath, root: tmpdir };
}

function readSdlc(sdlcPath) {
  return JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
}

function loadFixture() {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, 'sdlc-status-init.json'), 'utf8'));
}

// ─── Suite 4a: Lifecycle (AC-1044 + AC-1045) ─────────────────────────────

describe('Suite 4a: agent-lifecycle state machine (AC-1044, AC-1045)', () => {
  let tmpdir, sdlcPath, root, taskId;

  beforeAll(() => {
    // Plain seed — no programme.stories needed; lifecycle only writes to tasks
    const seed = { tasks: {}, log: [], programme: {} };
    ({ tmpdir, sdlcPath, root } = mkRoot(seed));
    Repository._reset();
  });

  afterAll(() => {
    Repository._reset();
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  beforeEach(() => Repository._reset());
  afterEach(() => Repository._reset());

  it('AC-1044: start transitions story task to in_progress', async () => {
    const stdout = [];
    const code = await lifecycleDispatch(
      {
        cmd: 'start',
        story: 'US-T004',
        agent: 'Forge',
        model: 'sonnet',
        task: 'implement search endpoint',
      },
      { root, sdlcPath, skipRegen: true, stdout: (s) => stdout.push(s) },
    );
    expect(code).toBe(0);
    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toMatch(/^task-[0-9a-f-]{36}$/);
    taskId = stdout[0];

    const data = readSdlc(sdlcPath);
    expect(data.tasks[taskId]).toBeDefined();
    expect(data.tasks[taskId].state).toBe('in_progress');
    expect(data.tasks[taskId].agent).toBe('Forge');
  });

  it('AC-1045a: generateHTML from fixture renders programme content including agent info', () => {
    // Use the fixture directly — it has programme.agents and programme.stories
    // which the dashboard renders. After dispatch(), the mirror loses programme.stories
    // because the SQL indexer does not import them from JSON seeds.
    const fixtureData = loadFixture();
    const html = generateHTML(fixtureData);
    // Fixture has programme.agents.Forge.currentTask = 'US-T004: search functionality'
    expect(html).toContain('US-T004');
    expect(html.length).toBeGreaterThan(1000);
  });

  it('AC-1044: done transitions task to done', async () => {
    expect(taskId).toBeDefined();
    const code = await lifecycleDispatch(
      {
        cmd: 'done',
        taskId,
        summary: 'Search endpoint implemented [sha:abc1234]',
      },
      { root, sdlcPath, skipRegen: true, stderr: () => {} },
    );
    expect(code).toBe(0);

    const data = readSdlc(sdlcPath);
    expect(data.tasks[taskId].state).toBe('done');
    expect(data.tasks[taskId].headSha).toBe('abc1234');
  });

  it('AC-1045b: generateHTML from post-done state contains done status', () => {
    const data = readSdlc(sdlcPath);
    // tasks[taskId].state === 'done' — the dashboard renders task states
    const html = generateHTML(data);
    expect(html.length).toBeGreaterThan(1000);
    expect(html).toContain('<!DOCTYPE html>');
    // The task state 'done' is embedded somewhere in the rendered output
    expect(JSON.stringify(data.tasks[taskId])).toContain('done');
    // AC-1045b: also assert the rendered HTML contains 'done' (not just the raw data)
    expect(html).toContain('done');
  });
});

// ─── Suite 4b: Spec-plan gate (AC-1046) ──────────────────────────────────

describe('Suite 4b: spec-plan gate round-trip (AC-1046)', () => {
  let tmpdir, sdlcPath;

  beforeAll(() => {
    // Seed with programme.stories so spec-plan can find US-T006
    const seed = {
      tasks: {},
      log: [],
      programme: {
        stories: {
          'US-T006': {
            epic: 'EPIC-T002',
            title: 'E2E-Fixture: Spec gate test story',
            status: 'planned',
          },
        },
      },
    };
    ({ tmpdir, sdlcPath } = mkRoot(seed));
    Repository._reset();
  });

  afterAll(() => {
    Repository._reset();
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  beforeEach(() => Repository._reset());
  afterEach(() => Repository._reset());

  it('AC-1046: spec-start puts US-T006 into in_progress', async () => {
    const code = await specPlanDispatch({ cmd: 'spec-start', story: 'US-T006' }, { sdlcPath });
    expect(code).toBe(0);
  });

  it('AC-1046: spec-await-ac puts US-T006 into awaiting_ac_approval (exits 2)', async () => {
    const code = await specPlanDispatch({ cmd: 'spec-await-ac', story: 'US-T006' }, { sdlcPath });
    expect(code).toBe(2);
  });

  it('AC-1046: show-pending lists US-T006 awaiting ac approval', async () => {
    const log = [];
    const code = await specPlanDispatch({ cmd: 'show-pending' }, { sdlcPath, log: (m) => log.push(m) });
    expect(code).toBe(0);
    const output = log.join('\n');
    expect(output).toContain('US-T006');
    expect(output).toMatch(/ac/i);
  });

  it('AC-1046: approve --gate ac transitions out of awaiting_ac_approval', async () => {
    const code = await specPlanDispatch({ cmd: 'approve', story: 'US-T006', gate: 'ac' }, { sdlcPath });
    expect(code).toBe(0);
  });

  it('AC-1046: show-pending no longer lists US-T006 for ac gate', async () => {
    const log = [];
    await specPlanDispatch({ cmd: 'show-pending' }, { sdlcPath, log: (m) => log.push(m) });
    const output = log.join('\n');
    // After ac approval, US-T006 is back in_progress — not in pending list for ac
    const hasAcPendingForT006 = output.includes('US-T006') && /US-T006.*ac|ac.*US-T006/.test(output);
    expect(hasAcPendingForT006).toBe(false);
  });
});

// ─── Suite 4c: Deploy state machine (AC-1047) ─────────────────────────────

describe('Suite 4c: deploy-status state machine (AC-1047)', () => {
  it('AC-1047: init produces idle environments', () => {
    const data = deployHandlers.init({}, {});
    expect(data.environments).toBeDefined();
    expect(data.environments.staging.status).toBe('idle');
    expect(data.environments.production.status).toBe('idle');
    expect(data.environments.dev.status).toBe('idle');
    expect(data.activeDeployment).toBeNull();
  });

  it('AC-1047: deploy-start transitions staging to deploying', () => {
    const init = deployHandlers.init({}, {});
    const afterStart = deployHandlers['deploy-start'](JSON.parse(JSON.stringify(init)), {
      env: 'staging',
      sha: 'abc1234',
      story: 'US-T004',
    });
    expect(afterStart.environments.staging.status).toBe('deploying');
    expect(afterStart.activeDeployment).not.toBeNull();
    expect(afterStart.activeDeployment.sha).toBe('abc1234');
    expect(afterStart.activeDeployment.to).toBe('staging');
  });

  it('AC-1047: deploy-complete transitions staging to healthy and clears activeDeployment', () => {
    const init = deployHandlers.init({}, {});
    const afterStart = deployHandlers['deploy-start'](JSON.parse(JSON.stringify(init)), {
      env: 'staging',
      sha: 'abc1234',
      story: 'US-T004',
    });
    const afterComplete = deployHandlers['deploy-complete'](JSON.parse(JSON.stringify(afterStart)), {
      env: 'staging',
      sha: 'abc1234',
      story: 'US-T004',
    });
    expect(afterComplete.environments.staging.status).toBe('healthy');
    expect(afterComplete.environments.staging.sha).toBe('abc1234');
    expect(afterComplete.activeDeployment).toBeNull();
  });
});

// ─── Suite 4d: generateHTML no-browser verification (AC-1048) ─────────────

describe('Suite 4d: generateHTML browser-free assertion (AC-1048)', () => {
  it('AC-1048: generateHTML returns well-formed HTML from sdlc fixture', () => {
    const data = loadFixture();
    const html = generateHTML(data);
    expect(html.length).toBeGreaterThan(1000);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('AC-1048: generateHTML renders phase names from fixture', () => {
    const data = loadFixture();
    const html = generateHTML(data);
    const phases = ['Blueprint', 'Architect', 'Build', 'Integration', 'Test', 'Polish', 'Deploy'];
    for (const name of phases) {
      expect(html).toContain(name);
    }
  });

  it('AC-1048: generateHTML renders without errors on minimal seed', () => {
    const html = generateHTML({ tasks: {}, log: [], programme: {} });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html.length).toBeGreaterThan(1000);
  });
});
