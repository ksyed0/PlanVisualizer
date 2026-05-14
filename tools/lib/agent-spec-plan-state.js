'use strict';

// State enums
const SPEC_STATES = [
  'pending',
  'in_progress',
  'review',
  'awaiting_ac_approval',
  'awaiting_spec_approval',
  'approved',
  'escalated',
];

const PLAN_STATES = ['pending', 'in_progress', 'review', 'spec_gap', 'awaiting_plan_approval', 'approved', 'escalated'];

/**
 * Initialize a fresh orchestration record for a story.
 * @param {{ specCap?: number, planCap?: number }} opts
 */
function initStory(opts = {}) {
  return {
    specPhase: {
      state: 'pending',
      specPath: null,
      mockupPath: null,
      uiSurface: false,
      reviewIterations: 0,
      reviewIterationCap: opts.specCap || 3,
      lastReviewVerdict: null,
      acApprovedAt: null,
      specApprovedAt: null,
    },
    planPhase: {
      state: 'pending',
      planPath: null,
      author: null,
      reviewIterations: 0,
      reviewIterationCap: opts.planCap || 3,
      lastReviewVerdict: null,
      planApprovedAt: null,
    },
    phaseHistory: [],
  };
}

/**
 * Derive the overall orchestration state from spec + plan phase states.
 * Never stored — always computed.
 */
function deriveOverall(specState, planState) {
  if (specState === 'escalated' || planState === 'escalated') return 'escalated';
  if (planState === 'approved') return 'ready_for_dispatch';
  if (planState && planState !== 'pending') return 'plan';
  if (specState === 'approved') return 'plan';
  if (specState && specState !== 'pending') return 'spec';
  return 'pending';
}

const VALID_SPEC_UPDATE_FIELDS = ['specPath', 'mockupPath', 'uiSurface'];
const VALID_PLAN_UPDATE_FIELDS = ['planPath'];

function nowISO() {
  return new Date().toISOString();
}

function _enterPhase(orchestration, phase) {
  return {
    ...orchestration,
    phaseHistory: [...orchestration.phaseHistory, { phase, enteredAt: nowISO(), exitedAt: null }],
  };
}

function _exitPhase(orchestration, phase) {
  const last = orchestration.phaseHistory.findIndex((p) => p.phase === phase && !p.exitedAt);
  if (last === -1) return orchestration;
  const newHistory = [...orchestration.phaseHistory];
  newHistory[last] = { ...newHistory[last], exitedAt: nowISO() };
  return { ...orchestration, phaseHistory: newHistory };
}

/** spec-start: pending → in_progress */
function specStart(orchestration, opts = {}) {
  if (orchestration.specPhase.state !== 'pending') {
    throw new Error(`Cannot spec-start: specPhase is '${orchestration.specPhase.state}', expected 'pending'`);
  }
  const o = _enterPhase(orchestration, 'spec');
  return {
    ...o,
    specPhase: {
      ...o.specPhase,
      state: 'in_progress',
      specPath: opts.specPath || null,
      uiSurface: opts.uiSurface || false,
    },
  };
}

/** spec-update: update a top-level specPhase field */
function specUpdate(orchestration, opts) {
  if (!VALID_SPEC_UPDATE_FIELDS.includes(opts.field)) {
    throw new Error(`Unknown field '${opts.field}'; valid: ${VALID_SPEC_UPDATE_FIELDS.join(', ')}`);
  }
  let value = opts.value;
  if (opts.field === 'uiSurface') {
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else value = !!value;
  }
  return {
    ...orchestration,
    specPhase: { ...orchestration.specPhase, [opts.field]: value },
  };
}

/** plan-update: update a planPhase field */
function planUpdate(orchestration, opts) {
  if (!VALID_PLAN_UPDATE_FIELDS.includes(opts.field)) {
    throw new Error(`Unknown plan field '${opts.field}'; valid: ${VALID_PLAN_UPDATE_FIELDS.join(', ')}`);
  }
  return {
    ...orchestration,
    planPhase: { ...orchestration.planPhase, [opts.field]: opts.value },
  };
}

