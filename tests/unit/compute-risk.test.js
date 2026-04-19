'use strict';
const { computeStoryRisk } = require('../../tools/lib/compute-risk');

describe('computeStoryRisk', () => {
  it('P1 Blocked + Critical open bug → score 4.0, Critical', () => {
    const story = { priority: 'P1', status: 'Blocked' };
    const bugs = [{ severity: 'Critical', status: 'Open' }];
    const r = computeStoryRisk(story, bugs);
    // (4×0.4)+(4×0.3)+(4×0.3) = 1.6+1.2+1.2 = 4.0
    expect(r.score).toBe(4.0);
    expect(r.level).toBe('Critical');
  });

  it('P4 Done, no bugs → score 0.4, Low', () => {
    const story = { priority: 'P4', status: 'Done' };
    const r = computeStoryRisk(story);
    // (1×0.4)+(0×0.3)+(0×0.3) = 0.4
    expect(r.score).toBe(0.4);
    expect(r.level).toBe('Low');
  });

  it('no priority set defaults to weight 2 → score 1.1, Medium', () => {
    const story = { status: 'Planned' };
    const r = computeStoryRisk(story);
    // (2×0.4)+(0×0.3)+(1×0.3) = 0.8+0+0.3 = 1.1
    expect(r.score).toBe(1.1);
    expect(r.level).toBe('Medium');
  });

  it('Fixed/Retired/Cancelled bugs count as severity 0 → score 1.5', () => {
    const story = { priority: 'P2', status: 'Planned' };
    const bugs = [
      { severity: 'Critical', status: 'Fixed' },
      { severity: 'High', status: 'Retired' },
      { severity: 'Medium', status: 'Cancelled' },
    ];
    const r = computeStoryRisk(story, bugs);
    // (3×0.4)+(0×0.3)+(1×0.3) = 1.2+0+0.3 = 1.5
    expect(r.score).toBe(1.5);
    expect(r.level).toBe('Medium');
  });

  it('score exactly 1.0 → Medium (boundary)', () => {
    // P4 In-Progress no bugs: (1×0.4)+(0×0.3)+(2×0.3) = 0.4+0+0.6 = 1.0
    const story = { priority: 'P4', status: 'In-Progress' };
    const r = computeStoryRisk(story);
    expect(r.score).toBe(1.0);
    expect(r.level).toBe('Medium');
  });

  it('score exactly 2.0 → High (boundary)', () => {
    // P3 In-Progress + Medium bug: (2×0.4)+(2×0.3)+(2×0.3) = 0.8+0.6+0.6 = 2.0
    const story = { priority: 'P3', status: 'In-Progress' };
    const bugs = [{ severity: 'Medium', status: 'Open' }];
    const r = computeStoryRisk(story, bugs);
    expect(r.score).toBe(2.0);
    expect(r.level).toBe('High');
  });

  it('score exactly 3.0 → Critical (boundary)', () => {
    // P2 In-Progress + Critical bug: (3×0.4)+(4×0.3)+(2×0.3) = 1.2+1.2+0.6 = 3.0
    const story = { priority: 'P2', status: 'In-Progress' };
    const bugs = [{ severity: 'Critical', status: 'Open' }];
    const r = computeStoryRisk(story, bugs);
    expect(r.score).toBe(3.0);
    expect(r.level).toBe('Critical');
  });

  it('uses max severity across multiple open bugs', () => {
    // Two open bugs: Low + High → uses High(3)
    // P3 Planned: (2×0.4)+(3×0.3)+(1×0.3) = 0.8+0.9+0.3 = 2.0 → High
    const story = { priority: 'P3', status: 'Planned' };
    const bugs = [
      { severity: 'Low', status: 'Open' },
      { severity: 'High', status: 'Open' },
    ];
    const r = computeStoryRisk(story, bugs);
    expect(r.score).toBe(2.0);
    expect(r.level).toBe('High');
  });
});
