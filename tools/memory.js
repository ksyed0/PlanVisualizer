#!/usr/bin/env node
// tools/memory.js
'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

/**
 * Read a file's content and mtime atomically via a file descriptor.
 * Avoids TOCTOU race between stat and read (CodeQL js/file-system-race).
 */
function readFileSafe(fp) {
  const fd = fs.openSync(fp, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const buf = Buffer.allocUnsafe(stat.size);
    fs.readSync(fd, buf, 0, stat.size, 0);
    return { content: buf.toString('utf8'), mtimeMs: stat.mtimeMs };
  } finally {
    fs.closeSync(fd);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || null;
  let dry = false;
  let force = false;
  let days = null;
  let push = false;
  let pr = false;
  let noTest = false;
  let task = null;
  let json = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--dry' || args[i] === '--dry-run') dry = true;
    else if (args[i] === '--force') force = true;
    else if (args[i] === '--push') push = true;
    else if (args[i] === '--pr') {
      pr = true;
      push = true;
    } else if (args[i] === '--no-test') noTest = true;
    else if (args[i] === '--json') json = true;
    else if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--task' && args[i + 1] !== undefined) {
      task = args[i + 1];
      i++;
    }
  }
  return { cmd, dry, force, days, push, pr, noTest, task, json };
}

function loadStaleDays() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan-visualizer.config.json'), 'utf8'));
    return (cfg.memory && cfg.memory.staleDays) || 90;
  } catch {
    return 90;
  }
}

function dispatch({ cmd, dry, force, days, push, pr, noTest, task, json }) {
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
        const { content, mtimeMs } = readFileSafe(fp);
        const titleMatch = content.match(/^# (.+?)\s*$/m);
        const title = titleMatch ? titleMatch[1] : f.replace(/\.md$/, '');
        const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
        files.push({
          path: fp,
          mtime: mtimeMs,
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
    } else {
      console.error('[memory] DRIFT — MEMORY.md does not match docs/memory/:');
      console.error(result.diff);
    }
    if (result.warnings && result.warnings.length > 0) {
      console.error(`[memory] Warning: ${result.warnings.length} topic files missing complexity hints:`);
      for (const w of result.warnings) {
        console.error(`  - ${w.replace('topic file missing complexity hint: ', '')}`);
      }
      console.error('  Add `<!-- complexity: low|medium|high -->` on the line after the H1 title.');
    }
    return result.ok ? 0 : 1;
  }

  if (cmd === 'migrate-commit') {
    const { runMigrateCommit } = require('./lib/memory-commit-orchestrator');
    return runMigrateCommit({
      root: ROOT,
      dry,
      push,
      pr,
      noTest,
      force,
    });
  }

  if (cmd === 'suggest-model') {
    if (!task) {
      console.error('Usage: npm run memory:suggest-model -- --task "<brief description>"');
      console.error('       (the `--` separator is required when invoking via npm)');
      console.error('       or: node tools/memory.js suggest-model --task "<brief description>" [--json]');
      return 1;
    }
    const { readEntries } = require('./lib/memory-index');
    const { suggestModel } = require('./lib/memory-model-suggester');
    const entries = readEntries(ROOT);
    if (entries.length === 0) {
      console.error('[memory] no topic files found — run migration first (node tools/memory.js migrate)');
      return 1;
    }
    let result;
    try {
      result = suggestModel(entries, task);
    } catch (e) {
      console.error(`[memory] ${e.message}`);
      return 1;
    }
    if (json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      console.log(`Recommended: ${result.model}`);
      if (result.matched.length > 0) {
        console.log(`Matched ${result.matched.length} topics (score >= 2):`);
        for (const m of result.matched) {
          const tokensStr = m.matchedTokens.join(', ');
          console.log(
            `  - ${m.title} (${m.complexity}, ${m.complexitySource}) — score ${m.score} (matched: ${tokensStr})`,
          );
        }
      }
      console.log(`Reason: ${result.reason}`);
    }
    return 0;
  }

  console.error(
    'Usage: node tools/memory.js {compact|archive|migrate|migrate-commit|suggest-model|validate} [--dry] [--force] [--push] [--pr] [--no-test] [--days N] [--task "<text>"] [--json]',
  );
  return 2;
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  const exitCode = dispatch(args);
  process.exit(exitCode);
}

module.exports = { parseArgs, dispatch };
