'use strict';

const { ValidationError } = require('../errors');
const { joinLines } = require('./_fence-utils');

// Must match the SQLite CHECK constraint in migration 003_widen_status_check.sql.
const ALLOWED_STATUS = new Set(['To Do', 'Planned', 'In Progress', 'Blocked', 'Done', 'Retired']);
const ID_RE = /^US-\d+$/;

function serialize(story) {
  if (!story || typeof story !== 'object') {
    throw new ValidationError('story must be an object', { code: 'NOT_OBJECT' });
  }
  if (!ID_RE.test(story.id || '')) {
    throw new ValidationError(`invalid story id: ${story.id}`, { code: 'INVALID_ID', details: { id: story.id } });
  }
  if (!story.title) {
    throw new ValidationError('story.title is required', { code: 'MISSING_FIELD', details: { field: 'title' } });
  }
  if (!ALLOWED_STATUS.has(story.status)) {
    throw new ValidationError(`invalid story.status: ${story.status}`, {
      code: 'INVALID_STATUS',
      details: { got: story.status, expected: [...ALLOWED_STATUS] },
    });
  }
  if (!story.priority) {
    throw new ValidationError('story.priority is required', { code: 'MISSING_FIELD', details: { field: 'priority' } });
  }
  if (!story.estimate) {
    throw new ValidationError('story.estimate is required', { code: 'MISSING_FIELD', details: { field: 'estimate' } });
  }

  const lines = [];
  const epicSuffix = story.epicId ? ` (${story.epicId})` : '';
  lines.push(`${story.id}${epicSuffix}: ${story.title}`);
  lines.push(`Priority: ${story.priority}`);
  lines.push(`Estimate: ${story.estimate}`);
  lines.push(`Status: ${story.status}`);
  if (story.branch) lines.push(`Branch: ${story.branch}`);
  if (story.prNumber !== null && story.prNumber !== undefined) lines.push(`PR: #${story.prNumber}`);
  if (story.specPath) lines.push(`Spec: ${story.specPath}`);
  if (story.planPath) lines.push(`Plan: ${story.planPath}`);
  if (story.planTask) lines.push(`Plan Task: ${story.planTask}`);
  if (story.relatedBug) lines.push(`Related Bug: ${story.relatedBug}`);
  if (story.doneDate) lines.push(`DoneDate: ${story.doneDate}`);
  if (Array.isArray(story.dependencies) && story.dependencies.length > 0) {
    lines.push(`Dependencies: ${story.dependencies.join(', ')}`);
  }
  if (Array.isArray(story.acs) && story.acs.length > 0) {
    // No blank line before the AC list — parseReleasePlan segments on \n{2,}
    // and would split the AC items into a separate chunk from the story header,
    // dropping them on re-parse (round-trip audit revealed this on 2026-05-25).
    lines.push('Acceptance Criteria:');
    for (const ac of story.acs) {
      const check = ac.done ? 'x' : ' ';
      lines.push(`- [${check}] ${ac.id}: ${ac.text}`);
    }
  }
  return joinLines(lines);
}

module.exports = { serialize, ALLOWED_STATUS, ID_RE };
