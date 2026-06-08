'use strict';
const { ValidationError } = require('../errors');
const { joinLines } = require('./_fence-utils');

const ID_RE = /^TC-\d+$/;
const ALLOWED_STATUS = new Set(['Pass', 'Fail', 'Not Run']);

function serialize(tc) {
  if (!tc || !ID_RE.test(tc.id || ''))
    throw new ValidationError(`invalid tc id: ${tc && tc.id}`, { code: 'INVALID_ID' });
  if (!tc.title) throw new ValidationError('tc.title required', { code: 'MISSING_FIELD' });
  if (!ALLOWED_STATUS.has(tc.status))
    throw new ValidationError(`invalid tc.status: ${tc.status}`, { code: 'INVALID_STATUS' });
  const lines = [];
  lines.push(`${tc.id}: ${tc.title}`);
  if (tc.relatedStory) lines.push(`Related Story: ${tc.relatedStory}`);
  if (tc.relatedTask) lines.push(`Related Task: ${tc.relatedTask}`);
  if (tc.relatedAC) lines.push(`Related AC: ${tc.relatedAC}`);
  if (tc.type) lines.push(`Type: ${tc.type}`);
  const statusRaw = tc.status === 'Not Run' ? '[ ] Not Run' : `[x] ${tc.status}`;
  lines.push(`Status: ${statusRaw}`);
  if (tc.defect && tc.defect !== 'None') lines.push(`Defect Raised: ${tc.defect}`);
  return joinLines(lines);
}

module.exports = { serialize, ID_RE, ALLOWED_STATUS };
