'use strict';

const State = require('../../tools/lib/agent-task-review-state');

function dataWithTask(overrides = {}) {
  return {
    tasks: {
      'task-abc': {
        id: 'task-abc',
        story: 'US-0185',
        agent: 'Forge',
        state: 'done',
        summary: 'did it',
        headSha: 'abc1234',
        ...overrides,
      },
    },
  };
}

describe('TASK_REVIEW_STATES and NEXT_ACTION_TOKENS', () => {
  test('exports the 6 review states', () => {
    expect(State.TASK_REVIEW_STATES).toEqual([
      'pending',
      'spec_reviewing',
      'quality_reviewing',
      'forge_retry',
      'approved',
      'escalated',
    ]);
  });

  test('exports the 7 next-action tokens', () => {
    expect(State.NEXT_ACTION_TOKENS).toEqual({
      SKIP_REVIEW: 'SKIP_REVIEW',
      READY_FOR_SPEC: 'READY_FOR_SPEC',
      PROCEED_TO_QUALITY: 'PROCEED_TO_QUALITY',
      TASK_CLEARED: 'TASK_CLEARED',
      RETRY_FORGE: 'RETRY_FORGE',
      ESCALATE: 'ESCALATE',
      READY_FOR_QUALITY: 'READY_FOR_QUALITY',
    });
  });
});

describe('initTaskReview', () => {
  test('initializes taskReview with status spec_reviewing on normal SHA', () => {
    const data = dataWithTask();
    const token = State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('READY_FOR_SPEC');
    expect(tr.status).toBe('spec_reviewing');
    expect(tr.baseSha).toBe('0000000');
    expect(tr.headSha).toBe('abc1234');
    expect(tr.specVerdict).toBeNull();
    expect(tr.qualityVerdict).toBeNull();
    expect(tr.forgeRetries).toBe(0);
    expect(tr.lastRetryTriggeredBy).toBeNull();
    expect(typeof tr.startedAt).toBe('string');
    expect(tr.completedAt).toBeNull();
  });

  test('returns SKIP_REVIEW and marks approved when headSha === "none"', () => {
    const data = dataWithTask();
    const token = State.initTaskReview(data, 'task-abc', '0000000', 'none');
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('SKIP_REVIEW');
    expect(tr.status).toBe('approved');
    expect(typeof tr.completedAt).toBe('string');
  });

  test('throws when task does not exist', () => {
    const data = { tasks: {} };
    expect(() => State.initTaskReview(data, 'task-missing', 'abc', 'def')).toThrow(/not found/i);
  });

  test('throws when baseSha is missing or not a string', () => {
    const data = dataWithTask();
    expect(() => State.initTaskReview(data, 'task-abc', null, 'abc')).toThrow(/baseSha/);
    expect(() => State.initTaskReview(data, 'task-abc', '', 'abc')).toThrow(/baseSha/);
  });

  test('throws when headSha is missing', () => {
    const data = dataWithTask();
    expect(() => State.initTaskReview(data, 'task-abc', 'abc', null)).toThrow(/headSha/);
  });
});

