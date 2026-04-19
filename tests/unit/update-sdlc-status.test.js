'use strict';

const { HANDLERS, parseArgs } = require('../../tools/update-sdlc-status');

function baseState() {
  return {
    currentPhase: 0,
    phases: [],
    agents: {},
    stories: {},
    metrics: {
      storiesCompleted: 0,
      storiesTotal: 0,
      tasksCompleted: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsTotal: 0,
      reviewsApproved: 0,
      reviewsBlocked: 0,
      coveragePercent: 0,
      bugsOpen: 0,
      bugsFixed: 0,
    },
    log: [],
  };
}

describe('update-sdlc-status — parseArgs', () => {
  it('parses subcommand and flag pairs', () => {
    const argv = ['node', 'x', 'agent-start', '--agent', 'Pixel', '--story', 'US-0096', '--task', 'implement'];
    const { cmd, opts } = parseArgs(argv);
    expect(cmd).toBe('agent-start');
    expect(opts.agent).toBe('Pixel');
    expect(opts.story).toBe('US-0096');
    expect(opts.task).toBe('implement');
  });

  it('ignores unpaired args safely', () => {
    const argv = ['node', 'x', 'log', '--message'];
    const { cmd, opts } = parseArgs(argv);
    expect(cmd).toBe('log');
    expect(opts.message).toBeUndefined();
  });
});

describe('update-sdlc-status — agent-start', () => {
  it('sets agent active + currentTask and logs', () => {
    const data = baseState();
    HANDLERS['agent-start'](data, { agent: 'Pixel', story: 'US-0096', task: 'zebra striping' });
    expect(data.agents.Pixel.status).toBe('active');
    expect(data.agents.Pixel.currentTask).toBe('zebra striping');
    expect(data.stories['US-0096'].status).toBe('InProgress');
    expect(data.stories['US-0096'].assignedAgent).toBe('Pixel');
    expect(data.log).toHaveLength(1);
    expect(data.log[0].agent).toBe('Pixel');
    expect(data.log[0].message).toContain('US-0096');
  });

  it('creates agent entry if missing', () => {
    const data = baseState();
    HANDLERS['agent-start'](data, { agent: 'Forge', task: 'backend work' });
    expect(data.agents.Forge).toBeDefined();
    expect(data.agents.Forge.status).toBe('active');
  });
});

describe('update-sdlc-status — agent-done', () => {
  it('flips agent idle and increments tasksCompleted', () => {
    const data = baseState();
    HANDLERS['agent-start'](data, { agent: 'Pixel', task: 'x' });
    HANDLERS['agent-done'](data, { agent: 'Pixel', story: 'US-0096' });
    expect(data.agents.Pixel.status).toBe('idle');
    expect(data.agents.Pixel.currentTask).toBeNull();
    expect(data.agents.Pixel.tasksCompleted).toBe(1);
    expect(data.metrics.tasksCompleted).toBe(1);
  });
});

describe('update-sdlc-status — review', () => {
  it('approves: increments reviewsCompleted + reviewsApproved', () => {
    const data = baseState();
    HANDLERS.review(data, { agent: 'Lens', story: 'US-0096', verdict: 'approve' });
    expect(data.agents.Lens.reviewsCompleted).toBe(1);
    expect(data.metrics.reviewsApproved).toBe(1);
    expect(data.metrics.reviewsBlocked).toBe(0);
  });

  it('block: increments reviewsBlocked + blockers, sets story Blocked', () => {
    const data = baseState();
    HANDLERS.review(data, { agent: 'Lens', story: 'US-0099', verdict: 'block' });
    expect(data.metrics.reviewsBlocked).toBe(1);
    expect(data.agents.Lens.blockers).toBe(1);
    expect(data.stories['US-0099'].status).toBe('Blocked');
  });

  it('defaults agent to Lens + verdict to approve', () => {
    const data = baseState();
    HANDLERS.review(data, { story: 'US-0100' });
    expect(data.agents.Lens.reviewsCompleted).toBe(1);
    expect(data.metrics.reviewsApproved).toBe(1);
  });
});

