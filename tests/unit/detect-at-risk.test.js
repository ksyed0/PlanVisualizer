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
});
