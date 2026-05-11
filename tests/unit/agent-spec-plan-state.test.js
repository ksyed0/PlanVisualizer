'use strict';
const { initStory, deriveOverall, SPEC_STATES, PLAN_STATES } = require('../../tools/lib/agent-spec-plan-state');

describe('initStory', () => {
  test('returns specPhase + planPhase + phaseHistory with default values', () => {
    const s = initStory();
    expect(s.specPhase.state).toBe('pending');
    expect(s.specPhase.reviewIterations).toBe(0);
    expect(s.specPhase.reviewIterationCap).toBe(3);
    expect(s.specPhase.specPath).toBeNull();
    expect(s.specPhase.mockupPath).toBeNull();
    expect(s.specPhase.uiSurface).toBe(false);
    expect(s.specPhase.lastReviewVerdict).toBeNull();
    expect(s.specPhase.acApprovedAt).toBeNull();
    expect(s.specPhase.specApprovedAt).toBeNull();
    expect(s.planPhase.state).toBe('pending');
    expect(s.planPhase.author).toBeNull();
    expect(s.phaseHistory).toEqual([]);
  });

  test('accepts custom iteration caps', () => {
    const s = initStory({ specCap: 5, planCap: 2 });
    expect(s.specPhase.reviewIterationCap).toBe(5);
    expect(s.planPhase.reviewIterationCap).toBe(2);
  });
});

describe('SPEC_STATES enum', () => {
  test('lists all 7 spec states', () => {
    expect(SPEC_STATES).toEqual([
      'pending',
      'in_progress',
      'review',
      'awaiting_ac_approval',
      'awaiting_spec_approval',
      'approved',
      'escalated',
    ]);
  });
});

describe('PLAN_STATES enum', () => {
  test('lists all 7 plan states', () => {
    expect(PLAN_STATES).toEqual([
      'pending',
      'in_progress',
      'review',
      'spec_gap',
      'awaiting_plan_approval',
      'approved',
      'escalated',
    ]);
  });
});

describe('deriveOverall', () => {
  test('returns "ready_for_dispatch" when plan approved', () => {
    expect(deriveOverall('approved', 'approved')).toBe('ready_for_dispatch');
  });
  test('returns "plan" when plan in_progress', () => {
    expect(deriveOverall('approved', 'in_progress')).toBe('plan');
  });
  test('returns "plan" when plan in review', () => {
    expect(deriveOverall('approved', 'review')).toBe('plan');
  });
  test('returns "plan" when spec approved but plan pending', () => {
    expect(deriveOverall('approved', 'pending')).toBe('plan');
  });
  test('returns "spec" when spec in_progress', () => {
    expect(deriveOverall('in_progress', 'pending')).toBe('spec');
  });
  test('returns "spec" when spec awaiting AC approval', () => {
    expect(deriveOverall('awaiting_ac_approval', 'pending')).toBe('spec');
  });
  test('returns "pending" when both phases pending', () => {
    expect(deriveOverall('pending', 'pending')).toBe('pending');
  });
  test('returns "escalated" when either phase escalated', () => {
    expect(deriveOverall('escalated', 'pending')).toBe('escalated');
    expect(deriveOverall('approved', 'escalated')).toBe('escalated');
  });
});