describe('update-sdlc-status — test-pass / test-fail / coverage', () => {
  it('test-pass increments agent and metrics', () => {
    const data = baseState();
    HANDLERS['test-pass'](data, { agent: 'Sentinel', count: '5', story: 'US-0096' });
    expect(data.agents.Sentinel.testsPassed).toBe(5);
    expect(data.metrics.testsPassed).toBe(5);
    expect(data.metrics.testsTotal).toBe(5);
  });

  it('test-fail increments agent and metrics', () => {
    const data = baseState();
    HANDLERS['test-fail'](data, { agent: 'Sentinel', count: '2' });
    expect(data.agents.Sentinel.testsFailed).toBe(2);
    expect(data.metrics.testsFailed).toBe(2);
    expect(data.metrics.testsTotal).toBe(2);
  });

  it('coverage sets both agent and metric percent', () => {
    const data = baseState();
    HANDLERS.coverage(data, { agent: 'Circuit', percent: '90.82' });
    expect(data.agents.Circuit.coveragePercent).toBeCloseTo(90.82);
    expect(data.metrics.coveragePercent).toBeCloseTo(90.82);
  });
});

describe('update-sdlc-status — story lifecycle', () => {
  it('story-start sets InProgress + startedAt (storiesTotal set by session-start)', () => {
    const data = baseState();
    data.metrics.storiesTotal = 5; // set externally by session-start
    HANDLERS['story-start'](data, { story: 'US-0096', epic: 'EPIC-0015' });
    expect(data.stories['US-0096'].status).toBe('InProgress');
    expect(data.stories['US-0096'].epic).toBe('EPIC-0015');
    expect(data.stories['US-0096'].startedAt).toBeTruthy();
    expect(data.metrics.storiesTotal).toBe(5); // unchanged
  });

  it('story-complete sets Complete + completedAt + bumps storiesCompleted', () => {
    const data = baseState();
    HANDLERS['story-start'](data, { story: 'US-0096', epic: 'EPIC-0015' });
    HANDLERS['story-complete'](data, { story: 'US-0096', epic: 'EPIC-0015' });
    expect(data.stories['US-0096'].status).toBe('Complete');
    expect(data.stories['US-0096'].completedAt).toBeTruthy();
    expect(data.metrics.storiesCompleted).toBe(1);
  });
});

describe('update-sdlc-status — cycle-complete', () => {
  function stateWithActiveSession() {
    const data = {
      currentPhase: 0,
      phases: [
        { id: 1, name: 'Build', status: 'complete', startedAt: '2026-04-18T09:00:00.000Z', completedAt: '2026-04-18T10:30:00.000Z' },
        { id: 2, name: 'Test',  status: 'complete', startedAt: '2026-04-18T10:30:00.000Z', completedAt: '2026-04-18T11:00:00.000Z' },
      ],
      agents: {},
      stories: {},
      cycles: [],
      project: { name: 'TestProj', description: '', repoUrl: '', startDate: '2026-01-01' },
      metrics: {
        storiesCompleted: 4, storiesTotal: 4,
        tasksCompleted: 12, tasksTotal: 0,
        testsPassed: 200, testsFailed: 0, testsTotal: 200,
        bugsOpen: 0, bugsFixed: 2, coveragePercent: 91.5,
        reviewsApproved: 8, reviewsBlocked: 0,
      },
      log: [],
    };
    return data;
  }

  it('appends a cycle snapshot to cycles[]', () => {
    const data = stateWithActiveSession();
    HANDLERS['cycle-complete'](data, {});
    expect(data.cycles).toHaveLength(1);
    expect(data.cycles[0].id).toBe(1);
    expect(data.cycles[0].storiesCompleted).toBe(4);
    expect(data.cycles[0].coveragePercent).toBeCloseTo(91.5);
    expect(data.cycles[0].completedAt).toBeTruthy();
  });

  it('captures phaseDurations in seconds', () => {
    const data = stateWithActiveSession();
    HANDLERS['cycle-complete'](data, {});
    expect(data.cycles[0].phaseDurations.Build).toBe(5400); // 1.5h = 5400s
    expect(data.cycles[0].phaseDurations.Test).toBe(1800);  // 0.5h = 1800s
  });

  it('resets runtime state after snapshotting', () => {
    const data = stateWithActiveSession();
    HANDLERS['cycle-complete'](data, {});
    expect(data.metrics.storiesCompleted).toBe(0);
    expect(data.stories).toEqual({});
    expect(data.currentPhase).toBe(0);
    expect(data.cycles).toHaveLength(1); // cycles preserved
  });

  it('increments cycle id across calls', () => {
    const data = stateWithActiveSession();
    HANDLERS['cycle-complete'](data, {});
    data.metrics.storiesCompleted = 2;
    HANDLERS['cycle-complete'](data, {});
    expect(data.cycles).toHaveLength(2);
    expect(data.cycles[1].id).toBe(2);
  });
});