/** spec-await-ac: in_progress → awaiting_ac_approval */
function specAwaitAc(orchestration) {
  if (orchestration.specPhase.state !== 'in_progress') {
    throw new Error(`Cannot spec-await-ac: specPhase is '${orchestration.specPhase.state}', expected 'in_progress'`);
  }
  return {
    ...orchestration,
    specPhase: { ...orchestration.specPhase, state: 'awaiting_ac_approval' },
  };
}

/** approve --gate ac */
function acApprove(orchestration) {
  if (orchestration.specPhase.state !== 'awaiting_ac_approval') {
    throw new Error(
      `Cannot approve AC: specPhase is '${orchestration.specPhase.state}', expected 'awaiting_ac_approval'`,
    );
  }
  return {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'in_progress',
      acApprovedAt: nowISO(),
    },
  };
}

/** reject --gate ac */
function acReject(orchestration, opts) {
  if (orchestration.specPhase.state !== 'awaiting_ac_approval') {
    throw new Error(
      `Cannot reject AC: specPhase is '${orchestration.specPhase.state}', expected 'awaiting_ac_approval'`,
    );
  }
  return {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'in_progress',
      acApprovedAt: null,
      _lastRejectReason: opts.reason || 'no reason given',
    },
  };
}

/** spec-review-result --verdict APPROVED|REQUEST_CHANGES */
function specReviewResult(orchestration, opts) {
  if (opts.verdict !== 'APPROVED' && opts.verdict !== 'REQUEST_CHANGES') {
    throw new Error(`Unknown verdict '${opts.verdict}'; expected APPROVED or REQUEST_CHANGES`);
  }
  let next = {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'review',
      lastReviewVerdict: opts.verdict,
    },
  };
  if (opts.verdict === 'REQUEST_CHANGES') {
    const newIter = next.specPhase.reviewIterations + 1;
    next = {
      ...next,
      specPhase: { ...next.specPhase, reviewIterations: newIter },
    };
    if (newIter >= next.specPhase.reviewIterationCap) {
      next = { ...next, specPhase: { ...next.specPhase, state: 'escalated' } };
    }
  }
  return next;
}

/** spec-await-final: review → awaiting_spec_approval (only after APPROVED) */
function specAwaitFinal(orchestration) {
  if (orchestration.specPhase.state !== 'review') {
    throw new Error(`Cannot spec-await-final: specPhase is '${orchestration.specPhase.state}', expected 'review'`);
  }
  if (orchestration.specPhase.lastReviewVerdict !== 'APPROVED') {
    throw new Error('Cannot spec-await-final: Lens has not approved the spec');
  }
  return {
    ...orchestration,
    specPhase: { ...orchestration.specPhase, state: 'awaiting_spec_approval' },
  };
}

/** approve --gate spec */
function specApprove(orchestration) {
  // Idempotent: if already approved, return unchanged
  if (orchestration.specPhase.state === 'approved') return orchestration;
  if (orchestration.specPhase.state !== 'awaiting_spec_approval') {
    throw new Error(
      `Cannot approve spec: specPhase is '${orchestration.specPhase.state}', expected 'awaiting_spec_approval'`,
    );
  }
  const o = _exitPhase(orchestration, 'spec');
  return {
    ...o,
    specPhase: {
      ...o.specPhase,
      state: 'approved',
      specApprovedAt: nowISO(),
    },
  };
}

/** reject --gate spec */
function specReject(orchestration, opts) {
  if (orchestration.specPhase.state !== 'awaiting_spec_approval') {
    throw new Error(
      `Cannot reject spec: specPhase is '${orchestration.specPhase.state}', expected 'awaiting_spec_approval'`,
    );
  }
  return {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'in_progress',
      specApprovedAt: null,
      _lastRejectReason: opts.reason || 'no reason given',
    },
  };
}

/** plan-start: requires spec approved; planPhase pending → in_progress */
function planStart(orchestration, opts = {}) {
  if (orchestration.specPhase.state !== 'approved') {
    throw new Error(`Cannot plan-start: spec not approved (specPhase='${orchestration.specPhase.state}')`);
  }
  if (orchestration.planPhase.state !== 'pending') {
    throw new Error(`Cannot plan-start: planPhase is '${orchestration.planPhase.state}', expected 'pending'`);
  }
  const o = _enterPhase(orchestration, 'plan');
  return {
    ...o,
    planPhase: {
      ...o.planPhase,
      state: 'in_progress',
      author: opts.author || null,
      planPath: opts.planPath || null,
    },
  };
}

