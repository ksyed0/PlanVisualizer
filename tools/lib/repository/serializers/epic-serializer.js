'use strict';

const { ValidationError } = require('../errors');
const { joinLines } = require('./_fence-utils');

const ID_RE = /^EPIC-\d+$/;
const ALLOWED_STATUS = new Set(['To Do', 'Planned', 'In Progress', 'Blocked', 'Done', 'Retired']);

function serialize(epic) {
  if (!epic || !ID_RE.test(epic.id || '')) {
    throw new ValidationError(`invalid epic id: ${epic && epic.id}`, { code: 'INVALID_ID' });
  }
  if (!epic.title) {
    throw new ValidationError('epic.title required', { code: 'MISSING_FIELD' });
  }
  if (!ALLOWED_STATUS.has(epic.status)) {
    throw new ValidationError(`invalid epic.status: ${epic.status}`, { code: 'INVALID_STATUS' });
  }
  const lines = [];
  lines.push(`${epic.id}: ${epic.title}`);
  if (epic.description) lines.push(`Description: ${epic.description}`);
  if (epic.releaseTarget) lines.push(`Release Target: ${epic.releaseTarget}`);
  lines.push(`Status: ${epic.status}`);
  if (epic.startDate) lines.push(`StartDate: ${epic.startDate}`);
  if (epic.doneDate) lines.push(`DoneDate: ${epic.doneDate}`);
  if (Array.isArray(epic.dependencies) && epic.dependencies.length > 0) {
    lines.push(`Dependencies: ${epic.dependencies.join(', ')}`);
  } else if (epic.dependencies !== undefined) {
    lines.push('Dependencies: None');
  }
  return joinLines(lines);
}

module.exports = { serialize, ID_RE, ALLOWED_STATUS };
