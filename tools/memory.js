#!/usr/bin/env node
// tools/memory.js
'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || null;
  let dry = false;
  let force = false;
  let days = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--dry' || args[i] === '--dry-run') dry = true;
    else if (args[i] === '--force') force = true;
    else if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return { cmd, dry, force, days };
}

function loadStaleDays() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan-visualizer.config.json'), 'utf8'));
    return (cfg.memory && cfg.memory.staleDays) || 90;
  } catch {
    return 90;
  }
}

function dispatch({ cmd, dry, force, days }) {
  if (cmd === 'compact') {
    const { compactMemory, renderIndex, readEntries } = require('./lib/memory-index');
    if (dry) {
      process.stdout.write(renderIndex(readEntries(ROOT)) + '\n');
    } else {
      compactMemory({ root: ROOT });
      console.log('[memory] MEMORY.md regenerated.');
    }
    return 0;
  }

  if (cmd === 'archive') {
    const { selectForArchive, scopeFromTitle } = require('./lib/memory-archiver');
    const { execFileSync } = require('child_process');
    const memDir = path.join(ROOT, 'docs/memory');
    if (!fs.existsSync(memDir)) {
      console.log('[memory] docs/memory/ missing — nothing to archive.');
      return 0;
    }
    const staleDays = days || loadStaleDays();
    const files = [];
    for (const cat of ['topics', 'sessions', 'snapshots']) {
      const dir = path.join(memDir, cat);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.md')) continue;
        const fp = path.join(dir, f);
        const stat = fs.statSync(fp);
        const content = fs.readFileSync(fp, 'utf8');
        const titleMatch = content.match(/^# (.+?)\s*$/m);
        const title = titleMatch ? titleMatch[1] : f.replace(/\.md$/, '');
        const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
        files.push({
          path: fp,
          mtime: stat.mtimeMs,
          category: cat,
          scope: cat === 'snapshots' ? scopeFromTitle(title) : null,
          date: dateMatch ? dateMatch[1] : null,
        });
      }
    }
    const targets = selectForArchive(files, { now: Date.now(), staleDays });
    if (targets.length === 0) {
      console.log('[memory] Nothing stale to archive.');
      return 0;
    }
    for (const t of targets) {
      const dest = t.path.replace(
        `${path.sep}memory${path.sep}${t.category}${path.sep}`,
        `${path.sep}memory${path.sep}archive${path.sep}${t.category}${path.sep}`,
      );
      console.log(`[memory] archive: ${path.relative(ROOT, t.path)} → ${path.relative(ROOT, dest)}`);
      if (!dry) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        try {
          execFileSync('git', ['-C', ROOT, 'mv', t.path, dest], { stdio: 'ignore' });
        } catch {
          fs.renameSync(t.path, dest);
        }
      }
    }
    if (!dry) {
      const { compactMemory } = require('./lib/memory-index');
      compactMemory({ root: ROOT });
    }
    return 0;
  }

  if (cmd === 'migrate') {
    const { migrateMemory } = require('./lib/memory-migrator');
    const result = migrateMemory({ root: ROOT, dry, force });
    if (result.skipped) {
      console.log('[memory] memory layout already bootstrapped; pass --force to re-migrate.');
      return 0;
    }
    if (dry) {
      console.log(
        `[memory] dry-run: ${result.topicFiles.length} topic files, ${result.archiveOps.length} archive ops, ${result.lessonOrphans.length} lesson orphans.`,
      );
    } else {
      console.log(
        `[memory] migrated: ${result.topicFiles.length} topic files written, ${result.archiveOps.length} archived.`,
      );
    }
    return 0;
  }

  if (cmd === 'validate') {
    const { validateMemory } = require('./lib/memory-validator');
    const result = validateMemory({ root: ROOT });
    if (result.ok) {
      console.log('[memory] OK — MEMORY.md is in sync with docs/memory/.');
      return 0;
    }
    console.error('[memory] DRIFT — MEMORY.md does not match docs/memory/:');
    console.error(result.diff);
    return 1;
  }

  console.error('Usage: node tools/memory.js {compact|archive|migrate|validate} [--dry] [--force] [--days N]');
  return 2;
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  const exitCode = dispatch(args);
  process.exit(exitCode);
}

module.exports = { parseArgs, dispatch };
