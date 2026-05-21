'use strict';

/**
 * Phase C.2 parity gate (US-0231, AC-0908..0911).
 *
 * Verifies the `PV_DASHBOARD_VIA_REPO=1` code path produces an identical
 * `{epics, stories, tasks}` shape as the legacy parse-from-file path. The
 * merge shim must layer repo-supplied structural fields on top of legacy
 * without introducing semantic drift — anything the repo doesn't see
 * (prose-node entities, retired stories rejected by the indexer's CHECK
 * constraint) must fall through to legacy unchanged.
 *
 * We exercise the shim directly rather than spawning the full CLI so the
 * test runs fast and asserts on data, not on timestamped HTML.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseReleasePlan } = require('../../tools/lib/parse-release-plan');
const { mergeRepoData } = require('../../tools/lib/dashboard-repo-reader');
const { Repository } = require('../../tools/lib/repository');
const { indexAll } = require('../../tools/lib/repository/indexers');

const ROOT = path.join(__dirname, '../..');
const RELEASE_PLAN = path.join(ROOT, 'docs/RELEASE_PLAN.md');

describe('Dashboard parity: legacy vs repo-merged', () => {
  test('mergeRepoData on production RELEASE_PLAN.md yields identical {epics, stories, tasks}', () => {
    if (!fs.existsSync(RELEASE_PLAN)) return; // skip on minimal checkouts

    const md = fs.readFileSync(RELEASE_PLAN, 'utf8');
    const legacy = parseReleasePlan(md);

    // Use an isolated temp DB so the test doesn't perturb .cache/.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-parity-'));
    Repository._reset();
    const repo = Repository.getInstance({ root: ROOT, dbPath: path.join(tmpDir, 'test.db') });
    try {
      indexAll({ index: repo.index, markdown: repo.markdown, warningsChannel: repo.warningsChannel });
      const repoData = {
        epics: repo.epics.list(),
        stories: repo.stories.list(),
        acs: repo.acs.list(),
      };
      const merged = mergeRepoData(legacy, repoData);

      // Same counts, same iteration order — legacy stays canonical.
      expect(merged.epics.length).toBe(legacy.epics.length);
      expect(merged.stories.length).toBe(legacy.stories.length);
      expect(merged.tasks).toBe(legacy.tasks);

      // Per-entity deep equality on the snapshot fields that flow into
      // plan-status.json. The shim must NOT drift semantic fields (priority,
      // dependencies, dates, description) — even when repo provides a
      // structurally similar value.
      const legacyEpicById = new Map(legacy.epics.map((e) => [e.id, e]));
      for (const e of merged.epics) {
        const l = legacyEpicById.get(e.id);
        expect(e.id).toBe(l.id);
        expect(e.description).toBe(l.description);
        expect(e.startDate).toBe(l.startDate);
        expect(e.doneDate).toBe(l.doneDate);
        expect(e.dependencies).toEqual(l.dependencies);
        // Structural fields: must equal legacy because the repo either
        // matches legacy or doesn't have the entry (in which case fallback).
        expect(e.title).toBe(l.title);
        expect(e.status).toBe(l.status);
        expect(e.releaseTarget).toBe(l.releaseTarget);
      }

      const legacyStoryById = new Map(legacy.stories.map((s) => [s.id, s]));
      for (const s of merged.stories) {
        const l = legacyStoryById.get(s.id);
        expect(s.id).toBe(l.id);
        expect(s.priority).toBe(l.priority); // both paths normalise (post-US-0255)
        expect(s.dependencies).toEqual(l.dependencies);
        expect(s.title).toBe(l.title);
        expect(s.status).toBe(l.status);
        expect(s.epicId).toBe(l.epicId);
        expect(s.estimate).toBe(l.estimate);
        expect(s.branch).toBe(l.branch);
        // AC shape: per-story {id, text, done} — no storyId/position leakage.
        expect(s.acs.length).toBe(l.acs.length);
        for (let i = 0; i < s.acs.length; i++) {
          expect(s.acs[i].id).toBe(l.acs[i].id);
          expect(s.acs[i].text).toBe(l.acs[i].text);
          expect(s.acs[i].done).toBe(l.acs[i].done);
          expect(s.acs[i]).not.toHaveProperty('storyId');
          expect(s.acs[i]).not.toHaveProperty('position');
        }
      }
    } finally {
      Repository._reset();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('mergeRepoData falls back to legacy for entities the repo does not surface', () => {
    const legacy = {
      epics: [
        {
          id: 'EPIC-9999',
          title: 'L',
          description: 'd',
          releaseTarget: 'R1',
          status: 'Done',
          startDate: null,
          doneDate: null,
          dependencies: [],
        },
      ],
      stories: [
        {
          id: 'US-9999',
          epicId: 'EPIC-9999',
          title: 'L',
          priority: 'P0',
          estimate: 'M',
          status: 'Retired',
          branch: 'feat/x',
          acs: [{ id: 'AC-9999', text: 'l', done: false }],
          dependencies: ['US-0001'],
        },
      ],
      tasks: [
        {
          id: 'TASK-9999',
          storyId: 'US-9999',
          title: 't',
          type: 'code',
          assignee: 'a',
          status: 'Done',
          branch: 'b',
          notes: 'n',
        },
      ],
    };
    const merged = mergeRepoData(legacy, { epics: [], stories: [], acs: [] });
    expect(merged.epics[0]).toEqual(legacy.epics[0]);
    expect(merged.stories[0]).toEqual(legacy.stories[0]);
    expect(merged.tasks).toBe(legacy.tasks);
  });

  test('mergeRepoData keeps legacy ACs when length matches but IDs differ', () => {
    const legacy = {
      epics: [
        {
          id: 'EPIC-0001',
          title: 'E',
          status: 'Done',
          description: '',
          releaseTarget: '',
          startDate: null,
          doneDate: null,
          dependencies: [],
        },
      ],
      stories: [
        {
          id: 'US-0001',
          epicId: 'EPIC-0001',
          title: 'S',
          status: 'Done',
          priority: '',
          estimate: '',
          branch: '',
          acs: [
            { id: 'AC-0001', text: 'a', done: true },
            { id: 'AC-0002', text: 'b', done: false },
          ],
          dependencies: [],
        },
      ],
      tasks: [],
    };
    const repoData = {
      epics: [{ id: 'EPIC-0001', title: 'E', status: 'Done', releaseTarget: null }],
      stories: [{ id: 'US-0001', epicId: 'EPIC-0001', title: 'S', status: 'Done', estimate: '', branch: '' }],
      acs: [
        { id: 'AC-0001', storyId: 'US-0001', checked: 1, text: 'a', position: 0 },
        { id: 'AC-0099', storyId: 'US-0001', checked: 0, text: 'mismatched', position: 1 },
      ],
    };
    const merged = mergeRepoData(legacy, repoData);
    expect(merged.stories[0].acs).toEqual(legacy.stories[0].acs);
  });

  test('mergeRepoData reshapes repo ACs into per-story {id, text, done} when sets match', () => {
    const legacy = {
      epics: [
        {
          id: 'EPIC-1',
          title: 'E',
          description: '',
          releaseTarget: null,
          status: 'To Do',
          startDate: null,
          doneDate: null,
          dependencies: [],
        },
      ],
      stories: [
        {
          id: 'US-1',
          epicId: 'EPIC-1',
          title: 'old title',
          priority: 'P1',
          estimate: 'S',
          status: 'To Do',
          branch: '',
          acs: [
            { id: 'AC-1', text: 'old1', done: false },
            { id: 'AC-2', text: 'old2', done: false },
          ],
          dependencies: [],
        },
      ],
      tasks: [],
    };
    const repoData = {
      epics: [{ id: 'EPIC-1', title: 'E', status: 'To Do', releaseTarget: null }],
      stories: [
        { id: 'US-1', epicId: 'EPIC-1', title: 'new title', status: 'In Progress', estimate: 'M', branch: 'b' },
      ],
      acs: [
        { id: 'AC-1', storyId: 'US-1', text: 'new1', checked: true, position: 0 },
        { id: 'AC-2', storyId: 'US-1', text: 'new2', checked: false, position: 1 },
      ],
    };
    const merged = mergeRepoData(legacy, repoData);
    const s = merged.stories[0];
    expect(s.title).toBe('new title'); // repo overlays
    expect(s.status).toBe('In Progress'); // repo overlays
    expect(s.estimate).toBe('M'); // repo overlays
    expect(s.priority).toBe('P1'); // both paths produce 'P1' post-US-0255 — no gap
    expect(s.acs).toEqual([
      { id: 'AC-1', text: 'new1', done: true },
      { id: 'AC-2', text: 'new2', done: false },
    ]);
  });
});
