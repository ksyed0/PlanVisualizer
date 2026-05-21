'use strict';
const TIER = Object.freeze({ ERROR: 'error', WARNING: 'warning', REPORT: 'report' });

const RULES = {
  'duplicate-id': TIER.ERROR,
  'invalid-status': TIER.ERROR,
  'malformed-block': TIER.ERROR,
  'orphan-ac': TIER.WARNING,
  'dangling-dependency': TIER.WARNING,
  'check-rejected': TIER.WARNING,
  'duplicate-ac': TIER.WARNING,
  'id-registry-drift': TIER.WARNING,
  'ac-gap': TIER.REPORT,
  'done-without-pr': TIER.REPORT,
  'stale-in-progress': TIER.REPORT,
};

function classify(violation) {
  return RULES[violation.code] || TIER.REPORT;
}

class ValidationError extends Error {
  constructor(violations) {
    super(`Validation failed: ${violations.map((v) => v.code).join(', ')}`);
    this.violations = violations;
  }
}

module.exports = { TIER, RULES, classify, ValidationError };
