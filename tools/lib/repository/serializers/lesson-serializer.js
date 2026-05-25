'use strict';
const { ValidationError } = require('../errors');

const ID_RE = /^L-\d+$/;

function serialize(lesson) {
  if (!lesson || !ID_RE.test(lesson.id || ''))
    throw new ValidationError(`invalid lesson id: ${lesson && lesson.id}`, { code: 'INVALID_ID' });
  if (!lesson.title) throw new ValidationError('lesson.title required', { code: 'MISSING_FIELD' });
  if (!lesson.rule) throw new ValidationError('lesson.rule required', { code: 'MISSING_FIELD' });
  const lines = [];
  lines.push(`## ${lesson.id} — ${lesson.title}`);
  lines.push('');
  lines.push(`**Rule:** ${lesson.rule}`);
  if (lesson.context) {
    lines.push('');
    lines.push(`*${lesson.context}*`);
  }
  if (lesson.date) {
    lines.push('');
    lines.push(`**Date:** ${lesson.date}`);
  }
  if (Array.isArray(lesson.bugIds) && lesson.bugIds.length > 0) {
    lines.push(`**Bugs:** ${lesson.bugIds.join(', ')}`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { serialize, ID_RE };
