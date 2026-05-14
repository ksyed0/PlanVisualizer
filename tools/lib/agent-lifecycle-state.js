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

module.exports = {
  TASK_STATES,
  BLOCKED_ROUTING_RULES,
  ESCALATION_CAP,
  initTask,
  startTask,
};
