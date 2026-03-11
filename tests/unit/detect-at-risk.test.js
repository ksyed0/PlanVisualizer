'use strict';
const { detectAtRisk } = require('../../tools/lib/detect-at-risk');

describe('detectAtRisk', () => {
  const makeStory = (overrides) => ({
    id: 'US-0001', status: 'In Progress', branch: 'feature/US-0001',
    acs: [{ id: 'AC-0001', done: false }], ...overrides,
  });

  it('flags story with ACs but no linked TCs', () => {
    const stories = [makeStory()];
    const tcs = [];
    const result = detectAtRisk(stories, tcs, []);
    expect(result['US-0001'].missingTCs).toBe(true);
  });

  it('no flag when story has matching TC', () => {
    const stories = [makeStory()];
    const tcs = [{ id: 'TC-0001', relatedStory: 'US-0001', status: 'Not Run' }];
    const result = detectAtRisk(stories, tcs, []);
    expect(result['US-0001'].missingTCs).toBe(false);
  });

  it('flags In Progress story with no branch', () => {
    const stories = [makeStory({ branch: '' })];
    const result = detectAtRisk(stories, [], []);
    expect(result['US-0001'].noBranch).toBe(true);
  });

  it('no noBranch flag when status is Planned', () => {
    const stories = [makeStory({ status: 'Planned', branch: '' })];
    const result = detectAtRisk(stories, [], []);
    expect(result['US-0001'].noBranch).toBe(false);
  });

  it('flags failed TC with no linked bug', () => {
    const stories = [makeStory()];
    const tcs = [{ id: 'TC-0001', relatedStory: 'US-0001', status: 'Fail', defect: 'None' }];
    const result = detectAtRisk(stories, tcs, []);
    expect(result['US-0001'].failedTCNoBug).toBe(true);
  });

  it('flags story with open critical bug linked to it', () => {
    const bugs = [{ id: 'BUG-0001', relatedStory: 'US-0001', severity: 'Critical', status: 'Open' }];
    const result = detectAtRisk([makeStory()], [], bugs);
    expect(result['US-0001'].openCriticalBug).toBe(true);
    expect(result['US-0001'].isAtRisk).toBe(true);
  });

  it('does not flag story when linked bug is Fixed', () => {
    const bugs = [{ id: 'BUG-0001', relatedStory: 'US-0001', severity: 'Critical', status: 'Fixed' }];
    const result = detectAtRisk([makeStory()], [], bugs);
    expect(result['US-0001'].openCriticalBug).toBe(false);
  });

  it('does not flag story when bug is for different story', () => {
    const bugs = [{ id: 'BUG-0001', relatedStory: 'US-0099', severity: 'Critical', status: 'Open' }];
    const result = detectAtRisk([makeStory()], [], bugs);
    expect(result['US-0001'].openCriticalBug).toBe(false);
  });
});
