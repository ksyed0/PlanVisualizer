'use strict';

/**
 * US-0260 / AC-1018: init-sdlc-status canonical seed + idempotent merge.
 *
 * Four scenarios:
 *
 *   1. Empty programme — fresh init writes Object.keys(programme).sort() ===
 *      ['agents', 'phases', 'project'] and the on-disk JSON top-level keys
 *      are exactly ['log', 'programme', 'tasks'] (the canonical triple).
 *
 *   2. Partially-populated programme — running init a second time against a
 *      programme where one row already exists preserves that row's value
 *      verbatim; only missing rows are seeded. With --force, all rows are
 *      overwritten regardless.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { main } = require('../../tools/init-sdlc-status');
const { Repository } = require('../../tools/lib/repository');

function mkRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'us0260-init-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 't', version: '1.0.0' }));
  return root;
}

function writeConfig(root, overrides = {}) {
  const cfg = {
    agents: {
      Forge: { role: 'code-implementer' },
      Lens: { role: 'reviewer' },
    },
    phases: [{ name: 'Spec', agents: ['Forge'], deliverables: ['spec.md'] }],
    project: { name: 'TmpProject', description: 'd', repoUrl: 'r', startDate: '2026-01-01' },
    ...overrides,
  };
  const configPath = path.join(root, 'agents.config.json');
  fs.writeFileSync(configPath, JSON.stringify(cfg));
  return configPath;
}

describe('US-0260 / AC-1018: init-sdlc-status repeat semantics', () => {
  describe('empty programme — fresh init', () => {
    let root;
    let configPath;
    let result;

    beforeAll(async () => {
      root = mkRoot();
      configPath = writeConfig(root);
      result = await main({ root, configPath, force: false });
    });

    afterAll(() => {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('seeds exactly agents, phases, project (no preserved rows)', () => {
      expect(result.seeded.sort()).toEqual(['agents', 'phases', 'project']);
      expect(result.preserved).toEqual([]);
    });

    it('writes the canonical {tasks, log, programme} top-level shape', () => {
      const json = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
      expect(Object.keys(json).sort()).toEqual(['log', 'programme', 'tasks']);
    });

    it('populates programme.{agents, phases, project} and nothing else', () => {
      const json = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
      expect(Object.keys(json.programme).sort()).toEqual(['agents', 'phases', 'project']);
    });

    it('programme.agents is keyed by configured agent name with idle defaults', () => {
      const json = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
      expect(Object.keys(json.programme.agents).sort()).toEqual(['Forge', 'Lens']);
      expect(json.programme.agents.Forge.status).toBe('idle');
      expect(json.programme.agents.Lens.status).toBe('idle');
    });
  });

  describe('partially-populated programme — repeat init without --force', () => {
    let root;
    let configPath;

    beforeAll(async () => {
      root = mkRoot();
      configPath = writeConfig(root);
      // First init: seed everything.
      await main({ root, configPath, force: false });
      Repository._reset();
      // Mutate one row to a sentinel value.
      const repo = Repository.getInstance({ root });
      await repo.sdlcProgramme.set('agents', {
        Forge: { status: 'active', currentTask: 'TASK-XX', tasksCompleted: 7 },
      });
      Repository._reset();
    });

    afterAll(() => {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('preserves the mutated agents row (no overwrite)', async () => {
      const result = await main({ root, configPath, force: false });
      expect(result.seeded).toEqual([]);
      expect(result.preserved.sort()).toEqual(['agents', 'phases', 'project']);

      Repository._reset();
      const repo = Repository.getInstance({ root });
      const agents = repo.sdlcProgramme.get('agents');
      expect(agents.Forge.currentTask).toBe('TASK-XX');
      expect(agents.Forge.tasksCompleted).toBe(7);
    });
  });

  describe('partially-populated programme — repeat init with --force', () => {
    let root;
    let configPath;

    beforeAll(async () => {
      root = mkRoot();
      configPath = writeConfig(root);
      await main({ root, configPath, force: false });
      Repository._reset();
      const repo = Repository.getInstance({ root });
      await repo.sdlcProgramme.set('agents', { OldAgent: { status: 'idle', currentTask: null, tasksCompleted: 0 } });
      Repository._reset();
    });

    afterAll(() => {
      Repository._reset();
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('--force overwrites the mutated row with the config-derived value', async () => {
      const result = await main({ root, configPath, force: true });
      expect(result.seeded.sort()).toEqual(['agents', 'phases', 'project']);
      expect(result.preserved).toEqual([]);

      Repository._reset();
      const repo = Repository.getInstance({ root });
      const agents = repo.sdlcProgramme.get('agents');
      expect(Object.keys(agents).sort()).toEqual(['Forge', 'Lens']);
      expect(agents).not.toHaveProperty('OldAgent');
    });
  });

  describe('the seeded programme is readable via the accessor', () => {
    it('reader.agents(json) returns the seeded agents map', async () => {
      const reader = require('../../tools/lib/repository/sdlc-status-reader');
      const root = mkRoot();
      const configPath = writeConfig(root);
      try {
        await main({ root, configPath, force: false });
        const json = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'sdlc-status.json'), 'utf8'));
        const agents = reader.agents(json);
        expect(Object.keys(agents).sort()).toEqual(['Forge', 'Lens']);
        expect(reader.project(json).name).toBe('TmpProject');
        expect(reader.phases(json)).toHaveLength(1);
      } finally {
        Repository._reset();
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
