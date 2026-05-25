'use strict';
const { ValidationError } = require('../errors');
const { joinLines } = require('./_fence-utils');

const ID_RE = /^BUG-\d+$/;
const ALLOWED_STATUS = new Set(['Open', 'In Progress', 'Fixed', 'Verified', 'WontFix', 'Closed']);

function serialize(bug) {
  if (!bug || !ID_RE.test(bug.id || ''))
    throw new ValidationError(`invalid bug id: ${bug && bug.id}`, { code: 'INVALID_ID' });
  if (!bug.title) throw new ValidationError('bug.title required', { code: 'MISSING_FIELD' });
  if (!ALLOWED_STATUS.has(bug.status))
    throw new ValidationError(`invalid bug.status: ${bug.status}`, { code: 'INVALID_STATUS' });
  const lines = [];
  lines.push(`${bug.id}: ${bug.title}`);
  if (bug.severity) lines.push(`Severity: ${bug.severity}`);
  if (bug.relatedStory) lines.push(`Related Story: ${bug.relatedStory}`);
  if (bug.relatedTask) lines.push(`Related Task: ${bug.relatedTask}`);
  lines.push(`Status: ${bug.status}`);
  if (bug.fixBranch) lines.push(`Fix Branch: ${bug.fixBranch}`);
  if (bug.lessonEncoded) lines.push(`Lesson Encoded: ${bug.lessonEncoded}`);
  if (bug.estimatedCostUsd !== null && bug.estimatedCostUsd !== 0)
    lines.push(`Estimated Cost USD: ${bug.estimatedCostUsd}`);
  if (bug.ghIssueNumber !== null) lines.push(`GH Issue: #${bug.ghIssueNumber}`);
  return joinLines(lines);
}

module.exports = { serialize, ID_RE, ALLOWED_STATUS };
