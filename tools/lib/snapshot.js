'use strict';

const fs = require('fs');
const path = require('path');

const SNAPSHOT_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.json$/;

function getSnapshotFilename() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}-${mi}-${s}Z.json`;
}

function ensureHistoryDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveSnapshot(data, options = {}) {
  const root = options.root || (typeof process !== 'undefined' ? process.cwd() : '.');
  const historyDir = options.historyDir || path.join(root, '.history');
  const commit = options.commit || null;

  ensureHistoryDir(historyDir);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    commit: commit,
    data: data,
  };

  const filename = getSnapshotFilename();
  const filepath = path.join(historyDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf8');

  return { filename, filepath, snapshot };
}

function loadSnapshots(options = {}) {
  const root = options.root || (typeof process !== 'undefined' ? process.cwd() : '.');
  const historyDir = options.historyDir || path.join(root, '.history');

  if (!fs.existsSync(historyDir)) {
    return [];
  }

  const files = fs.readdirSync(historyDir);
  const snapshots = [];

  for (const file of files) {
    if (!SNAPSHOT_REGEX.test(file)) {
      continue;
    }

    const filepath = path.join(historyDir, file);
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.generatedAt && parsed.data) {
        snapshots.push({
          filename: file,
          filepath: filepath,
          generatedAt: parsed.generatedAt,
          commit: parsed.commit,
          data: parsed.data,
        });
      }
    } catch {
      continue;
    }
  }

  snapshots.sort((a, b) => new Date(a.generatedAt) - new Date(b.generatedAt));

  return snapshots;
}

function extractTrends(snapshots) {
  if (snapshots.length < 2) {
    return null;
  }

  const dates = snapshots.map((s) => s.generatedAt);

  const doneCounts = snapshots.map((s) => {
    const stories = s.data.stories || [];
    return stories.filter((st) => st.status === 'Done').length;
  });

  const totalStories = snapshots.map((s) => (s.data.stories || []).length);

  const aiCosts = snapshots.map((s) => {
    const costs = s.data.costs || {};
    return Object.values(costs).reduce((sum, c) => sum + (c.costUsd || 0), 0);
  });

  const coverage = snapshots.map((s) => {
    const cov = s.data.coverage;
    if (!cov || cov.available === false) return null;
    const overall = cov.overall;
    if (overall === null || overall === undefined) return null;
    return overall;
  });

  const tshirtPoints = { XS: 0.5, S: 1, M: 3, L: 5, XL: 8 };
  const velocity = snapshots.map((s) => {
    const stories = s.data.stories || [];
    return stories
      .filter((st) => st.status === 'Done')
      .reduce((sum, st) => {
        const est = st.estimate;
        if (!est) return sum;
        const upper = est.toUpperCase();
        return sum + (tshirtPoints[upper] || 0);
      }, 0);
  });

  const openBugs = snapshots.map((s) => {
    const bugs = s.data.bugs || [];
    return bugs.filter((b) => b.status === 'Open' || b.status === 'In Progress').length;
  });

  const atRisk = snapshots.map((s) => {
    const stories = s.data.stories || [];
    return stories.filter((st) => st.atRisk === true).length;
  });

  const inputTokens = snapshots.map((s) => {
    const costs = s.data.costs || {};
    return Object.values(costs).reduce((sum, c) => sum + (c.inputTokens || 0), 0);
  });

  const outputTokens = snapshots.map((s) => {
    const costs = s.data.costs || {};
    return Object.values(costs).reduce((sum, c) => sum + (c.outputTokens || 0), 0);
  });

  return {
    dates,
    doneCounts,
    totalStories,
    aiCosts,
    coverage,
    velocity,
    openBugs,
    atRisk,
    inputTokens,
    outputTokens,
  };
}

module.exports = {
  getSnapshotFilename,
  saveSnapshot,
  loadSnapshots,
  extractTrends,
  SNAPSHOT_REGEX,
};
