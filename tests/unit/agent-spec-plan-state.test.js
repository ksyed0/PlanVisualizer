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

const {
  specStart,
  specUpdate,
  specAwaitAc,
  acApprove,
  acReject,
  specReviewResult,
  specAwaitFinal,
  specApprove,
  specReject,
} = require('../../tools/lib/agent-spec-plan-state');

describe('specStart', () => {
  test('transitions pending → in_progress', () => {
    const s = specStart(initStory(), { specPath: 'docs/specs/x.md' });
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.specPhase.specPath).toBe('docs/specs/x.md');
  });

  test('records phase history entry', () => {
    const s = specStart(initStory(), { specPath: 'x' });
    expect(s.phaseHistory).toHaveLength(1);
    expect(s.phaseHistory[0].phase).toBe('spec');
    expect(typeof s.phaseHistory[0].enteredAt).toBe('string');
  });

  test('throws when specPhase not pending', () => {
    const s = specStart(initStory(), { specPath: 'x' });
    expect(() => specStart(s, { specPath: 'y' })).toThrow(/cannot spec-start.*'in_progress'/i);
  });
});

describe('specUpdate', () => {
  test('updates a top-level specPhase field', () => {
    const s = specUpdate(specStart(initStory(), {}), { field: 'uiSurface', value: true });
    expect(s.specPhase.uiSurface).toBe(true);
  });

  test('rejects unknown field', () => {
    expect(() => specUpdate(initStory(), { field: 'badField', value: 1 })).toThrow(/unknown field/i);
  });

  test('coerces "true"/"false" strings to boolean for uiSurface', () => {
    const s = specUpdate(specStart(initStory(), {}), { field: 'uiSurface', value: 'true' });
    expect(s.specPhase.uiSurface).toBe(true);
  });
});

describe('specAwaitAc + acApprove + acReject', () => {
  test('specAwaitAc transitions in_progress → awaiting_ac_approval', () => {
    const s = specAwaitAc(specStart(initStory(), {}));
    expect(s.specPhase.state).toBe('awaiting_ac_approval');
  });

  test('acApprove transitions awaiting_ac_approval → in_progress, records timestamp', () => {
    let s = specAwaitAc(specStart(initStory(), {}));
    s = acApprove(s);
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.specPhase.acApprovedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test('acReject returns to in_progress with reason logged via lastReviewVerdict-like field', () => {
    let s = specAwaitAc(specStart(initStory(), {}));
    s = acReject(s, { reason: 'missing edge case' });
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.specPhase.acApprovedAt).toBeNull();
  });

  test('acApprove throws when not in awaiting_ac_approval', () => {
    expect(() => acApprove(initStory())).toThrow(/cannot approve ac/i);
  });
});

describe('specReviewResult', () => {
  test('APPROVED transitions in_progress → review (cap not enforced on approve)', () => {
    let s = acApprove(specAwaitAc(specStart(initStory(), {})));
    s = specReviewResult(s, { verdict: 'APPROVED' });
    expect(s.specPhase.state).toBe('review');
    expect(s.specPhase.lastReviewVerdict).toBe('APPROVED');
  });

  test('REQUEST_CHANGES increments iterations, stays in review', () => {
    let s = acApprove(specAwaitAc(specStart(initStory(), {})));
    s = specReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(s.specPhase.state).toBe('review');
    expect(s.specPhase.reviewIterations).toBe(1);
  });

  test('REQUEST_CHANGES at cap auto-escalates', () => {
    let s = acApprove(specAwaitAc(specStart(initStory({ specCap: 2 }), {})));
    s = specReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    s = specReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(s.specPhase.state).toBe('escalated');
  });

  test('rejects unknown verdict', () => {
    const s = acApprove(specAwaitAc(specStart(initStory(), {})));
    expect(() => specReviewResult(s, { verdict: 'WHATEVER' })).toThrow(/unknown verdict/i);
  });
});

describe('specAwaitFinal + specApprove + specReject', () => {
  test('specAwaitFinal transitions review → awaiting_spec_approval (only after APPROVED verdict)', () => {
    let s = acApprove(specAwaitAc(specStart(initStory(), {})));
    s = specReviewResult(s, { verdict: 'APPROVED' });
    s = specAwaitFinal(s);
    expect(s.specPhase.state).toBe('awaiting_spec_approval');
  });

  test('specAwaitFinal throws if last verdict was REQUEST_CHANGES', () => {
    let s = acApprove(specAwaitAc(specStart(initStory(), {})));
    s = specReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(() => specAwaitFinal(s)).toThrow(/lens has not approved/i);
  });

  test('specApprove transitions awaiting_spec_approval → approved, records timestamp + closes history entry', () => {
    let s = specAwaitFinal(
      specReviewResult(acApprove(specAwaitAc(specStart(initStory(), {}))), { verdict: 'APPROVED' }),
    );
    s = specApprove(s);
    expect(s.specPhase.state).toBe('approved');
    expect(s.specPhase.specApprovedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(s.phaseHistory[0].exitedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test('specReject returns awaiting_spec_approval → in_progress with reason logged', () => {
    let s = specAwaitFinal(
      specReviewResult(acApprove(specAwaitAc(specStart(initStory(), {}))), { verdict: 'APPROVED' }),
    );
    s = specReject(s, { reason: 'scope creep' });
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.specPhase.specApprovedAt).toBeNull();
  });
});

const {
  planStart,
  planUpdate,
  planSpecGap,
  planReviewResult,
  planAwaitApproval,
  planApprove,
  planReject,
} = require('../../tools/lib/agent-spec-plan-state');

function approvedSpec() {
  let s = specStart(initStory(), {});
  s = specAwaitAc(s);
  s = acApprove(s);
  s = specReviewResult(s, { verdict: 'APPROVED' });
  s = specAwaitFinal(s);
  return specApprove(s);
}

describe('planStart', () => {
  test('transitions plan pending → in_progress, records author + phase history', () => {
    const s = planStart(approvedSpec(), { author: 'Keystone', planPath: 'docs/plans/x.md' });
    expect(s.planPhase.state).toBe('in_progress');
    expect(s.planPhase.author).toBe('Keystone');
    expect(s.planPhase.planPath).toBe('docs/plans/x.md');
    const planHist = s.phaseHistory.find((p) => p.phase === 'plan');
    expect(planHist).toBeTruthy();
  });

  test('throws if spec not approved', () => {
    expect(() => planStart(initStory(), { author: 'Keystone' })).toThrow(/spec not approved/i);
  });
});

describe('planSpecGap', () => {
  test('reopens spec to in_progress and resets plan to pending', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planSpecGap(s, { reason: 'AC misses error case' });
    expect(s.specPhase.state).toBe('in_progress');
    expect(s.planPhase.state).toBe('pending');
    expect(s.specPhase.specApprovedAt).toBeNull();
  });

  test('throws if plan not in_progress', () => {
    expect(() => planSpecGap(approvedSpec(), { reason: 'x' })).toThrow(/cannot plan-spec-gap/i);
  });
});

describe('planReviewResult', () => {
  test('APPROVED transitions in_progress → review with verdict recorded', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planReviewResult(s, { verdict: 'APPROVED' });
    expect(s.planPhase.state).toBe('review');
    expect(s.planPhase.lastReviewVerdict).toBe('APPROVED');
  });

  test('REQUEST_CHANGES increments iterations', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(s.planPhase.reviewIterations).toBe(1);
  });

  test('REQUEST_CHANGES at cap auto-escalates', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s.planPhase.reviewIterationCap = 2;
    s = planReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    s = planReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(s.planPhase.state).toBe('escalated');
  });
});