describe('update-sdlc-status — phase', () => {
  function seededPhaseState() {
    const data = baseState();
    data.phases = [
      { id: 1, name: 'Blueprint',   agents: ['Compass'],                 deliverables: ['refined ACs'],   status: 'pending', startedAt: null, completedAt: null },
      { id: 2, name: 'Architect',   agents: ['Keystone'],                deliverables: ['scaffold'],      status: 'pending', startedAt: null, completedAt: null },
      { id: 3, name: 'Build',       agents: ['Pixel', 'Forge', 'Palette'], deliverables: ['implementation'], status: 'pending', startedAt: null, completedAt: null },
      { id: 4, name: 'Integration', agents: ['Pixel'],                   deliverables: ['e2e flows'],     status: 'pending', startedAt: null, completedAt: null },
      { id: 5, name: 'Test',        agents: ['Sentinel', 'Circuit'],     deliverables: ['test report'],   status: 'pending', startedAt: null, completedAt: null },
      { id: 6, name: 'Polish',      agents: ['Pixel', 'Forge'],          deliverables: ['bug fixes'],     status: 'pending', startedAt: null, completedAt: null },
    ];
    return data;
  }

  it('sets currentPhase + updates pre-seeded phase status', () => {
    const data = seededPhaseState();
    HANDLERS.phase(data, { number: '3', status: 'in-progress' });
    expect(data.currentPhase).toBe(3);
    expect(data.phases[2].name).toBe('Build');
    expect(data.phases[2].agents).toEqual(['Pixel', 'Forge', 'Palette']);
    expect(data.phases[2].status).toBe('in-progress');
    expect(data.phases[2].startedAt).toBeTruthy();
  });

  it('records completedAt on complete', () => {
    const data = seededPhaseState();
    HANDLERS.phase(data, { number: '1', status: 'in-progress' });
    HANDLERS.phase(data, { number: '1', status: 'complete' });
    expect(data.phases[0].status).toBe('complete');
    expect(data.phases[0].completedAt).toBeTruthy();
  });

  it('falls back to generic phase name when no phases seeded', () => {
    const data = baseState();
    data.phases = [];
    HANDLERS.phase(data, { number: '2', status: 'in-progress' });
    expect(data.currentPhase).toBe(2);
    expect(data.phases[1].name).toBe('Phase 2');
    expect(data.phases[1].status).toBe('in-progress');
  });

  it('throws a clear error when --number is missing or invalid', () => {
    const data = baseState();
    expect(() => HANDLERS.phase(data, { number: '0', status: 'in-progress' })).toThrow('--number must be a positive integer');
    expect(() => HANDLERS.phase(data, { number: 'abc', status: 'in-progress' })).toThrow('--number must be a positive integer');
    expect(() => HANDLERS.phase(data, { status: 'in-progress' })).toThrow('--number must be a positive integer');
  });
});

