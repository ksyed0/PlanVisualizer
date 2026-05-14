'use strict';

const crypto = require('crypto');

const TASK_STATES = ['in_progress', 'done', 'done_with_concerns', 'needs_context', 'blocked', 'escalated'];

// BLOCKED reason → resolution hint mapping (first match wins)
const BLOCKED_ROUTING_RULES = [
  { patterns: ['missing', 'not found', 'undefined', 'no such', 'cannot find'], suggestion: 'MORE_CONTEXT' },
  { patterns: ['ambiguous', 'unclear', 'which', 'conflicting', 'contradiction'], suggestion: 'MORE_CONTEXT' },
  { patterns: ['complex', 'too many', 'large', 'too big', 'scope'], suggestion: 'SPLIT_TASK' },
  { patterns: ['permission', 'access', 'auth', 'credentials'], suggestion: 'ESCALATE_HUMAN' },
];

const ESCALATION_CAP = 2;

function nowISO() {
  return new Date().toISOString();
}

function initTask(opts) {
  return {
    id: 'task-' + crypto.randomUUID(),
    story: opts.story || null,
    agent: opts.agent || null,
    model: opts.model || 'sonnet',
    description: opts.description || '',
    state: 'in_progress',
    concerns: null,
    blockedReason: null,
    blockedResolutions: [],
    startedAt: nowISO(),
    completedAt: null,
    retryCount: 0,
  };
}

function startTask(data, task) {
  if (!data.tasks) data.tasks = {};
  data.tasks[task.id] = task;
}

function _requireTask(data, taskId) {
  if (!data.tasks || !data.tasks[taskId]) {
    throw new Error(`Task '${taskId}' not found in sdlc-status.json`);
  }
  return data.tasks[taskId];
}

function _requireInProgress(task, operation) {
  if (task.state !== 'in_progress') {
    throw new Error(`Cannot mark ${operation}: task '${task.id}' is in state '${task.state}', expected 'in_progress'`);
  }
}

function markDone(data, taskId) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'done');
  t.state = 'done';
  t.completedAt = nowISO();
}

function markConcerns(data, taskId, note) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'concerns');
  t.state = 'done_with_concerns';
  t.concerns = note || '';
  t.completedAt = nowISO();
}

function markNeedsContext(data, taskId, missing) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'needs-context');
  t.state = 'needs_context';
  t.blockedReason = missing || '';
}

function routeBlockedReason(reason) {
  const r = (reason || '').toLowerCase();
  for (const rule of BLOCKED_ROUTING_RULES) {
    if (rule.patterns.some((p) => r.includes(p))) return rule.suggestion;
  }
  return 'UPGRADE_MODEL';
}

function markBlocked(data, taskId, reason) {
  const t = _requireTask(data, taskId);
  _requireInProgress(t, 'blocked');
  t.state = 'blocked';
  t.blockedReason = reason || '';
  return routeBlockedReason(reason);
}

function resolveBlocked(data, taskId, opts) {
  const t = _requireTask(data, taskId);
  if (t.state !== 'blocked') {
    throw new Error(`Cannot resolve blocked: task '${taskId}' is in state '${t.state}', expected 'blocked'`);
  }
  // Check if cap already exhausted
  if (t.blockedResolutions.length >= ESCALATION_CAP) {
    t.state = 'escalated';
    throw new Error(`Task '${taskId}' has reached escalation cap (${ESCALATION_CAP} resolutions). Forced escalated.`);
  }
  t.blockedResolutions.push({
    attempt: t.blockedResolutions.length + 1,
    action: opts.action || 'UPGRADE_MODEL',
    note: opts.note || '',
    resolvedAt: nowISO(),
  });
  t.retryCount += 1;
  t.state = 'in_progress';
  t.blockedReason = null;
}

module.exports = {
  TASK_STATES,
  BLOCKED_ROUTING_RULES,
  ESCALATION_CAP,
  initTask,
  startTask,
  markDone,
  markConcerns,
  markNeedsContext,
  markBlocked,
  resolveBlocked,
  routeBlockedReason,
};
