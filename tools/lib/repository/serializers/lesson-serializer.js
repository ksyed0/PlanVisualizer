'use strict';
const { ValidationError } = require('../errors');

const ID_RE = /^L-\d+$/;

function serialize(lesson) {
  if (!lesson || !ID_RE.test(lesson.id || ''))
    throw new ValidationError(`invalid lesson id: ${lesson && lesson.id}`, { code: 'INVALID_ID' });
  if (!lesson.title) throw new ValidationError('lesson.title required', { code: 'MISSING_FIELD' });
  // lesson.rule is optional — 15 production lessons (L-0044, L-0051..0074) lack
  // an explicit **Rule:** line and use only the heading + body prose. Skip the
  // Rule emission if missing. Round-trip audit flagged these on 2026-05-25.
  const lines = [];
  lines.push(`## ${lesson.id} — ${lesson.title}`);
  lines.push('');
  if (lesson.rule) lines.push(`**Rule:** ${lesson.rule}`);
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
