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

  test('idempotent: second run reports no changes', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'plan-visualizer.config.json');
    fs.writeFileSync(file, JSON.stringify({ docs: { lessons: 'my/custom/LESSONS.md' } }));

    const result = migratePlanVisualizerConfig(file);
    expect(result.changed).toBe(false);
    // User's custom path preserved:
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).docs.lessons).toBe('my/custom/LESSONS.md');
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