describe('setSpecVerdict', () => {
  function startedData() {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    return data;
  }

  test('APPROVED → PROCEED_TO_QUALITY, status quality_reviewing', () => {
    const data = startedData();
    const token = State.setSpecVerdict(data, 'task-abc', 'APPROVED', null, 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('PROCEED_TO_QUALITY');
    expect(tr.status).toBe('quality_reviewing');
    expect(tr.specVerdict).toBe('APPROVED');
    expect(tr.specFindings).toBeNull();
  });

  test('REQUEST_CHANGES with retries<cap → RETRY_FORGE, status forge_retry', () => {
    const data = startedData();
    const token = State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'AC-x missing', 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('RETRY_FORGE');
    expect(tr.status).toBe('forge_retry');
    expect(tr.specVerdict).toBe('REQUEST_CHANGES');
    expect(tr.specFindings).toBe('AC-x missing');
  });

  test('REQUEST_CHANGES with retries === cap → ESCALATE, status escalated, completedAt set', () => {
    const data = startedData();
    data.tasks['task-abc'].taskReview.forgeRetries = 2;
    const token = State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'still missing', 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('ESCALATE');
    expect(tr.status).toBe('escalated');
    expect(typeof tr.completedAt).toBe('string');
  });

  test('throws when called outside spec_reviewing state', () => {
    const data = startedData();
    data.tasks['task-abc'].taskReview.status = 'quality_reviewing';
    expect(() => State.setSpecVerdict(data, 'task-abc', 'APPROVED', null, 2)).toThrow(/invalid state|spec_reviewing/i);
  });

  test('throws on unknown verdict value', () => {
    const data = startedData();
    expect(() => State.setSpecVerdict(data, 'task-abc', 'OOPS', null, 2)).toThrow(/verdict/i);
  });

  test('throws when REQUEST_CHANGES has no findings', () => {
    const data = startedData();
    expect(() => State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', null, 2)).toThrow(/findings/i);
    expect(() => State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', '', 2)).toThrow(/findings/i);
  });
});

describe('setQualityVerdict', () => {
  function readyForQuality() {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    State.setSpecVerdict(data, 'task-abc', 'APPROVED', null, 2);
    return data;
  }

  test('APPROVED → TASK_CLEARED, status approved, completedAt set', () => {
    const data = readyForQuality();
    const token = State.setQualityVerdict(data, 'task-abc', 'APPROVED', null, 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('TASK_CLEARED');
    expect(tr.status).toBe('approved');
    expect(tr.qualityVerdict).toBe('APPROVED');
    expect(typeof tr.completedAt).toBe('string');
  });

  test('REQUEST_CHANGES with retries<cap → RETRY_FORGE, status forge_retry', () => {
    const data = readyForQuality();
    const token = State.setQualityVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'magic number', 2);
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('RETRY_FORGE');
    expect(tr.status).toBe('forge_retry');
    expect(tr.qualityFindings).toBe('magic number');
  });

  test('REQUEST_CHANGES with retries === cap → ESCALATE', () => {
    const data = readyForQuality();
    data.tasks['task-abc'].taskReview.forgeRetries = 2;
    const token = State.setQualityVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'still bad', 2);
    expect(token).toBe('ESCALATE');
    expect(data.tasks['task-abc'].taskReview.status).toBe('escalated');
  });

  test('throws when called outside quality_reviewing state', () => {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    expect(() => State.setQualityVerdict(data, 'task-abc', 'APPROVED', null, 2)).toThrow(/quality_reviewing/i);
  });

  test('throws when REQUEST_CHANGES has no findings', () => {
    const data = readyForQuality();
    expect(() => State.setQualityVerdict(data, 'task-abc', 'REQUEST_CHANGES', null, 2)).toThrow(/findings/i);
  });
});

describe('forgeRetry', () => {
  function inForgeRetry(reason) {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    if (reason === 'spec') {
      State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'spec fail', 2);
    } else {
      State.setSpecVerdict(data, 'task-abc', 'APPROVED', null, 2);
      State.setQualityVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'quality fail', 2);
    }
    return data;
  }

  test('spec retry: resets both verdicts, status → spec_reviewing, returns READY_FOR_SPEC', () => {
    const data = inForgeRetry('spec');
    const token = State.forgeRetry(data, 'task-abc', 'spec', 'def5678');
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('READY_FOR_SPEC');
    expect(tr.status).toBe('spec_reviewing');
    expect(tr.specVerdict).toBeNull();
    expect(tr.specFindings).toBeNull();
    expect(tr.qualityVerdict).toBeNull();
    expect(tr.qualityFindings).toBeNull();
    expect(tr.forgeRetries).toBe(1);
    expect(tr.lastRetryTriggeredBy).toBe('spec');
    expect(tr.headSha).toBe('def5678');
  });

  test('quality retry: keeps spec verdict, status → quality_reviewing, returns READY_FOR_QUALITY', () => {
    const data = inForgeRetry('quality');
    const token = State.forgeRetry(data, 'task-abc', 'quality', 'def5678');
    const tr = data.tasks['task-abc'].taskReview;
    expect(token).toBe('READY_FOR_QUALITY');
    expect(tr.status).toBe('quality_reviewing');
    expect(tr.specVerdict).toBe('APPROVED');
    expect(tr.qualityVerdict).toBeNull();
    expect(tr.forgeRetries).toBe(1);
    expect(tr.lastRetryTriggeredBy).toBe('quality');
  });

  test('multiple spec retries increment forgeRetries', () => {
    const data = inForgeRetry('spec');
    State.forgeRetry(data, 'task-abc', 'spec', 'def5678');
    State.setSpecVerdict(data, 'task-abc', 'REQUEST_CHANGES', 'still bad', 2);
    State.forgeRetry(data, 'task-abc', 'spec', '789abcd');
    expect(data.tasks['task-abc'].taskReview.forgeRetries).toBe(2);
  });

  test('throws when called outside forge_retry state', () => {
    const data = dataWithTask();
    State.initTaskReview(data, 'task-abc', '0000000', 'abc1234');
    expect(() => State.forgeRetry(data, 'task-abc', 'spec', 'def5678')).toThrow(/forge_retry/i);
  });

  test('throws on invalid triggered-by value', () => {
    const data = inForgeRetry('spec');
    expect(() => State.forgeRetry(data, 'task-abc', 'oops', 'def5678')).toThrow(/triggered-by|spec|quality/i);
  });

  test('throws on missing newHeadSha', () => {
    const data = inForgeRetry('spec');
    expect(() => State.forgeRetry(data, 'task-abc', 'spec', '')).toThrow(/newHeadSha/i);
    expect(() => State.forgeRetry(data, 'task-abc', 'spec', null)).toThrow(/newHeadSha/i);
  });
});
