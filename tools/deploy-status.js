#!/usr/bin/env node
'use strict';

/**
 * deploy-status.js — Event-driven updater for docs/deploy-status.json
 *
 * Called by the Deploy agent at each deployment phase transition to record
 * environment state, CI run results, and incidents.
 *
 * Uses atomicReadModifyWriteJson for safe concurrent updates.
 *
 * Usage:
 *   node tools/deploy-status.js init
 *   node tools/deploy-status.js deploy-start --env staging --sha abc123 --story US-0264
 *   node tools/deploy-status.js deploy-complete --env staging --sha abc123 --story US-0264
 *   node tools/deploy-status.js deploy-fail --env staging --reason "health check failed"
 *   node tools/deploy-status.js rollback --env production --to-sha good456 --reason "down"
 *   node tools/deploy-status.js promote --from staging --to production --sha abc123
 *   node tools/deploy-status.js health-check --env production --status ok
 *   node tools/deploy-status.js ci-status --workflow plan-visualizer.yml --status passed
 *   node tools/deploy-status.js incident --env production --type code --severity high \
 *     --description "Null pointer" --resolution "Dispatch Forge"
 */

const path = require('path');
const fs = require('fs');

const DEPLOY_STATUS_PATH = path.join(__dirname, '..', 'docs', 'deploy-status.json');

const BLANK_STATUS = {
  environments: {
    dev: { sha: null, status: 'idle', lastDeployAt: null, lastDeployStory: null },
    staging: { sha: null, status: 'idle', lastDeployAt: null, lastDeployStory: null },
    production: { sha: null, status: 'idle', lastDeployAt: null, lastDeployStory: null },
  },
  activeDeployment: null,
  ciRuns: [],
  incidents: [],
  promotionHistory: [],
};

function parseArgs(argv) {
  const cmd = argv[2];
  const opts = {};
  for (let i = 3; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      opts[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return { cmd, opts };
}

const HANDLERS = {
  init(_data, _opts) {
    return JSON.parse(JSON.stringify(BLANK_STATUS));
  },

  'deploy-start'(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.sha) throw new Error('[deploy-status] --sha required');
    if (!opts.story) throw new Error('[deploy-status] --story required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    env.status = 'deploying';
    data.activeDeployment = {
      from: opts.from || null,
      to: opts.env,
      sha: opts.sha,
      story: opts.story,
      startedAt: new Date().toISOString(),
    };
    return data;
  },

  'deploy-complete'(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.sha) throw new Error('[deploy-status] --sha required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    env.status = 'healthy';
    env.sha = opts.sha;
    env.lastDeployAt = new Date().toISOString();
    if (opts.story) env.lastDeployStory = opts.story;
    if (data.activeDeployment && data.activeDeployment.to === opts.env) {
      data.activeDeployment = null;
    }
    return data;
  },

  'deploy-fail'(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.reason) throw new Error('[deploy-status] --reason required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    env.status = 'degraded';
    if (data.activeDeployment && data.activeDeployment.to === opts.env) {
      data.activeDeployment = null;
    }
    return data;
  },

  rollback(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts['to-sha']) throw new Error('[deploy-status] --to-sha required');
    if (!opts.reason) throw new Error('[deploy-status] --reason required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    env.status = 'rolled-back';
    env.sha = opts['to-sha'];
    env.lastDeployAt = new Date().toISOString();
    if (data.activeDeployment && data.activeDeployment.to === opts.env) {
      data.activeDeployment = null;
    }
    data.promotionHistory.push({
      from: opts.env,
      to: opts.env,
      sha: opts['to-sha'],
      story: opts.story || null,
      promotedAt: new Date().toISOString(),
      rollback: true,
      reason: opts.reason,
    });
    data.promotionHistory = data.promotionHistory.slice(-100);
    return data;
  },

  promote(data, opts) {
    if (!opts.from) throw new Error('[deploy-status] --from required');
    if (!opts.to) throw new Error('[deploy-status] --to required');
    if (!opts.sha) throw new Error('[deploy-status] --sha required');
    data.promotionHistory.push({
      from: opts.from,
      to: opts.to,
      sha: opts.sha,
      story: opts.story || null,
      promotedAt: new Date().toISOString(),
    });
    data.promotionHistory = data.promotionHistory.slice(-100);
    return data;
  },

  'health-check'(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.status) throw new Error('[deploy-status] --status required');
    const env = data.environments[opts.env];
    if (!env) throw new Error(`[deploy-status] unknown env: ${opts.env}`);
    const map = { ok: 'healthy', warn: 'degraded', fail: 'down' };
    env.status = map[opts.status] || opts.status;
    return data;
  },

  'ci-status'(data, opts) {
    if (!opts.workflow) throw new Error('[deploy-status] --workflow required');
    if (!opts.status) throw new Error('[deploy-status] --status required');
    data.ciRuns.push({
      workflow: opts.workflow,
      status: opts.status,
      runId: opts['run-id'] || null,
      recordedAt: new Date().toISOString(),
    });
    data.ciRuns = data.ciRuns.slice(-20);
    return data;
  },

  incident(data, opts) {
    if (!opts.env) throw new Error('[deploy-status] --env required');
    if (!opts.type) throw new Error('[deploy-status] --type required');
    if (!opts.severity) throw new Error('[deploy-status] --severity required');
    if (!opts.description) throw new Error('[deploy-status] --description required');
    if (!opts.resolution) throw new Error('[deploy-status] --resolution required');
    data.incidents.push({
      id: data.incidents.length + 1,
      env: opts.env,
      type: opts.type,
      severity: opts.severity,
      description: opts.description,
      suggestedResolution: opts.resolution,
      suggestedOwner: opts.owner || null,
      autoRemediationAttempted: opts['auto-remediation'] === 'true',
      resolvedAt: null,
      openedAt: new Date().toISOString(),
    });
    data.incidents = data.incidents.slice(-50);
    return data;
  },
};

function main() {
  const { cmd, opts } = parseArgs(process.argv);

  if (!cmd) {
    console.error('[deploy-status] command required');
    process.exit(1);
  }

  // init is special — may create the file from scratch
  if (cmd === 'init') {
    if (opts['no-overwrite'] && fs.existsSync(DEPLOY_STATUS_PATH)) {
      console.log('[deploy-status] deploy-status.json already exists, skipping (--no-overwrite)');
      process.exit(0);
    }
    const blank = HANDLERS.init({}, opts);
    fs.writeFileSync(DEPLOY_STATUS_PATH, JSON.stringify(blank, null, 2));
    console.log('[deploy-status] init complete →', DEPLOY_STATUS_PATH);
    process.exit(0);
  }

  const handler = HANDLERS[cmd];
  if (!handler) {
    console.error(`[deploy-status] unknown command: ${cmd}`);
    process.exit(1);
  }

  try {
    const { atomicReadModifyWriteJson } = require('../orchestrator/atomic-write');
    atomicReadModifyWriteJson(DEPLOY_STATUS_PATH, (data) => handler(data, opts));
    console.log(`[deploy-status] ${cmd} ok`);
  } catch (err) {
    console.error(`[deploy-status] ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { HANDLERS, parseArgs, BLANK_STATUS };
