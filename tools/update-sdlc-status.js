#!/usr/bin/env node
'use strict';

/**
 * update-sdlc-status.js — Event-driven updater for docs/sdlc-status.json
 *
 * Called by the Conductor at each DM_AGENT pipeline phase transition to keep
 * the agentic dashboard (docs/dashboard.html) in sync with real execution state.
 *
 * Uses atomicReadModifyWriteJson for safe concurrent updates.
 *
 * Usage patterns (all commands mutate sdlc-status.json and append a log entry):
 *
 *   # Start a story — mark the primary agent active + currentTask
 *   node tools/update-sdlc-status.js agent-start \
 *     --agent Pixel --story US-0096 \
 *     --task "Implement zebra striping"
 *
 *   # Finish an agent's turn — flip to idle, increment tasksCompleted
 *   node tools/update-sdlc-status.js agent-done \
 *     --agent Pixel --story US-0096
 *
 *   # Record a review verdict
 *   node tools/update-sdlc-status.js review \
 *     --agent Lens --story US-0096 --verdict approve
 *   # verdicts: approve | request-changes | block
 *
 *   # Record test results
 *   node tools/update-sdlc-status.js test-pass \
 *     --agent Sentinel --story US-0096 --count 1
 *
 *   # Record coverage
 *   node tools/update-sdlc-status.js coverage \
 *     --agent Circuit --percent 90.82
 *
 *   # Mark a story complete (increments metrics + updates stories[id])
 *   node tools/update-sdlc-status.js story-complete \
 *     --story US-0096 --epic EPIC-0015
 *
 *   # Mark a story in-progress
 *   node tools/update-sdlc-status.js story-start \
 *     --story US-0096 --epic EPIC-0015
 *
 *   # Set the current phase (1-6)
 *   node tools/update-sdlc-status.js phase \
 *     --number 3 --status in-progress
 *
 *   # Generic log entry (no state patch beyond the log)
 *   node tools/update-sdlc-status.js log \
 *     --agent Conductor --message "Spawned Sentinel + Circuit in parallel"
 */

const path = require('path');
const fs = require('fs');
const { atomicReadModifyWriteJson, atomicWriteJson } = require('../orchestrator/atomic-write');

const STATUS_PATH = path.join(__dirname, '..', 'docs', 'sdlc-status.json');

function parseArgs(argv) {
  const cmd = argv[2];
  const opts = {};
  for (let i = 3; i < argv.length; i += 2) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!key || !key.startsWith('--')) continue;
    opts[key.slice(2)] = val;
  }
  return { cmd, opts };
}

function nowISO() {
  return new Date().toISOString();
}

function appendLog(data, agent, message) {
  data.log = data.log || [];
  data.log.push({ time: nowISO(), agent: agent || 'Conductor', message });
  // Keep log bounded at last 200 entries
  if (data.log.length > 200) data.log = data.log.slice(-200);
  return data;
}

function ensureAgent(data, name) {
  if (!data.agents) data.agents = {};
  if (!data.agents[name]) {
    data.agents[name] = { status: 'idle', currentTask: null, tasksCompleted: 0 };
  }
  return data.agents[name];
}

function ensureStory(data, id) {
  if (!data.stories) data.stories = {};
  if (!data.stories[id]) {
    data.stories[id] = { status: 'ToDo', epic: null, assignedAgent: null, startedAt: null, completedAt: null };
  }
  return data.stories[id];
}

function requireAgent(opts) {
  if (!opts.agent || opts.agent === 'undefined') {
    throw new Error('[update-sdlc-status] --agent is required');
  }
}

function resetSession(data, storiesTotal) {
  const total = parseInt(storiesTotal || '0', 10);
  if (Number.isNaN(total) || total < 0) {
    throw new Error(`[update-sdlc-status] --stories must be a non-negative integer, got: ${storiesTotal}`);
  }
  data.stories = {};
  data.currentPhase = 0;
  if (Array.isArray(data.phases)) {
    data.phases = data.phases.map(p => ({
      ...p,
      status: 'pending',
      startedAt: null,
      completedAt: null,
    }));
  }
  data.metrics = {
    storiesCompleted: 0,
    storiesTotal: total,
    tasksCompleted: 0,
    tasksTotal: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsTotal: 0,
    bugsOpen: 0,
    bugsFixed: 0,
    coveragePercent: 0,
    reviewsApproved: 0,
    reviewsBlocked: 0,
  };
  return data;
}

