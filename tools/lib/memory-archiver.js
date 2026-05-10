'use strict';
const fs = require('fs');

/**
 * Read a file's content and mtime atomically via a file descriptor.
 * Avoids TOCTOU race between stat and read (CodeQL js/file-system-race).
 *
 * @param {string} fp
 * @returns {{ content: string, mtimeMs: number }}
 */
function readFileSafe(fp) {
  const fd = fs.openSync(fp, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const size = stat.size;
    const buf = Buffer.allocUnsafe(size);
    fs.readSync(fd, buf, 0, size, 0);
    return { content: buf.toString('utf8'), mtimeMs: stat.mtimeMs };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Extract scope from a snapshot title — text before the first `(`, lowercased and trimmed.
 */
function scopeFromTitle(title) {
  const idx = title.indexOf('(');
  const scope = idx === -1 ? title : title.slice(0, idx);
  return scope.trim().toLowerCase();
}

/**
 * Select which files should be archived based on staleness + snapshot supersession.
 *
 * @param {Array<{path:string, mtime:number, category:string, scope?:string, date?:string}>} files
 * @param {{ now: number, staleDays: number }} opts
 * @returns {Array}
 */
function selectForArchive(files, opts) {
  const { now, staleDays } = opts;
  const thresholdMs = staleDays * 86400 * 1000;
  const archive = new Set();

  // Staleness rule: topics and sessions only.
  for (const f of files) {
    if ((f.category === 'topics' || f.category === 'sessions') && now - f.mtime > thresholdMs) {
      archive.add(f);
    }
  }

  // Snapshot supersession: group by scope; keep newest date per scope; archive the rest.
  const snapshots = files.filter((f) => f.category === 'snapshots');
  const byScope = new Map();
  for (const s of snapshots) {
    const scope = s.scope || '';
    if (!byScope.has(scope)) byScope.set(scope, []);
    byScope.get(scope).push(s);
  }
  for (const group of byScope.values()) {
    if (group.length <= 1) continue;
    group.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    for (let i = 1; i < group.length; i++) archive.add(group[i]);
  }

  return [...archive];
}

/**
 * Archive stale topic/session files from docs/memory/ using staleness + snapshot supersession rules.
 * Uses git mv when possible, falls back to fs.rename.
 *
 * @param {{ root: string, days?: number }} opts
 */
function archiveStaleMemory(opts) {
  const fs = require('fs');
  const path = require('path');
  const { execFileSync } = require('child_process');
  const { root, days = 90 } = opts;
  const memDir = path.join(root, 'docs', 'memory');
  if (!fs.existsSync(memDir)) return;
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
  const targets = selectForArchive(files, { now: Date.now(), staleDays: days });
  for (const t of targets) {
    const dest = t.path.replace(
      `${path.sep}memory${path.sep}${t.category}${path.sep}`,
      `${path.sep}memory${path.sep}archive${path.sep}${t.category}${path.sep}`,
    );
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      execFileSync('git', ['-C', root, 'mv', t.path, dest], { stdio: 'ignore' });
    } catch {
      fs.renameSync(t.path, dest);
    }
  }
}

module.exports = { selectForArchive, scopeFromTitle, archiveStaleMemory };
