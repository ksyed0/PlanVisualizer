'use strict';

const TASK_REVIEW_STATES = ['pending', 'spec_reviewing', 'quality_reviewing', 'forge_retry', 'approved', 'escalated'];

const NEXT_ACTION_TOKENS = {
  SKIP_REVIEW: 'SKIP_REVIEW',
  READY_FOR_SPEC: 'READY_FOR_SPEC',
  PROCEED_TO_QUALITY: 'PROCEED_TO_QUALITY',
  TASK_CLEARED: 'TASK_CLEARED',
  RETRY_FORGE: 'RETRY_FORGE',
  ESCALATE: 'ESCALATE',
  READY_FOR_QUALITY: 'READY_FOR_QUALITY',
};

function nowISO() {
  return new Date().toISOString();
}

function _requireTask(data, taskId) {
  if (!data.tasks || !data.tasks[taskId]) {
    throw new Error(`Task '${taskId}' not found in sdlc-status.json`);
  }
  return data.tasks[taskId];
}

function initTaskReview(data, taskId, baseSha, headSha) {
  const t = _requireTask(data, taskId);
  if (typeof baseSha !== 'string' || baseSha.length === 0) {
    throw new Error('initTaskReview: baseSha must be a non-empty string');
  }
  if (typeof headSha !== 'string' || headSha.length === 0) {
    throw new Error('initTaskReview: headSha must be a non-empty string');
  }
  const now = nowISO();
  if (headSha === 'none') {
    t.taskReview = {
      status: 'approved',
      baseSha,
      headSha,
      specVerdict: null,
      specFindings: null,
      qualityVerdict: null,
      qualityFindings: null,
      forgeRetries: 0,
      lastRetryTriggeredBy: null,
      startedAt: now,
      completedAt: now,
    };
    return NEXT_ACTION_TOKENS.SKIP_REVIEW;
  }
  t.taskReview = {
    status: 'spec_reviewing',
    baseSha,
    headSha,
    specVerdict: null,
    specFindings: null,
    qualityVerdict: null,
    qualityFindings: null,
    forgeRetries: 0,
    lastRetryTriggeredBy: null,
    startedAt: now,
    completedAt: null,
  };
  return NEXT_ACTION_TOKENS.READY_FOR_SPEC;
}

const VALID_VERDICTS = ['APPROVED', 'REQUEST_CHANGES'];

function setSpecVerdict(data, taskId, verdict, findings, cap) {
  const t = _requireTask(data, taskId);
  if (!t.taskReview || t.taskReview.status !== 'spec_reviewing') {
    throw new Error(
      `setSpecVerdict: task '${taskId}' is in invalid state for spec verdict; expected status='spec_reviewing'`,
    );
  }
  if (!VALID_VERDICTS.includes(verdict)) {
    throw new Error(`setSpecVerdict: verdict must be APPROVED or REQUEST_CHANGES (got '${verdict}')`);
  }
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 1) {
    throw new Error('setSpecVerdict: cap must be a positive integer');
  }
  if (verdict === 'REQUEST_CHANGES' && (typeof findings !== 'string' || findings.trim().length === 0)) {
    throw new Error('setSpecVerdict: REQUEST_CHANGES requires non-empty findings');
  }
  t.taskReview.specVerdict = verdict;
  t.taskReview.specFindings = verdict === 'REQUEST_CHANGES' ? findings : null;
  if (verdict === 'APPROVED') {
    t.taskReview.status = 'quality_reviewing';
    return NEXT_ACTION_TOKENS.PROCEED_TO_QUALITY;
  }
  if (t.taskReview.forgeRetries >= cap) {
    t.taskReview.status = 'escalated';
    t.taskReview.completedAt = nowISO();
    return NEXT_ACTION_TOKENS.ESCALATE;
  }
  t.taskReview.status = 'forge_retry';
  return NEXT_ACTION_TOKENS.RETRY_FORGE;
}

function setQualityVerdict(data, taskId, verdict, findings, cap) {
  const t = _requireTask(data, taskId);
  if (!t.taskReview || t.taskReview.status !== 'quality_reviewing') {
    throw new Error(
      `setQualityVerdict: task '${taskId}' is in invalid state for quality verdict; expected status='quality_reviewing'`,
    );
  }
  if (!VALID_VERDICTS.includes(verdict)) {
    throw new Error(`setQualityVerdict: verdict must be APPROVED or REQUEST_CHANGES (got '${verdict}')`);
  }
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 1) {
    throw new Error('setQualityVerdict: cap must be a positive integer');
  }
  if (verdict === 'REQUEST_CHANGES' && (typeof findings !== 'string' || findings.trim().length === 0)) {
    throw new Error('setQualityVerdict: REQUEST_CHANGES requires non-empty findings');
  }
  t.taskReview.qualityVerdict = verdict;
  t.taskReview.qualityFindings = verdict === 'REQUEST_CHANGES' ? findings : null;
  if (verdict === 'APPROVED') {
    t.taskReview.status = 'approved';
    t.taskReview.completedAt = nowISO();
    return NEXT_ACTION_TOKENS.TASK_CLEARED;
  }
  if (t.taskReview.forgeRetries >= cap) {
    t.taskReview.status = 'escalated';
    t.taskReview.completedAt = nowISO();
    return NEXT_ACTION_TOKENS.ESCALATE;
  }
  t.taskReview.status = 'forge_retry';
  return NEXT_ACTION_TOKENS.RETRY_FORGE;
}

const VALID_TRIGGERED_BY = ['spec', 'quality'];

function forgeRetry(data, taskId, triggeredBy, newHeadSha) {
  const t = _requireTask(data, taskId);
  if (!t.taskReview || t.taskReview.status !== 'forge_retry') {
    throw new Error(`forgeRetry: task '${taskId}' is in invalid state for retry; expected status='forge_retry'`);
  }
  if (!VALID_TRIGGERED_BY.includes(triggeredBy)) {
    throw new Error(`forgeRetry: triggered-by must be 'spec' or 'quality' (got '${triggeredBy}')`);
  }
  if (typeof newHeadSha !== 'string' || newHeadSha.length === 0) {
    throw new Error('forgeRetry: newHeadSha must be a non-empty string');
  }
  t.taskReview.forgeRetries += 1;
  t.taskReview.lastRetryTriggeredBy = triggeredBy;
  t.taskReview.headSha = newHeadSha;
  if (triggeredBy === 'spec') {
    t.taskReview.specVerdict = null;
    t.taskReview.specFindings = null;
    t.taskReview.qualityVerdict = null;
    t.taskReview.qualityFindings = null;
    t.taskReview.status = 'spec_reviewing';
    return NEXT_ACTION_TOKENS.READY_FOR_SPEC;
  }
  t.taskReview.qualityVerdict = null;
  t.taskReview.qualityFindings = null;
  t.taskReview.status = 'quality_reviewing';
  return NEXT_ACTION_TOKENS.READY_FOR_QUALITY;
}

module.exports = {
  TASK_REVIEW_STATES,
  NEXT_ACTION_TOKENS,
  initTaskReview,
  setSpecVerdict,
  setQualityVerdict,
  forgeRetry,
};
