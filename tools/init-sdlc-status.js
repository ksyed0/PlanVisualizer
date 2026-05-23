#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'agents.config.json');
// eslint-disable-next-line no-unused-vars -- kept for out-of-tree consumers (US-0260)
const STATUS_PATH = path.join(ROOT, 'docs', 'sdlc-status.json');

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`[init-sdlc-status] ${configPath} not found.`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function buildAgentStatus(role) {
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

function buildAgentsMap(config) {
  const agents = {};
  for (const [name, cfg] of Object.entries(config.agents || {})) {
    agents[name] = buildAgentStatus(cfg.role);
  }
  return agents;
}

function buildPhasesArray(config) {
  return (config.phases || []).map((p, i) => ({
    id: i + 1,
    name: p.name,
    agents: (p.agents || []).slice(),
    deliverables: (p.deliverables || []).slice(),
    status: 'pending',
    startedAt: null,
    completedAt: null,
  }));
}

function buildProjectObject(config) {
  return {
    name: config.project?.name || 'My Project',
    description: config.project?.description || 'Agentic AI SDLC',
    repoUrl: config.project?.repoUrl || '',
    startDate: config.project?.startDate || new Date().toISOString().split('T')[0],
  };
}

// US-0260 / AC-1018: idempotent merge. Without --force, an existing
// programme row is preserved. With --force, every row is overwritten.
async function seedProgrammeRow(repo, key, value, { force }) {
  if (!force) {
    const existing = repo.sdlcProgramme.get(key);
    if (existing !== null && existing !== undefined) return { key, action: 'preserved' };
  }
  await repo.sdlcProgramme.set(key, value);
  return { key, action: 'seeded' };
}

async function main({ root = ROOT, configPath = CONFIG_PATH, force = false } = {}) {
  const config = loadConfig(configPath);
  const { Repository } = require('./lib/repository');
  Repository._reset();
  const repo = Repository.getInstance({ root });
  try {
    const results = [];
    results.push(await seedProgrammeRow(repo, 'agents', buildAgentsMap(config), { force }));
    results.push(await seedProgrammeRow(repo, 'phases', buildPhasesArray(config), { force }));
    results.push(await seedProgrammeRow(repo, 'project', buildProjectObject(config), { force }));
    const seeded = results.filter((r) => r.action === 'seeded').map((r) => r.key);
    const preserved = results.filter((r) => r.action === 'preserved').map((r) => r.key);
    if (seeded.length > 0) {
      console.log(`[init-sdlc-status] Seeded programme rows: ${seeded.join(', ')}.`);
    }
    if (preserved.length > 0) {
      console.log(`[init-sdlc-status] Preserved existing programme rows: ${preserved.join(', ')}.`);
    }
    return { seeded, preserved };
  } finally {
    Repository._reset();
  }
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  main({ force }).then(
    () => process.exit(0),
    (err) => {
      console.error(err.message);
      process.exit(1);
    },
  );
}

module.exports = {
  // Legacy: exposed for any out-of-tree consumer; new code should use main().
  loadConfig,
  buildAgentsMap,
  buildPhasesArray,
  buildProjectObject,
  main,
};
