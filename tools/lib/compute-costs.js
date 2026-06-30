'use strict';

function computeProjectedCost(estimate, hoursMap, rate) {
  const hours = hoursMap[estimate];
  if (!hours) return 0;
  return hours * rate;
}

// Round to 6 decimals to keep small float-drift out of test totals.
function _r6(n) {
  return parseFloat((n || 0).toFixed(6));
}

// ENH-0005: cacheRead / (input + cacheRead). Input Tokens already folds in
// cache-write at capture time (tools/capture-cost.js), so no separate
// cache-write handling is needed here. Returns null on a zero denominator
// (no real token activity) rather than NaN/0, so callers can render an
// explicit empty state instead of a misleading "0%".
function cacheHitRatio(cacheReadTokens, inputTokens) {
  const denom = (inputTokens || 0) + (cacheReadTokens || 0);
  if (denom <= 0) return null;
  return _r6((cacheReadTokens || 0) / denom);
}

function attributeAICosts(stories, costByBranch) {
  const result = {};
  let totalCost = 0,
    totalInput = 0,
    totalOutput = 0,
    totalCacheRead = 0;

  // BUG-0217: a single branch may be claimed by N stories (e.g. 36 stories share
  // `Branch: develop`). Splitting equally avoids inflating each story's cost by
  // the full branch total.
  const branchClaimCount = {};
  for (const story of stories) {
    if (!story.branch) continue;
    branchClaimCount[story.branch] = (branchClaimCount[story.branch] || 0) + 1;
  }

  // First pass: exact branch-name match, share with siblings.
  let matchedCost = 0;
  for (const story of stories) {
    const match = story.branch ? costByBranch[story.branch] : null;
    if (match) {
      const n = branchClaimCount[story.branch] || 1;
      const inputTokens = Math.round((match.inputTokens || 0) / n);
      const cacheReadTokens = Math.round((match.cacheReadTokens || 0) / n);
      result[story.id] = {
        costUsd: _r6(match.costUsd / n),
        inputTokens,
        outputTokens: Math.round((match.outputTokens || 0) / n),
        cacheReadTokens,
        cacheHitRatio: cacheHitRatio(cacheReadTokens, inputTokens),
        sessions: Math.max(1, Math.round((match.sessions || 0) / n)),
      };
    } else {
      result[story.id] = {
        costUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheHitRatio: null,
        sessions: 0,
      };
    }
    matchedCost += result[story.id].costUsd;
  }

  // _totals includes ALL real branches (est/* branches are estimated bug costs,
  // excluded here so they don't inflate the story-level total).
  for (const [branch, v] of Object.entries(costByBranch)) {
    if (branch.startsWith('est/')) continue;
    totalCost += v.costUsd;
    totalInput += v.inputTokens;
    totalOutput += v.outputTokens;
    totalCacheRead += v.cacheReadTokens || 0;
  }

  // Second pass: distribute unattributed cost (branches that no story claimed)
  // proportionally across all stories so the chart never shows all-zero bars
  // when branches don't follow US-XXXX naming.
  const unattributed = _r6(totalCost - matchedCost);
  if (unattributed > 0 && stories.length > 0) {
    const perStory = unattributed / stories.length;
    for (const story of stories) {
      result[story.id].costUsd = _r6(result[story.id].costUsd + perStory);
    }
  }

  result._totals = {
    costUsd: totalCost,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheReadTokens: totalCacheRead,
    cacheHitRatio: cacheHitRatio(totalCacheRead, totalInput),
  };
  return result;
}

function attributeBugCosts(bugs, costByBranch) {
  const result = {};
  let totalCost = 0,
    totalInput = 0,
    totalOutput = 0,
    totalCacheRead = 0;

  // BUG-0224: many bugs share a single fix branch (e.g. 12 bugs on
  // `bugfix/BUG-0190-0197-ui-fixes`). Without splitting, every bug shows the
  // same full cost, so identical $X values appear across many bug rows. Split
  // the branch cost evenly across the bugs that name it.
  const branchClaimCount = {};
  for (const bug of bugs) {
    if (!bug.fixBranch) continue;
    branchClaimCount[bug.fixBranch] = (branchClaimCount[bug.fixBranch] || 0) + 1;
  }

  for (const bug of bugs) {
    const match = bug.fixBranch ? costByBranch[bug.fixBranch] : null;
    const estimated = bug.estimatedCostUsd || 0;
    if (match) {
      const n = branchClaimCount[bug.fixBranch] || 1;
      const isEstimatedBranch = (bug.fixBranch || '').startsWith('est/');
      const share = _r6(match.costUsd / n);
      const inShare = isEstimatedBranch ? 0 : Math.round((match.inputTokens || 0) / n);
      const outShare = isEstimatedBranch ? 0 : Math.round((match.outputTokens || 0) / n);
      const cacheReadShare = isEstimatedBranch ? 0 : Math.round((match.cacheReadTokens || 0) / n);
      const sessShare = isEstimatedBranch ? 0 : Math.max(1, Math.round((match.sessions || 0) / n));
      result[bug.id] = {
        costUsd: share,
        inputTokens: inShare,
        outputTokens: outShare,
        cacheReadTokens: cacheReadShare,
        cacheHitRatio: cacheHitRatio(cacheReadShare, inShare),
        sessions: sessShare,
        isEstimated: isEstimatedBranch,
      };
      totalCost += share;
      totalInput += inShare;
      totalOutput += outShare;
      totalCacheRead += cacheReadShare;
    } else {
      result[bug.id] = {
        costUsd: estimated,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheHitRatio: null,
        sessions: 0,
        isEstimated: estimated > 0,
      };
      totalCost += estimated;
    }
  }

  result._totals = {
    costUsd: _r6(totalCost),
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheReadTokens: totalCacheRead,
    cacheHitRatio: cacheHitRatio(totalCacheRead, totalInput),
  };
  return result;
}

// ENH-0005: per-session cache-hit-ratio trend. Dedupes the Stop hook's
// cumulative per-turn rows down to one (the last/highest) row per session,
// excludes "-est" sessionId rows (pre-hook manual cost estimates with
// fabricated cache-read numbers — see docs/ENHANCEMENTS.md ENH-0005
// pre-work) and any row with zero input+cacheRead (degenerate/seed rows),
// then returns the chronological ratio series plus a rolling average of
// the last `windowSize` sessions (each session weighted equally).
function computeCacheHitSeries(costRows, { windowSize = 14 } = {}) {
  const lastBySession = new Map();
  for (const row of costRows || []) {
    if (!row || !row.sessionId) continue;
    lastBySession.set(row.sessionId, row);
  }

  const series = Array.from(lastBySession.values())
    .filter((row) => !String(row.sessionId).endsWith('-est'))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((row) => ({
      date: row.date,
      sessionId: row.sessionId,
      ratio: cacheHitRatio(row.cacheReadTokens, row.inputTokens),
    }))
    .filter((entry) => entry.ratio !== null);

  const windowed = series.slice(-windowSize);
  const rollingAvg = windowed.length ? _r6(windowed.reduce((s, e) => s + e.ratio, 0) / windowed.length) : null;

  return {
    series,
    latest: series.length ? series[series.length - 1].ratio : null,
    rollingAvg,
    windowSize,
    sampleCount: windowed.length,
  };
}

module.exports = {
  computeProjectedCost,
  attributeAICosts,
  attributeBugCosts,
  cacheHitRatio,
  computeCacheHitSeries,
};
