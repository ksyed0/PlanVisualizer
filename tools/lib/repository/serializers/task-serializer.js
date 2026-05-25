'use strict';
const { ValidationError } = require('../errors');

const ID_RE = /^TASK-\d+$/;

function serialize(task) {
  if (!task || !ID_RE.test(task.id || ''))
    throw new ValidationError(`invalid task id: ${task && task.id}`, { code: 'INVALID_ID' });
  if (!task.title) throw new ValidationError('task.title required', { code: 'MISSING_FIELD' });
  const parts = [`${task.id}: ${task.title}`];
  if (task.story) parts.push(`(story: ${task.story})`);
  if (task.status) parts.push(`[${task.status}]`);
  return parts.join(' ');
}

module.exports = { serialize, ID_RE };
