'use strict';
const { computeStoryRisk, computeAllRisk } = require('../../tools/lib/compute-risk');

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

  it("'In Progress' (space) status is treated same as 'In-Progress' (hyphen) → weight 2", () => {
    // Canonical status from parser is 'In Progress'; STATUS_WEIGHTS has both spellings
    const story = { priority: 'P4', status: 'In Progress' };
    const r = computeStoryRisk(story);
    // (1×0.4)+(0×0.3)+(2×0.3) = 0.4+0+0.6 = 1.0 → Medium
    expect(r.score).toBe(1.0);
    expect(r.level).toBe('Medium');
  });
});

describe('computeAllRisk', () => {
  it('returns empty Maps for empty input', () => {
    const { byStory, byEpic } = computeAllRisk([], []);
    expect(byStory.size).toBe(0);
    expect(byEpic.size).toBe(0);
  });

  it('scores stories and aggregates per epic, excluding Done stories', () => {
    const stories = [
      { id: 'US-0001', epicId: 'EPIC-0001', priority: 'P1', status: 'In Progress' },
      { id: 'US-0002', epicId: 'EPIC-0001', priority: 'P2', status: 'Done' },
    ];
    const { byStory, byEpic } = computeAllRisk(stories, []);
    // US-0001: (4×0.4)+(0×0.3)+(2×0.3) = 1.6+0+0.6 = 2.2 → High
    expect(byStory.get('US-0001').score).toBe(2.2);
    expect(byStory.get('US-0001').level).toBe('High');
    // US-0002: (3×0.4)+(0×0.3)+(0×0.3) = 1.2 → Medium (still scored)
    expect(byStory.get('US-0002').score).toBe(1.2);
    // EPIC-0001: only US-0001 contributes (Done excluded)
    const ep = byEpic.get('EPIC-0001');
    expect(ep.avgScore).toBe(2.2);
    expect(ep.level).toBe('High');
    expect(ep.counts.High).toBe(1);
    expect(ep.counts.Low).toBe(0);
  });

  it('matches bugs to stories via normalizeStoryRef on relatedStory', () => {
    const stories = [{ id: 'US-0003', epicId: 'EPIC-0002', priority: 'P2', status: 'Planned' }];
    const bugs = [{ severity: 'Critical', status: 'Open', relatedStory: 'US-0003 (some context)' }];
    const { byStory } = computeAllRisk(stories, bugs);
    // (3×0.4)+(4×0.3)+(1×0.3) = 1.2+1.2+0.3 = 2.7 → High
    expect(byStory.get('US-0003').score).toBe(2.7);
    expect(byStory.get('US-0003').level).toBe('High');
  });

  it('excludes Retired stories from epic aggregation', () => {
    const stories = [
      { id: 'US-0004', epicId: 'EPIC-0003', priority: 'P3', status: 'Retired' },
      { id: 'US-0005', epicId: 'EPIC-0003', priority: 'P4', status: 'Planned' },
    ];
    const { byEpic } = computeAllRisk(stories, []);
    // Only US-0005: (1×0.4)+(0×0.3)+(1×0.3) = 0.4+0+0.3 = 0.7 → Low
    const ep = byEpic.get('EPIC-0003');
    expect(ep.avgScore).toBe(0.7);
    expect(ep.counts.Low).toBe(1);
    expect(ep.counts.Medium).toBe(0);
  });

  it('epic with all Done stories gets avgScore 0', () => {
    const stories = [{ id: 'US-0006', epicId: 'EPIC-0004', priority: 'P1', status: 'Done' }];
    const { byEpic } = computeAllRisk(stories, []);
    const ep = byEpic.get('EPIC-0004');
    expect(ep.avgScore).toBe(0);
  });
});
