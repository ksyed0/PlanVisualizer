#!/usr/bin/env node
'use strict';

/**
 * init-sdlc-status.js — Generate sdlc-status.json from agents.config.json
 *
 * Creates or resets the SDLC status file with agent entries derived from config.
 * Safe to re-run — only creates if missing or if --force is passed.
 *
 * Usage:
 *   node tools/init-sdlc-status.js            # Create if missing
 *   node tools/init-sdlc-status.js --force     # Overwrite existing
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'agents.config.json');
const STATUS_PATH = path.join(ROOT, 'docs', 'sdlc-status.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('[init-sdlc-status] agents.config.json not found.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function buildAgentStatus(agentName, role) {
  const base = { status: 'idle', currentTask: null, tasksCompleted: 0 };
  const lower = role.toLowerCase();
  if (lower.includes('reviewer')) {
    base.reviewsCompleted = 0;
    base.blockers = 0;
  }
  if (lower.includes('functional tester')) {
    base.testsPassed = 0;
    base.testsFailed = 0;
  }
  if (lower.includes('automation tester')) {
    base.coveragePercent = 0;
  }
  return base;
}

function main() {
  const force = process.argv.includes('--force');

  if (fs.existsSync(STATUS_PATH) && !force) {
    console.log('[init-sdlc-status] docs/sdlc-status.json already exists. Use --force to overwrite.');
    return;
  }

  const config = loadConfig();
  const agentNames = Object.keys(config.agents || {});

  // Build agent status entries
  const agents = {};
  for (const [name, cfg] of Object.entries(config.agents || {})) {
    agents[name] = buildAgentStatus(name, cfg.role);
  }

  // Build skeleton status
  const status = {
    hackathon: {
      name: 'SDLC Dashboard',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
    },
    currentPhase: 0,
    phases: [],
    agents,
    epics: {},
    stories: {},
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

  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2) + '\n', 'utf8');
  console.log(`[init-sdlc-status] Generated docs/sdlc-status.json with ${agentNames.length} agents.`);
}

main();
