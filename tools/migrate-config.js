#!/usr/bin/env node
/**
 * migrate-config.js — idempotent schema migrator for PlanVisualizer config files.
 *
 * Reads plan-visualizer.config.json and agents.config.json from the current
 * working directory (target project root). Adds any required fields that the
 * latest tools/* expect, using sensible defaults. Never overwrites an existing
 * user value.
 *
 * Usage:
 *   node tools/migrate-config.js            # apply
 *   node tools/migrate-config.js --dry-run  # preview only
 *   node tools/migrate-config.js --auto     # silent unless changes are made
 *
 * Exit codes:
 *   0 — success (migrations applied or nothing to do)
 *   1 — unexpected error
 *
 * Design notes:
 * - Only add fields; never remove or rename. User values always win.
 * - Safe to re-run. Running twice produces identical files.
 * - Invoked automatically from scripts/install.sh after config files are
 *   seeded, so existing installs pick up new fields on upgrade.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const AUTO = process.argv.includes('--auto');

function log(msg) {
  if (!AUTO) console.log(msg);
}

function logAlways(msg) {
  console.log(msg);
}

/**
 * Ensure `obj[key]` exists. If not, set it to `defaultValue` and return true.
 * Returns false if the key already existed (no mutation).
 */
function ensureKey(obj, key, defaultValue) {
  if (obj[key] === undefined) {
    obj[key] = defaultValue;
    return true;
  }
  return false;
}

/**
 * Migrate plan-visualizer.config.json.
 * Required fields the current code expects but early installs are missing:
 *   - docs.lessons — parsed by generate-plan.js:156
 */
function migratePlanVisualizerConfig(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      log(`  [skip] ${path.basename(filePath)} not present`);
      return { changed: false, additions: [] };
    }
    throw err;
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (err) {
    logAlways(`  [error] ${path.basename(filePath)} is not valid JSON — skipping (${err.message})`);
    return { changed: false, additions: [] };
  }

  const additions = [];

  cfg.docs = cfg.docs || {};
  if (ensureKey(cfg.docs, 'lessons', 'docs/LESSONS.md')) {
    additions.push('docs.lessons');
  }

  const changed = additions.length > 0;
  if (changed && !DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  }

  return { changed, additions };
}

/**
 * Migrate agents.config.json.
 * Required fields the current code expects but early installs are missing:
 *   - agents.<name>.avatar — US-0113, used by generate-dashboard.js to path
 *     portraits at agents/images/optimized/{avatar}-{size}.png. Default is
 *     the first whitespace-delimited word of the agent name, lowercased.
 *     Renderer gracefully falls back to headshot→emoji if the PNG is absent.
 */
function migrateAgentsConfig(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      log(`  [skip] ${path.basename(filePath)} not present`);
      return { changed: false, additions: [] };
    }
    throw err;
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (err) {
    logAlways(`  [error] ${path.basename(filePath)} is not valid JSON — skipping (${err.message})`);
    return { changed: false, additions: [] };
  }

  const additions = [];

  if (cfg.agents && typeof cfg.agents === 'object') {
    for (const [name, agent] of Object.entries(cfg.agents)) {
      if (!agent || typeof agent !== 'object') continue;
      const defaultAvatar = String(name).toLowerCase().split(/\s+/)[0];
      if (ensureKey(agent, 'avatar', defaultAvatar)) {
        additions.push(`agents.${name}.avatar → "${defaultAvatar}"`);
      }
    }
  }

  const changed = additions.length > 0;
  if (changed && !DRY_RUN) {
    fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  }

  return { changed, additions };
}

function main() {
  const planVisualizerConfig = path.join(ROOT, 'plan-visualizer.config.json');
  const agentsConfig = path.join(ROOT, 'agents.config.json');

  log(DRY_RUN ? '[migrate-config] dry-run (no writes)' : '[migrate-config] applying migrations');
  log(`  target: ${ROOT}`);

  const pvResult = migratePlanVisualizerConfig(planVisualizerConfig);
  const acResult = migrateAgentsConfig(agentsConfig);

  const totalAdditions = pvResult.additions.length + acResult.additions.length;

  if (totalAdditions === 0) {
    log('[migrate-config] no migrations needed — schema already current');
    return;
  }

  const prefix = DRY_RUN ? '[would add]' : '[added]';
  if (pvResult.additions.length > 0) {
    logAlways(`  ${prefix} plan-visualizer.config.json:`);
    pvResult.additions.forEach((a) => logAlways(`    - ${a}`));
  }
  if (acResult.additions.length > 0) {
    logAlways(`  ${prefix} agents.config.json:`);
    acResult.additions.forEach((a) => logAlways(`    - ${a}`));
  }

  if (DRY_RUN) {
    logAlways('[migrate-config] dry-run complete — re-run without --dry-run to apply');
  } else {
    logAlways(`[migrate-config] migrated ${totalAdditions} field(s)`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[migrate-config] unexpected error:', err);
    process.exit(1);
  }
}

module.exports = { migratePlanVisualizerConfig, migrateAgentsConfig, ensureKey };
