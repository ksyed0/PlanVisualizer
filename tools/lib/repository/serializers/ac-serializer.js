'use strict';

const { ValidationError } = require('../errors');

const ID_RE = /^(AC-\d+|AC-TBD)$/;

function serialize(ac) {
  if (!ac || !ID_RE.test(ac.id || '')) {
    throw new ValidationError(`invalid ac id: ${ac && ac.id}`, { code: 'INVALID_ID' });
  }
  if (!ac.text) {
    throw new ValidationError('ac.text required', { code: 'MISSING_FIELD' });
  }
  const check = ac.checked ? 'x' : ' ';
  return `- [${check}] ${ac.id}: ${ac.text}`;
}

module.exports = { serialize, ID_RE };
