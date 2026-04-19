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

module.exports = { computeStoryRisk, PRIORITY_WEIGHTS, SEVERITY_WEIGHTS, STATUS_WEIGHTS, LEVEL_COLORS, scoreToLevel };
