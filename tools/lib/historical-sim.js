'use strict';

const fs = require('fs');
const path = require('path');

const SNAPSHOT_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.json$/;

function getSnapshotFilename(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}-${mi}-${s}Z.json`;
}

function calculateAvgTokensPerEstimate(data) {
  const doneStories = (data.stories || []).filter(s => s.status === 'Done');
  const tshirtPoints = { XS: 0.5, S: 1, M: 3, L: 5, XL: 8 };
  
  const byEstimate = {};
  doneStories.forEach(story => {
    const est = story.estimate ? story.estimate.toUpperCase() : null;
    if (!est) return;
    const points = tshirtPoints[est] || 0;
    if (!byEstimate[est]) {
      byEstimate[est] = { totalTokens: 0, count: 0, points: points };
    }
  });
  
  Object.entries(data.costs || {}).forEach(([storyId, cost]) => {
    if (storyId.startsWith('_')) return;
    const story = doneStories.find(s => s.id === storyId);
    if (!story || !story.estimate) return;
    const est = story.estimate.toUpperCase();
    if (!byEstimate[est]) return;
    byEstimate[est].totalTokens += (cost.inputTokens || 0) + (cost.outputTokens || 0);
  });
  
  const result = {};
  Object.keys(byEstimate).forEach(est => {
    const data = byEstimate[est];
    result[est] = data.count > 0 ? Math.round(data.totalTokens / data.count) : 0;
  });
  
  return result;
}

function estimateStoryCost(estimate, avgTokens, inputRate = 3, outputRate = 15) {
  const est = estimate ? estimate.toUpperCase() : 'M';
  const tokens = avgTokens[est] || avgTokens['M'] || 50000;
  const inputCost = (tokens * inputRate) / 1_000_000;
  const outputCost = (tokens * outputRate) / 1_000_000;
  return inputCost + outputCost;
}

function backfillHistory(options = {}) {
  const root = options.root || process.cwd();
  const days = options.days || 30;
  const estimatePlanned = options.estimatePlanned !== false;
  const historyDir = path.join(root, '.history');
  
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  
  const existingFiles = fs.readdirSync(historyDir).filter(f => SNAPSHOT_REGEX.test(f));
  if (existingFiles.length >= 2) {
    console.log('[historical-sim] Found existing snapshots, skipping backfill');
    return { skipped: true, reason: 'existing_snapshots' };
  }
  
  const currentDataPath = path.join(root, 'docs', 'plan-status.json');
  if (!fs.existsSync(currentDataPath)) {
    console.log('[historical-sim] No plan-status.json found, skipping backfill');
    return { skipped: true, reason: 'no_data' };
  }
  
  const currentData = JSON.parse(fs.readFileSync(currentDataPath, 'utf8'));
  
  const avgTokens = calculateAvgTokensPerEstimate(currentData);
  
  const totalSpent = currentData.costs && currentData.costs._totals 
    ? currentData.costs._totals.costUsd || 0 
    : 0;
  
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  
  const doneStories = (currentData.stories || []).filter(s => s.status === 'Done');
  const plannedStories = (currentData.stories || []).filter(s => s.status === 'Planned' || s.status === 'To Do');
  
  const avgDailySpend = days > 0 ? totalSpent / days : totalSpent;
  
  const generated = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    const progressRatio = (i + 1) / days;
    const simulatedSpent = totalSpent * progressRatio;
    const simulatedDoneCount = Math.round(doneStories.length * progressRatio);
    
    const simulatedCosts = {};
    
    doneStories.forEach((story, idx) => {
      if (idx < simulatedDoneCount) {
        const storyRatio = (idx + 1) / doneStories.length;
        const storySpent = simulatedSpent * storyRatio;
        const avgCostPerStory = doneStories.length > 0 ? simulatedSpent / simulatedDoneCount : 0;
        simulatedCosts[story.id] = {
          projectedUsd: currentData.costs[story.id]?.projectedUsd || 0,
          costUsd: avgCostPerStory || 0,
          inputTokens: Math.round((avgTokens[story.estimate?.toUpperCase()] || 50000) * progressRatio),
          outputTokens: Math.round((avgTokens[story.estimate?.toUpperCase()] || 15000) * progressRatio),
        };
      } else {
        simulatedCosts[story.id] = {
          projectedUsd: currentData.costs[story.id]?.projectedUsd || 0,
          costUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
      }
    });
    
    if (estimatePlanned) {
      plannedStories.forEach(story => {
        const estimatedCost = estimateStoryCost(story.estimate, avgTokens);
        simulatedCosts[story.id] = {
          projectedUsd: estimatedCost,
          costUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
      });
    }
    
    simulatedCosts._totals = {
      costUsd: simulatedSpent,
      inputTokens: Object.values(simulatedCosts).reduce((sum, c) => sum + (c.inputTokens || 0), 0),
      outputTokens: Object.values(simulatedCosts).reduce((sum, c) => sum + (c.outputTokens || 0), 0),
    };
    
    const simulatedStories = (currentData.stories || []).map(story => {
      if (story.status === 'Done') {
        const doneIdx = doneStories.findIndex(ds => ds.id === story.id);
        if (doneIdx >= 0 && doneIdx < simulatedDoneCount) {
          return { ...story };
        }
      }
      return { ...story };
    });
    
    const snapshot = {
      generatedAt: date.toISOString(),
      commit: null,
      data: {
        epics: currentData.epics || [],
        stories: simulatedStories,
        bugs: currentData.bugs || [],
        costs: simulatedCosts,
        coverage: currentData.coverage || { available: false },
        lessons: currentData.lessons || [],
        testCases: currentData.testCases || [],
      },
    };
    
    const filename = getSnapshotFilename(date);
    const filepath = path.join(historyDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf8');
    generated.push({ filename, filepath, date: date.toISOString() });
  }
  
  console.log(`[historical-sim] Generated ${generated.length} historical snapshots`);
  return { generated, skipped: false };
}

module.exports = {
  backfillHistory,
  calculateAvgTokensPerEstimate,
  estimateStoryCost,
};
