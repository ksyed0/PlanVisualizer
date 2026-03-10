'use strict';

function detectAtRisk(stories, testCases, bugs) {
  const result = {};
  for (const story of stories) {
    const linkedTCs = testCases.filter(tc => tc.relatedStory === story.id);
    const hasACs = story.acs && story.acs.length > 0;
    const missingTCs = hasACs && linkedTCs.length === 0;
    const noBranch = story.status === 'In Progress' && !story.branch;
    const failedTCNoBug = linkedTCs.some(tc => tc.status === 'Fail' && (!tc.defect || tc.defect === 'None'));
    const isAtRisk = missingTCs || noBranch || failedTCNoBug;
    result[story.id] = { missingTCs, noBranch, failedTCNoBug, isAtRisk };
  }
  return result;
}

module.exports = { detectAtRisk };
