'use strict';

function computeProjectedCost(estimate, hoursMap, rate) {
  const hours = hoursMap[estimate];
  if (!hours) return 0;
  return hours * rate;
}

function attributeAICosts(stories, costByBranch) {
  const result = {};
  let totalCost = 0,
    totalInput = 0,
    totalOutput = 0;

  // First pass: exact branch-name match
  let matchedCost = 0;
  for (const story of stories) {
    const match = story.branch ? costByBranch[story.branch] : null;
    result[story.id] = match
      ? {
          costUsd: match.costUsd,
          inputTokens: match.inputTokens,
          outputTokens: match.outputTokens,
          sessions: match.sessions,
        }
      : { costUsd: 0, inputTokens: 0, outputTokens: 0, sessions: 0 };
    matchedCost += result[story.id].costUsd;
  }

  // _totals includes ALL real branches (est/* branches are estimated bug costs,
  // excluded here so they don't inflate the story-level total).
  for (const [branch, v] of Object.entries(costByBranch)) {
    if (branch.startsWith('est/')) continue;
    totalCost += v.costUsd;
    totalInput += v.inputTokens;
    totalOutput += v.outputTokens;
  }

  // Second pass: distribute unattributed cost proportionally across all stories
  // so the chart never shows all-zero bars when branches don't follow US-XXXX naming.
  const unattributed = parseFloat((totalCost - matchedCost).toFixed(6));
  if (unattributed > 0 && stories.length > 0) {
    const perStory = unattributed / stories.length;
    for (const story of stories) {
      result[story.id].costUsd = parseFloat((result[story.id].costUsd + perStory).toFixed(6));
    }
  }

  result._totals = {
    costUsd: totalCost,
    inputTokens: totalInput,
    outputTokens: totalOutput,
  };
  return result;
}

function attributeBugCosts(bugs, costByBranch) {
  const result = {};
  let totalCost = 0,
    totalInput = 0,
    totalOutput = 0;

  for (const bug of bugs) {
    const match = bug.fixBranch ? costByBranch[bug.fixBranch] : null;
    const estimated = bug.estimatedCostUsd || 0;
    if (match) {
      const isEstimatedBranch = (bug.fixBranch || '').startsWith('est/');
      result[bug.id] = {
        costUsd: match.costUsd,
        inputTokens: isEstimatedBranch ? 0 : match.inputTokens,
        outputTokens: isEstimatedBranch ? 0 : match.outputTokens,
        sessions: isEstimatedBranch ? 0 : match.sessions,
        isEstimated: isEstimatedBranch,
      };
      totalCost += match.costUsd;
      totalInput += match.inputTokens;
      totalOutput += match.outputTokens;
    } else {
      result[bug.id] = {
        costUsd: estimated,
        inputTokens: 0,
        outputTokens: 0,
        sessions: 0,
        isEstimated: estimated > 0,
      };
      totalCost += estimated;
    }
  }

  result._totals = {
    costUsd: totalCost,
    inputTokens: totalInput,
    outputTokens: totalOutput,
  };
  return result;
}

module.exports = { computeProjectedCost, attributeAICosts, attributeBugCosts };