describe('update-sdlc-status — epic lifecycle', () => {
  it('epic-start creates epics entry with correct shape', () => {
    const data = baseState();
    data.epics = {};
    HANDLERS['epic-start'](data, { epic: 'EPIC-0019', name: 'Dashboard Effectiveness', stories: '8' });
    expect(data.epics['EPIC-0019']).toBeDefined();
    expect(data.epics['EPIC-0019'].status).toBe('in-progress');
    expect(data.epics['EPIC-0019'].storiesTotal).toBe(8);
    expect(data.epics['EPIC-0019'].storiesCompleted).toBe(0);
    expect(data.epics['EPIC-0019'].startedAt).toBeTruthy();
    expect(data.epics['EPIC-0019'].completedAt).toBeNull();
    expect(data.log[0].message).toContain('EPIC-0019');
  });

  it('epic-complete sets status and completedAt', () => {
    const data = baseState();
    data.epics = { 'EPIC-0019': { status: 'in-progress', storiesCompleted: 8, storiesTotal: 8, startedAt: '2026-01-01T00:00:00Z', completedAt: null } };
    HANDLERS['epic-complete'](data, { epic: 'EPIC-0019' });
    expect(data.epics['EPIC-0019'].status).toBe('complete');
    expect(data.epics['EPIC-0019'].completedAt).toBeTruthy();
  });

  it('story-complete increments epic storiesCompleted when epic exists', () => {
    const data = baseState();
    data.epics = { 'EPIC-0019': { status: 'in-progress', storiesCompleted: 2, storiesTotal: 8, startedAt: '2026-01-01T00:00:00Z', completedAt: null } };
    HANDLERS['story-complete'](data, { story: 'US-0127', epic: 'EPIC-0019' });
    expect(data.epics['EPIC-0019'].storiesCompleted).toBe(3);
  });

  it('epic-start throws when --epic is missing', () => {
    const data = baseState();
    data.epics = {};
    expect(() => HANDLERS['epic-start'](data, { name: 'No Epic ID' })).toThrow('epic-start requires --epic');
  });

  it('epic-complete throws when --epic is missing', () => {
    const data = baseState();
    expect(() => HANDLERS['epic-complete'](data, {})).toThrow('epic-complete requires --epic');
  });
});

describe('update-sdlc-status — session-start', () => {
  it('resets stories, phases status, and metrics but preserves project, agents, cycles, epics, log', () => {
    const data = baseState();
    data.project = { name: 'TestProj', description: 'Desc', repoUrl: '', startDate: '2026-01-01' };
    data.agents = { Pixel: { status: 'active', currentTask: 'old task', tasksCompleted: 5 } };
    data.cycles = [{ id: 1, completedAt: '2026-01-01T00:00:00Z', storiesCompleted: 3 }];
    data.epics = { 'EPIC-0001': { status: 'complete' } };
    data.stories = { 'US-0001': { status: 'InProgress' } };
    data.metrics.storiesCompleted = 4;
    data.metrics.testsPassed = 100;
    data.phases = [{ id: 1, name: 'Build', status: 'complete', startedAt: '2026-04-18T09:00:00Z', completedAt: '2026-04-18T10:00:00Z' }];

    HANDLERS['session-start'](data, { stories: '8' });

    expect(data.stories).toEqual({});
    expect(data.metrics.storiesCompleted).toBe(0);
    expect(data.metrics.testsPassed).toBe(0);
    expect(data.metrics.storiesTotal).toBe(8);
    expect(data.currentPhase).toBe(0);
    expect(data.phases[0].status).toBe('pending');
    expect(data.phases[0].startedAt).toBeNull();
    expect(data.phases[0].completedAt).toBeNull();
    // preserved:
    expect(data.project.name).toBe('TestProj');
    expect(data.agents.Pixel).toBeDefined();
    expect(data.agents.Pixel.tasksCompleted).toBe(5); // accumulated state preserved
    expect(data.cycles).toHaveLength(1);
    expect(data.epics['EPIC-0001']).toBeDefined();
  });

  it('sets storiesTotal from --stories argument', () => {
    const data = baseState();
    HANDLERS['session-start'](data, { stories: '5' });
    expect(data.metrics.storiesTotal).toBe(5);
  });

  it('throws when --stories is non-numeric', () => {
    const data = baseState();
    expect(() => HANDLERS['session-start'](data, { stories: 'abc' })).toThrow('--stories must be a non-negative integer');
  });
});

