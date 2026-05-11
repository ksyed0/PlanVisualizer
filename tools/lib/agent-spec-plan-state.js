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

module.exports = {
  SPEC_STATES,
  PLAN_STATES,
  initStory,
  deriveOverall,
};