const HANDLERS = {
  'agent-start': (data, opts) => {
    requireAgent(opts);
    const agent = ensureAgent(data, opts.agent);
    agent.status = 'active';
    agent.currentTask = opts.task || `Working on ${opts.story || 'task'}`;
    if (opts.story) {
      const story = ensureStory(data, opts.story);
      story.assignedAgent = opts.agent;
      if (story.status === 'ToDo' || !story.startedAt) {
        story.status = 'InProgress';
        story.startedAt = nowISO();
      }
    }
    appendLog(data, opts.agent, `started ${opts.story ? opts.story + ': ' : ''}${opts.task || 'task'}`);
    return data;
  },

  'agent-done': (data, opts) => {
    requireAgent(opts);
    const agent = ensureAgent(data, opts.agent);
    agent.status = 'idle';
    agent.currentTask = null;
    agent.tasksCompleted = (agent.tasksCompleted || 0) + 1;
    data.metrics = data.metrics || {};
    data.metrics.tasksCompleted = (data.metrics.tasksCompleted || 0) + 1;
    appendLog(data, opts.agent, `finished ${opts.story || 'task'}`);
    return data;
  },

  review: (data, opts) => {
    const agent = ensureAgent(data, opts.agent || 'Lens');
    agent.reviewsCompleted = (agent.reviewsCompleted || 0) + 1;
    data.metrics = data.metrics || {};
    const verdict = (opts.verdict || 'approve').toLowerCase();
    if (verdict === 'approve') {
      data.metrics.reviewsApproved = (data.metrics.reviewsApproved || 0) + 1;
    } else if (verdict === 'block') {
      data.metrics.reviewsBlocked = (data.metrics.reviewsBlocked || 0) + 1;
      agent.blockers = (agent.blockers || 0) + 1;
      if (opts.story) {
        const story = ensureStory(data, opts.story);
        story.status = 'Blocked';
      }
    }
    appendLog(data, opts.agent || 'Lens', `${verdict} review of ${opts.story || 'branch'}`);
    return data;
  },

  'test-pass': (data, opts) => {
    const agent = ensureAgent(data, opts.agent || 'Sentinel');
    const n = parseInt(opts.count || '1', 10);
    agent.testsPassed = (agent.testsPassed || 0) + n;
    data.metrics = data.metrics || {};
    data.metrics.testsPassed = (data.metrics.testsPassed || 0) + n;
    data.metrics.testsTotal = (data.metrics.testsTotal || 0) + n;
    appendLog(data, opts.agent || 'Sentinel', `${n} tests passed on ${opts.story || 'branch'}`);
    return data;
  },

  'test-fail': (data, opts) => {
    const agent = ensureAgent(data, opts.agent || 'Sentinel');
    const n = parseInt(opts.count || '1', 10);
    agent.testsFailed = (agent.testsFailed || 0) + n;
    data.metrics = data.metrics || {};
    data.metrics.testsFailed = (data.metrics.testsFailed || 0) + n;
    data.metrics.testsTotal = (data.metrics.testsTotal || 0) + n;
    appendLog(data, opts.agent || 'Sentinel', `${n} tests FAILED on ${opts.story || 'branch'}`);
    return data;
  },

  coverage: (data, opts) => {
    const agent = ensureAgent(data, opts.agent || 'Circuit');
    const pct = parseFloat(opts.percent || '0');
    agent.coveragePercent = pct;
    data.metrics = data.metrics || {};
    data.metrics.coveragePercent = pct;
    appendLog(data, opts.agent || 'Circuit', `coverage at ${pct.toFixed(2)}%`);
    return data;
  },

  'story-start': (data, opts) => {
    const story = ensureStory(data, opts.story);
    story.status = 'InProgress';
    story.epic = opts.epic || story.epic;
    story.startedAt = nowISO();
    data.metrics = data.metrics || {};
    appendLog(data, 'Conductor', `started ${opts.story}${opts.epic ? ' (' + opts.epic + ')' : ''}`);
    return data;
  },

  'story-complete': (data, opts) => {
    const story = ensureStory(data, opts.story);
    story.status = 'Complete';
    story.epic = opts.epic || story.epic;
    story.completedAt = nowISO();
    const agentName = story.assignedAgent;
    if (agentName && data.agents && data.agents[agentName]) {
      data.agents[agentName].status = 'idle';
      data.agents[agentName].currentTask = null;
    }
    data.metrics = data.metrics || {};
    data.metrics.storiesCompleted = (data.metrics.storiesCompleted || 0) + 1;
    data.metrics.storiesTotal = Math.max(data.metrics.storiesTotal || 0, Object.keys(data.stories).length);
    const epicId = opts.epic || story.epic;
    if (epicId && data.epics && data.epics[epicId]) {
      data.epics[epicId].storiesCompleted = (data.epics[epicId].storiesCompleted || 0) + 1;
    }
    appendLog(data, 'Conductor', `completed ${opts.story}${opts.epic ? ' (' + opts.epic + ')' : ''}`);
    return data;
  },

  'epic-start': (data, opts) => {
    if (!opts.epic) throw new Error('[update-sdlc-status] epic-start requires --epic');
    data.epics = data.epics || {};
    data.epics[opts.epic] = {
      name: opts.name || opts.epic,
      status: 'in-progress',
      startedAt: nowISO(),
      completedAt: null,
      storiesCompleted: 0,
      storiesTotal: parseInt(opts.stories || '0', 10),
    };
    appendLog(data, 'Conductor', `Epic ${opts.epic} (${opts.name || opts.epic}) started`);
    return data;
  },

  'epic-complete': (data, opts) => {
    if (!opts.epic) throw new Error('[update-sdlc-status] epic-complete requires --epic');
    data.epics = data.epics || {};
    if (data.epics[opts.epic]) {
      data.epics[opts.epic].status = 'complete';
      data.epics[opts.epic].completedAt = nowISO();
    }
    appendLog(data, 'Conductor', `Epic ${opts.epic} complete`);
    return data;
  },

  'bug-open': (data, opts) => {
    data.metrics = data.metrics || {};
    data.metrics.bugsOpen = (data.metrics.bugsOpen || 0) + 1;
    appendLog(data, opts.agent || 'Conductor', `bug opened on ${opts.story || 'unknown story'}`);
    return data;
  },

  'bug-fix': (data, opts) => {
    data.metrics = data.metrics || {};
    data.metrics.bugsOpen = Math.max(0, (data.metrics.bugsOpen || 0) - 1);
    data.metrics.bugsFixed = (data.metrics.bugsFixed || 0) + 1;
    appendLog(data, opts.agent || 'Conductor', `bug fixed on ${opts.story || 'unknown story'}`);
    return data;
  },

  'cycle-complete': (data, opts) => {
    data.cycles = data.cycles || [];
    const nextId = data.cycles.length + 1;

    const phaseDurations = {};
    (data.phases || []).forEach(function(p) {
      if (p.startedAt && p.completedAt) {
        const ms = Date.parse(p.completedAt) - Date.parse(p.startedAt);
        if (isFinite(ms) && ms >= 0) {
          phaseDurations[p.name] = Math.round(ms / 1000);
        }
      }
    });

    const snapshot = {
      id: nextId,
      completedAt: nowISO(),
      storiesCompleted: (data.metrics && data.metrics.storiesCompleted) || 0,
      testsPassed: (data.metrics && data.metrics.testsPassed) || 0,
      coveragePercent: (data.metrics && data.metrics.coveragePercent) || 0,
      bugsFixed: (data.metrics && data.metrics.bugsFixed) || 0,
      phaseDurations,
    };
    data.cycles.push(snapshot);

    if (data.cycles.length > 50) data.cycles = data.cycles.slice(-50);

    resetSession(data, '0');
    appendLog(data, 'Conductor', `Cycle ${nextId} complete — ${snapshot.storiesCompleted} stories, ${snapshot.coveragePercent.toFixed(1)}% coverage`);
    return data;
  },

  'session-start': (data, opts) => {
    resetSession(data, opts.stories);
    appendLog(data, 'Conductor', `Session started — ${opts.stories || 0} stories planned`);
    return data;
  },

  phase: (data, opts) => {
    const n = parseInt(opts.number, 10);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`[update-sdlc-status] phase --number must be a positive integer, got: ${opts.number}`);
    }
    const status = opts.status || 'in-progress';
    data.currentPhase = n;
    data.phases = data.phases || [];
    // Auto-expand if phases weren't seeded by init-sdlc-status.js
    while (data.phases.length < n) {
      const i = data.phases.length;
      data.phases.push({
        id: i + 1,
        name: `Phase ${i + 1}`,
        agents: [],
        deliverables: [],
        status: 'pending',
        startedAt: null,
        completedAt: null,
      });
    }
    const phase = data.phases[n - 1];
    phase.status = status;
    if (status === 'in-progress' && !phase.startedAt) phase.startedAt = nowISO();
    if (status === 'complete' && !phase.completedAt) phase.completedAt = nowISO();
    appendLog(data, 'Conductor', `Phase ${n} (${phase.name}) → ${status}`);
    return data;
  },

  log: (data, opts) => {
    appendLog(data, opts.agent || 'Conductor', opts.message || '(no message)');
    return data;
  },
};

async function main() {
  const { cmd, opts } = parseArgs(process.argv);

  if (!cmd || cmd === '--help' || cmd === '-h') {
    const help = fs.readFileSync(__filename, 'utf8').match(/\/\*\*[\s\S]*?\*\//)[0];
    console.log(help);
    process.exit(cmd ? 0 : 1);
  }

  const handler = HANDLERS[cmd];
  if (!handler) {
    console.error(`Unknown command: ${cmd}`);
    console.error(`Available: ${Object.keys(HANDLERS).join(', ')}`);
    process.exit(1);
  }

  if (!fs.existsSync(STATUS_PATH)) {
    console.error(`${STATUS_PATH} not found. Run tools/init-sdlc-status.js first.`);
    process.exit(1);
  }

  try {
    await atomicReadModifyWriteJson(STATUS_PATH, (data) => handler(data, opts));
    console.log(`[update-sdlc-status] ${cmd} ${JSON.stringify(opts)}`);
  } catch (err) {
    console.error(`[update-sdlc-status] failed:`, err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { HANDLERS, parseArgs, resetSession };