/** plan-spec-gap: plan in_progress → spec reopens, plan resets */
function planSpecGap(orchestration, opts) {
  if (orchestration.planPhase.state !== 'in_progress') {
    throw new Error(`Cannot plan-spec-gap: planPhase is '${orchestration.planPhase.state}', expected 'in_progress'`);
  }
  return {
    ...orchestration,
    specPhase: {
      ...orchestration.specPhase,
      state: 'in_progress',
      specApprovedAt: null,
      _lastSpecGapReason: opts.reason || 'no reason given',
    },
    planPhase: {
      ...orchestration.planPhase,
      state: 'pending',
      planPath: null,
    },
  };
}

/** plan-review-result --verdict APPROVED|REQUEST_CHANGES */
function planReviewResult(orchestration, opts) {
  if (opts.verdict !== 'APPROVED' && opts.verdict !== 'REQUEST_CHANGES') {
    throw new Error(`Unknown verdict '${opts.verdict}'; expected APPROVED or REQUEST_CHANGES`);
  }
  let next = {
    ...orchestration,
    planPhase: {
      ...orchestration.planPhase,
      state: 'review',
      lastReviewVerdict: opts.verdict,
    },
  };
  if (opts.verdict === 'REQUEST_CHANGES') {
    const newIter = next.planPhase.reviewIterations + 1;
    next = {
      ...next,
      planPhase: { ...next.planPhase, reviewIterations: newIter },
    };
    if (newIter >= next.planPhase.reviewIterationCap) {
      next = { ...next, planPhase: { ...next.planPhase, state: 'escalated' } };
    }
  }
  return next;
}

/** plan-await-approval: review → awaiting_plan_approval (only after APPROVED) */
function planAwaitApproval(orchestration) {
  if (orchestration.planPhase.state !== 'review') {
    throw new Error(`Cannot plan-await-approval: planPhase is '${orchestration.planPhase.state}', expected 'review'`);
  }
  if (orchestration.planPhase.lastReviewVerdict !== 'APPROVED') {
    throw new Error('Cannot plan-await-approval: Lens has not approved the plan');
  }
  return {
    ...orchestration,
    planPhase: { ...orchestration.planPhase, state: 'awaiting_plan_approval' },
  };
}

/** approve --gate plan */
function planApprove(orchestration) {
  // Idempotent: if already approved, return unchanged
  if (orchestration.planPhase.state === 'approved') return orchestration;
  if (orchestration.planPhase.state !== 'awaiting_plan_approval') {
    throw new Error(
      `Cannot approve plan: planPhase is '${orchestration.planPhase.state}', expected 'awaiting_plan_approval'`,
    );
  }
  const o = _exitPhase(orchestration, 'plan');
  return {
    ...o,
    planPhase: {
      ...o.planPhase,
      state: 'approved',
      planApprovedAt: nowISO(),
    },
  };
}

/** reject --gate plan */
function planReject(orchestration, opts) {
  if (orchestration.planPhase.state !== 'awaiting_plan_approval') {
    throw new Error(
      `Cannot reject plan: planPhase is '${orchestration.planPhase.state}', expected 'awaiting_plan_approval'`,
    );
  }
  return {
    ...orchestration,
    planPhase: {
      ...orchestration.planPhase,
      state: 'in_progress',
      planApprovedAt: null,
      _lastRejectReason: opts.reason || 'no reason given',
    },
  };
}

module.exports = {
  SPEC_STATES,
  PLAN_STATES,
  VALID_PLAN_UPDATE_FIELDS,
  initStory,
  deriveOverall,
  specStart,
  specUpdate,
  specAwaitAc,
  acApprove,
  acReject,
  specReviewResult,
  specAwaitFinal,
  specApprove,
  specReject,
  planStart,
  planUpdate,
  planSpecGap,
  planReviewResult,
  planAwaitApproval,
  planApprove,
  planReject,
};
