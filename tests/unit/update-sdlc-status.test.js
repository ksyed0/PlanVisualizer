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
  it('story-start sets InProgress + startedAt + bumps storiesTotal', () => {
    const data = baseState();
    HANDLERS['story-start'](data, { story: 'US-0096', epic: 'EPIC-0015' });
    expect(data.stories['US-0096'].status).toBe('InProgress');
    expect(data.stories['US-0096'].epic).toBe('EPIC-0015');
    expect(data.stories['US-0096'].startedAt).toBeTruthy();
    expect(data.metrics.storiesTotal).toBe(1);
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

describe('update-sdlc-status — phase', () => {
  it('sets currentPhase + auto-expands phases array with canonical names', () => {
    const data = baseState();
    HANDLERS.phase(data, { number: '3', status: 'in-progress' });
    expect(data.currentPhase).toBe(3);
    expect(data.phases).toHaveLength(3);
    expect(data.phases[0].name).toBe('Blueprint');
    expect(data.phases[1].name).toBe('Architect');
    expect(data.phases[2].name).toBe('Build');
    expect(data.phases[2].agents).toEqual(['Pixel', 'Forge', 'Palette']);
    expect(data.phases[2].status).toBe('in-progress');
    expect(data.phases[2].startedAt).toBeTruthy();
  });

  it('records completedAt on complete', () => {
    const data = baseState();
    HANDLERS.phase(data, { number: '1', status: 'in-progress' });
    HANDLERS.phase(data, { number: '1', status: 'complete' });
    expect(data.phases[0].status).toBe('complete');
    expect(data.phases[0].completedAt).toBeTruthy();
  });
});

describe('update-sdlc-status — log', () => {
  it('appends a generic log entry', () => {
    const data = baseState();
    HANDLERS.log(data, { agent: 'Conductor', message: 'spawned parallel testers' });
    expect(data.log).toHaveLength(1);
    expect(data.log[0].agent).toBe('Conductor');
    expect(data.log[0].message).toBe('spawned parallel testers');
    expect(data.log[0].time).toMatch(/^\d{2}:\d{2}$/);
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
