/**
 * Smoke tests for tools/migrate-config.js — idempotent schema migrator.
 *
 * Each test writes a fixture to a temp dir, invokes the migrator in-process,
 * then asserts the resulting file shape. No real PlanVisualizer files are
 * touched.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { migratePlanVisualizerConfig, migrateAgentsConfig, ensureKey } = require('../../tools/migrate-config.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-config-'));
}

describe('migrate-config: ensureKey primitive', () => {
  test('adds key when absent and reports change', () => {
    const obj = { a: 1 };
    expect(ensureKey(obj, 'b', 2)).toBe(true);
    expect(obj.b).toBe(2);
  });

  test('preserves existing value and reports no change', () => {
    const obj = { a: 1 };
    expect(ensureKey(obj, 'a', 999)).toBe(false);
    expect(obj.a).toBe(1);
  });

  test('treats explicit null as present, does not overwrite', () => {
    const obj = { a: null };
    expect(ensureKey(obj, 'a', 'default')).toBe(false);
    expect(obj.a).toBe(null);
  });
});

describe('migrate-config: plan-visualizer.config.json', () => {
  test('adds docs.lessons when absent', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'plan-visualizer.config.json');
    fs.writeFileSync(file, JSON.stringify({ docs: { releasePlan: 'docs/RELEASE_PLAN.md' } }));

    const result = migratePlanVisualizerConfig(file);

    expect(result.changed).toBe(true);
    expect(result.additions).toContain('docs.lessons');
    const migrated = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(migrated.docs.lessons).toBe('docs/LESSONS.md');
    // User value preserved:
    expect(migrated.docs.releasePlan).toBe('docs/RELEASE_PLAN.md');
  });

  test('idempotent: second run reports no changes when all fields present', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'plan-visualizer.config.json');
    // Fully-migrated config — all v2.3.x fields already present
    fs.writeFileSync(
      file,
      JSON.stringify({
        docs: { lessons: 'my/custom/LESSONS.md' },
        costs: { tshirtHours: { XS: 2, S: 4, M: 8, L: 16, XL: 32 } },
        github: {
          enabled: false,
          repo: 'owner/repo',
          syncBugs: true,
          syncStories: false,
          labelMap: { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' },
          defaultLabels: ['planvisualizer'],
        },
        memory: { staleDays: 90, autoArchive: false },
        orchestration: {
          iterationCap: { spec: 3, plan: 3, taskReview: 2 },
          pendingApprovalsDir: 'docs/pending-approvals',
        },
      }),
    );

    const result = migratePlanVisualizerConfig(file);
    expect(result.changed).toBe(false);
    // User's custom path preserved:
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).docs.lessons).toBe('my/custom/LESSONS.md');
  });

  test('adds github block and XS tshirt hour to sparse config', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'plan-visualizer.config.json');
    fs.writeFileSync(file, JSON.stringify({ docs: { lessons: 'docs/LESSONS.md' } }));

    const result = migratePlanVisualizerConfig(file);
    expect(result.changed).toBe(true);
    expect(result.additions).toContain('github.enabled');
    expect(result.additions).toContain('costs.tshirtHours.XS');
    const migrated = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(migrated.github.enabled).toBe(false);
    expect(migrated.github.syncBugs).toBe(true);
    expect(migrated.github.syncStories).toBe(false);
    expect(migrated.costs.tshirtHours.XS).toBe(2);
  });

  test('preserves custom github config values', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'plan-visualizer.config.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        docs: { lessons: 'docs/LESSONS.md' },
        costs: { tshirtHours: { XS: 2, S: 4, M: 8, L: 16, XL: 32 } },
        github: {
          enabled: true,
          repo: 'myorg/myrepo',
          syncBugs: true,
          syncStories: true,
          labelMap: { Critical: 'p0', High: 'p1', Medium: 'p2', Low: 'p3' },
          defaultLabels: ['pv', 'auto'],
        },
        memory: { staleDays: 90, autoArchive: false },
        orchestration: {
          iterationCap: { spec: 3, plan: 3, taskReview: 2 },
          pendingApprovalsDir: 'docs/pending-approvals',
        },
      }),
    );

    const result = migratePlanVisualizerConfig(file);
    expect(result.changed).toBe(false);
    const migrated = JSON.parse(fs.readFileSync(file, 'utf8'));
    // User values preserved — not overwritten by migration defaults
    expect(migrated.github.enabled).toBe(true);
    expect(migrated.github.repo).toBe('myorg/myrepo');
    expect(migrated.github.syncStories).toBe(true);
    expect(migrated.github.labelMap.Critical).toBe('p0');
  });

  test('skips gracefully when file absent', () => {
    const dir = tmpDir();
    const result = migratePlanVisualizerConfig(path.join(dir, 'nope.json'));
    expect(result.changed).toBe(false);
    expect(result.additions).toEqual([]);
  });

  test('skips gracefully on invalid JSON (no throw)', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'plan-visualizer.config.json');
    fs.writeFileSync(file, '{ not valid json');
    const result = migratePlanVisualizerConfig(file);
    expect(result.changed).toBe(false);
  });
});

describe('migrate-config: iterationCap.taskReview', () => {
  test('migrate adds iterationCap.taskReview default 2 when missing', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'plan-visualizer.config.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        docs: { lessons: 'docs/LESSONS.md' },
        costs: { tshirtHours: { XS: 2, S: 4, M: 8, L: 16, XL: 32 } },
        github: {
          enabled: false,
          repo: 'owner/repo',
          syncBugs: true,
          syncStories: false,
          labelMap: { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' },
          defaultLabels: ['planvisualizer'],
        },
        memory: { staleDays: 90, autoArchive: false },
        orchestration: {
          iterationCap: { spec: 3, plan: 3 }, // no taskReview
          pendingApprovalsDir: 'docs/pending-approvals',
        },
      }),
    );

    const result = migratePlanVisualizerConfig(file);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(after.orchestration.iterationCap.taskReview).toBe(2);
    expect(result.additions.join(' ')).toMatch(/iterationCap\.taskReview/);
  });

  test('migrate preserves existing iterationCap.taskReview', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'plan-visualizer.config.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        docs: { lessons: 'docs/LESSONS.md' },
        costs: { tshirtHours: { XS: 2, S: 4, M: 8, L: 16, XL: 32 } },
        github: {
          enabled: false,
          repo: 'owner/repo',
          syncBugs: true,
          syncStories: false,
          labelMap: { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' },
          defaultLabels: ['planvisualizer'],
        },
        memory: { staleDays: 90, autoArchive: false },
        orchestration: {
          iterationCap: { spec: 3, plan: 3, taskReview: 5 },
          pendingApprovalsDir: 'docs/pending-approvals',
        },
      }),
    );

    migratePlanVisualizerConfig(file);
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(after.orchestration.iterationCap.taskReview).toBe(5);
  });
});

describe('migrate-config: agents.config.json', () => {
  test('adds avatar field per agent with lowercase-name default', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'agents.config.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        agents: {
          Conductor: { role: 'Delivery Manager', color: '#D52B1E' },
          'Pixel Custom': { role: 'FE Dev' },
        },
      }),
    );

    const result = migrateAgentsConfig(file);

    expect(result.changed).toBe(true);
    const migrated = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(migrated.agents.Conductor.avatar).toBe('conductor');
    // Multi-word name: first word, lowercased
    expect(migrated.agents['Pixel Custom'].avatar).toBe('pixel');
    // User values preserved:
    expect(migrated.agents.Conductor.role).toBe('Delivery Manager');
    expect(migrated.agents.Conductor.color).toBe('#D52B1E');
  });

  test('preserves custom avatar paths', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'agents.config.json');
    fs.writeFileSync(file, JSON.stringify({ agents: { Pixel: { role: 'FE Dev', avatar: 'my-custom-pixel' } } }));

    const result = migrateAgentsConfig(file);
    expect(result.changed).toBe(false);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).agents.Pixel.avatar).toBe('my-custom-pixel');
  });

  test('handles config with no agents key', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'agents.config.json');
    fs.writeFileSync(file, JSON.stringify({ dashboard: { title: 'Test' } }));
    const result = migrateAgentsConfig(file);
    expect(result.changed).toBe(false);
  });
});