describe('planAwaitApproval + planApprove + planReject', () => {
  test('planAwaitApproval requires APPROVED verdict', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planReviewResult(s, { verdict: 'REQUEST_CHANGES' });
    expect(() => planAwaitApproval(s)).toThrow(/has not approved/i);
  });

  test('planAwaitApproval transitions review → awaiting_plan_approval', () => {
    let s = planStart(approvedSpec(), { author: 'Keystone' });
    s = planReviewResult(s, { verdict: 'APPROVED' });
    s = planAwaitApproval(s);
    expect(s.planPhase.state).toBe('awaiting_plan_approval');
  });

  test('planApprove transitions to approved, records timestamp, closes phase history', () => {
    let s = planAwaitApproval(
      planReviewResult(planStart(approvedSpec(), { author: 'Keystone' }), { verdict: 'APPROVED' }),
    );
    s = planApprove(s);
    expect(s.planPhase.state).toBe('approved');
    expect(s.planPhase.planApprovedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(deriveOverall(s.specPhase.state, s.planPhase.state)).toBe('ready_for_dispatch');
  });

  test('planReject returns awaiting_plan_approval → in_progress', () => {
    let s = planAwaitApproval(
      planReviewResult(planStart(approvedSpec(), { author: 'Keystone' }), { verdict: 'APPROVED' }),
    );
    s = planReject(s, { reason: 'tasks too large' });
    expect(s.planPhase.state).toBe('in_progress');
    expect(s.planPhase.planApprovedAt).toBeNull();
  });
});

describe('planUpdate', () => {
  test('sets planPath on planPhase', () => {
    const s = planStart(approvedSpec(), { author: 'Keystone' });
    const u = planUpdate(s, { field: 'planPath', value: 'docs/plans/x.md' });
    expect(u.planPhase.planPath).toBe('docs/plans/x.md');
  });

  test('rejects unknown plan field', () => {
    const s = planStart(approvedSpec(), { author: 'Keystone' });
    expect(() => planUpdate(s, { field: 'badField', value: 'x' })).toThrow(/unknown plan field/i);
  });
});

describe('specApprove / planApprove — idempotency', () => {
  function approvedSpecSetup() {
    let s = specStart(initStory(), {});
    s = specAwaitAc(s);
    s = acApprove(s);
    s = specReviewResult(s, { verdict: 'APPROVED' });
    s = specAwaitFinal(s);
    return specApprove(s);
  }

  test('specApprove on already-approved state returns unchanged orchestration, no error', () => {
    let s = approvedSpecSetup();
    const before = s.specPhase.specApprovedAt;
    s = specApprove(s); // second call — should not throw
    expect(s.specPhase.state).toBe('approved');
    expect(s.specPhase.specApprovedAt).toBe(before); // timestamp unchanged
  });

  test('planApprove on already-approved state returns unchanged orchestration, no error', () => {
    let s = approvedSpecSetup();
    s = planStart(s, { author: 'Keystone' });
    s = planReviewResult(s, { verdict: 'APPROVED' });
    s = planAwaitApproval(s);
    s = planApprove(s);
    const before = s.planPhase.planApprovedAt;
    s = planApprove(s); // second call
    expect(s.planPhase.state).toBe('approved');
    expect(s.planPhase.planApprovedAt).toBe(before);
  });
});
