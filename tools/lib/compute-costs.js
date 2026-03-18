'use strict';

function computeProjectedCost(estimate, hoursMap, rate) {
  const hours = hoursMap[estimate];
  if (!hours) return 0;
  return hours * rate;
}

function attributeAICosts(stories, costByBranch) {
  const result = {};
  let totalCost = 0, totalInput = 0, totalOutput = 0;

  for (const story of stories) {
    const match = story.branch ? costByBranch[story.branch] : null;
    result[story.id] = match
      ? { costUsd: match.costUsd, inputTokens: match.inputTokens, outputTokens: match.outputTokens, sessions: match.sessions }
      : { costUsd: 0, inputTokens: 0, outputTokens: 0, sessions: 0 };
  }

  for (const v of Object.values(costByBranch)) {
    totalCost += v.costUsd;
    totalInput += v.inputTokens;
    totalOutput += v.outputTokens;
  }

  result._totals = { costUsd: totalCost, inputTokens: totalInput, outputTokens: totalOutput };
  return result;
}

function attributeBugCosts(bugs, costByBranch) {
  const result = {};
  let totalCost = 0, totalInput = 0, totalOutput = 0;

  for (const bug of bugs) {
    const match = bug.fixBranch ? costByBranch[bug.fixBranch] : null;
    const estimated = bug.estimatedCostUsd || 0;
    if (match) {
      result[bug.id] = { costUsd: match.costUsd, inputTokens: match.inputTokens, outputTokens: match.outputTokens, sessions: match.sessions, isEstimated: false };
      totalCost += match.costUsd;
      totalInput += match.inputTokens;
      totalOutput += match.outputTokens;
    } else {
      result[bug.id] = { costUsd: estimated, inputTokens: 0, outputTokens: 0, sessions: 0, isEstimated: estimated > 0 };
      totalCost += estimated;
    }
  }

  result._totals = { costUsd: totalCost, inputTokens: totalInput, outputTokens: totalOutput };
  return result;
}

module.exports = { computeProjectedCost, attributeAICosts, attributeBugCosts };