describe('update-sdlc-status — --agent validation', () => {
  it('agent-start throws when --agent is missing', () => {
    const data = baseState();
    expect(() => HANDLERS['agent-start'](data, { task: 'work' })).toThrow('--agent is required');
  });

  it('agent-start throws when --agent is the string "undefined"', () => {
    const data = baseState();
    expect(() => HANDLERS['agent-start'](data, { agent: 'undefined', task: 'work' })).toThrow('--agent is required');
  });

  it('agent-done throws when --agent is missing', () => {
    const data = baseState();
    expect(() => HANDLERS['agent-done'](data, {})).toThrow('--agent is required');
  });
});

describe('update-sdlc-status — bug metrics', () => {
  it('bug-open increments bugsOpen', () => {
    const data = baseState();
    HANDLERS['bug-open'](data, { story: 'US-0127' });
    expect(data.metrics.bugsOpen).toBe(1);
    expect(data.log[0].message).toContain('bug opened');
  });

  it('bug-fix decrements bugsOpen and increments bugsFixed', () => {
    const data = baseState();
    data.metrics.bugsOpen = 2;
    HANDLERS['bug-fix'](data, { story: 'US-0127' });
    expect(data.metrics.bugsOpen).toBe(1);
    expect(data.metrics.bugsFixed).toBe(1);
  });

  it('bug-fix floors bugsOpen at 0', () => {
    const data = baseState();
    data.metrics.bugsOpen = 0;
    HANDLERS['bug-fix'](data, { story: 'US-0127' });
    expect(data.metrics.bugsOpen).toBe(0);
    expect(data.metrics.bugsFixed).toBe(1);
  });
});

describe('update-sdlc-status — story-complete auto-idles agent', () => {
  it('auto-idles the assignedAgent on story-complete', () => {
    const data = baseState();
    HANDLERS['agent-start'](data, { agent: 'Pixel', story: 'US-0127', task: 'implement' });
    HANDLERS['story-complete'](data, { story: 'US-0127', epic: 'EPIC-0019' });
    expect(data.agents.Pixel.status).toBe('idle');
    expect(data.agents.Pixel.currentTask).toBeNull();
  });

  it('story-complete with no assignedAgent does not crash', () => {
    const data = baseState();
    expect(() => HANDLERS['story-complete'](data, { story: 'US-0127' })).not.toThrow();
  });
});

describe('update-sdlc-status — log', () => {
  it('appends a generic log entry', () => {
    const data = baseState();
    HANDLERS.log(data, { agent: 'Conductor', message: 'spawned parallel testers' });
    expect(data.log).toHaveLength(1);
    expect(data.log[0].agent).toBe('Conductor');
    expect(data.log[0].message).toBe('spawned parallel testers');
    expect(data.log[0].time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('trims log to 200 entries', () => {
    const data = baseState();
    for (let i = 0; i < 250; i++) {
      HANDLERS.log(data, { message: `entry ${i}` });
    }
    expect(data.log).toHaveLength(200);
    expect(data.log[0].message).toBe('entry 50');
    expect(data.log[199].message).toBe('entry 249');
  });
});
