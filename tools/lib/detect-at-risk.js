'use strict';

function detectAtRisk(stories, testCases, bugs) {
  const result = {};
  for (const story of stories) {
    const linkedTCs = testCases.filter(tc => tc.relatedStory === story.id);
    const hasACs = story.acs && story.acs.length > 0;
    const missingTCs = hasACs && linkedTCs.length === 0;
    const noBranch = story.status === 'In Progress' && !story.branch;
    const failedTCNoBug = linkedTCs.some(tc => tc.status === 'Fail' && (!tc.defect || tc.defect === 'None'));
    const openCriticalBug = Array.isArray(bugs) && bugs.some(
      b => b.relatedStory === story.id &&
           (b.severity === 'Critical' || b.severity === 'High') &&
           (b.status === 'Open' || b.status === 'In Progress')
    );
    const isAtRisk = missingTCs || noBranch || failedTCNoBug || openCriticalBug;
    result[story.id] = { missingTCs, noBranch, failedTCNoBug, openCriticalBug, isAtRisk };
  }
  return result;
}

module.exports = { detectAtRisk };
