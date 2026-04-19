'use strict';

// Composite delivery-risk scoring for stories.
// score = (priorityWeight × 0.4) + (maxOpenBugSeverityWeight × 0.3) + (statusWeight × 0.3)
// Weights range 0–4; score range 0–4; level: Low <1, Medium 1–2, High 2–3, Critical ≥3.

const PRIORITY_WEIGHTS = { P1: 4, P2: 3, P3: 2, P4: 1 };
const SEVERITY_WEIGHTS = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const STATUS_WEIGHTS = { Blocked: 4, 'In-Progress': 2, 'In Progress': 2, Planned: 1, Done: 0, Retired: 0 };
const LEVEL_COLORS = { Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#22c55e' };

function scoreToLevel(score) {
  if (score >= 3) return 'Critical';
  if (score >= 2) return 'High';
  if (score >= 1) return 'Medium';
  return 'Low';
}

function computeStoryRisk(story, linkedBugs = []) {
  const pw = PRIORITY_WEIGHTS[story.priority] ?? 2;
  const openBugs = linkedBugs.filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status));
  const sw = openBugs.reduce((max, b) => Math.max(max, SEVERITY_WEIGHTS[b.severity] ?? 0), 0);
  const stw = STATUS_WEIGHTS[story.status] ?? 1;
  const score = Math.round((pw * 0.4 + sw * 0.3 + stw * 0.3) * 10) / 10;
  return { score, level: scoreToLevel(score) };
}

function _normalizeRef(raw) {
  if (!raw) return null;
  const m = String(raw).match(/US-\d{4}/);
  return m ? m[0] : null;
}

function computeAllRisk(stories, bugs) {
  const bugsByStory = new Map();
  for (const bug of bugs) {
    const id = _normalizeRef(bug.relatedStory);
    if (!id) continue;
    if (!bugsByStory.has(id)) bugsByStory.set(id, []);
    bugsByStory.get(id).push(bug);
  }

  const byStory = new Map();
  const epicAccum = new Map();

  for (const story of stories) {
    const result = computeStoryRisk(story, bugsByStory.get(story.id) || []);
    byStory.set(story.id, result);

    const eid = story.epicId || '_ungrouped';
    if (!epicAccum.has(eid)) epicAccum.set(eid, { scores: [], counts: { Low: 0, Medium: 0, High: 0, Critical: 0 } });

    if (story.status === 'Done' || story.status === 'Retired') continue;
    const acc = epicAccum.get(eid);
    acc.scores.push(result.score);
    acc.counts[result.level]++;
  }

  const byEpic = new Map();
  for (const [eid, { scores, counts }] of epicAccum) {
    const avg = scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : 0;
    byEpic.set(eid, {
      avgScore: avg,
      maxScore: scores.length ? Math.max(...scores) : 0,
      level: scoreToLevel(avg),
      counts,
    });
  }

  return { byStory, byEpic };
}

module.exports = {
  computeStoryRisk,
  computeAllRisk,
  scoreToLevel,
  PRIORITY_WEIGHTS,
  SEVERITY_WEIGHTS,
  STATUS_WEIGHTS,
  LEVEL_COLORS,
};
