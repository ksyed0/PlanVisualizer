#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'agents.config.json');
const STATUS_PATH = path.join(ROOT, 'docs', 'sdlc-status.json');

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`[init-sdlc-status] ${configPath} not found.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function buildAgentStatus(role) {
  const base = { status: 'idle', currentTask: null, tasksCompleted: 0 };
  const lower = role.toLowerCase();
  if (lower.includes('reviewer')) { base.reviewsCompleted = 0; base.blockers = 0; }
  if (lower.includes('functional tester')) { base.testsPassed = 0; base.testsFailed = 0; }
  if (lower.includes('automation tester')) { base.coveragePercent = 0; }
  return base;
}

function buildStatus(configPath) {
  const config = loadConfig(configPath || CONFIG_PATH);

  const agents = {};
  for (const [name, cfg] of Object.entries(config.agents || {})) {
    agents[name] = buildAgentStatus(cfg.role);
  }

  const phases = (config.phases || []).map((p, i) => ({
    id: i + 1,
    name: p.name,
    agents: (p.agents || []).slice(),
    deliverables: (p.deliverables || []).slice(),
    status: 'pending',
    startedAt: null,
    completedAt: null,
  }));

  return {
    project: {
      name: config.project?.name || 'My Project',
      description: config.project?.description || 'Agentic AI SDLC',
      repoUrl: config.project?.repoUrl || '',
      startDate: config.project?.startDate || new Date().toISOString().split('T')[0],
    },
    currentPhase: 0,
    phases,
    agents,
    epics: {},
    stories: {},
    cycles: [],
    metrics: {
      storiesCompleted: 0,
      storiesTotal: 0,
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
    },
    log: [],
  };
}

function main() {
  const force = process.argv.includes('--force');
  const status = buildStatus(CONFIG_PATH);
  const content = JSON.stringify(status, null, 2) + '\n';
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });

  if (force) {
    fs.writeFileSync(STATUS_PATH, content, 'utf8');
    console.log('[init-sdlc-status] Generated docs/sdlc-status.json (forced).');
  } else {
    try {
      fs.writeFileSync(STATUS_PATH, content, { encoding: 'utf8', flag: 'wx' });
      const agentNames = Object.keys(JSON.parse(content).agents);
      console.log(`[init-sdlc-status] Generated docs/sdlc-status.json with ${agentNames.length} agents.`);
    } catch (err) {
      if (err.code === 'EEXIST') {
        console.log('[init-sdlc-status] docs/sdlc-status.json already exists. Use --force to overwrite.');
        return;
      }
      throw err;
    }
  }
}

if (require.main === module) { main(); }

module.exports = { buildStatus, loadConfig };
