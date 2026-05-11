'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseMemory } = require('./memory-parser');
const { classifySection } = require('./memory-classifier');
const { selectForArchive, scopeFromTitle } = require('./memory-archiver');
const { compactMemory } = require('./memory-index');

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function getSectionMtime(root, heading) {
  try {
    const out = execFileSync(
      'git',
      ['-C', root, 'log', '--reverse', '--format=%ct', '-S', `## ${heading}`, '--', 'MEMORY.md'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const lines = out.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    return parseInt(lines[lines.length - 1], 10) * 1000;
  } catch {
    return null;
  }
}

function triageLessons(root, lessonsBody, dry) {
  const lessonsPath = path.join(root, 'docs', 'LESSONS.md');
  let existing = '';
  try {
    existing = fs.readFileSync(lessonsPath, 'utf8');
  } catch {
    /* file may not exist yet */
  }
  const today = new Date().toISOString().slice(0, 10);
  const orphans = [];
  // Split on entry boundaries (lines starting with '- L-XXXX')
  const entries = lessonsBody.split(/\n(?=- L-\d)/);
  for (const entry of entries) {
    const idMatch = entry.match(/L-(\d{4,})/);
    if (!idMatch) continue;
    const id = `L-${idMatch[1]}`;
    if (existing.includes(id)) continue;
    orphans.push({ id, body: entry.trim() });
  }
  if (dry || orphans.length === 0) return orphans;
  let appendText = '\n';
  for (const o of orphans) {
    appendText += `\n<!-- migrated from MEMORY.md ${today} -->\n${o.body}\n`;
  }
  fs.appendFileSync(lessonsPath, appendText);
  return orphans;
}

function migrateMemory(opts) {
  const { root, dry = false, force = false } = opts;
  const memoryPath = path.join(root, 'MEMORY.md');
  const topicsDir = path.join(root, 'docs/memory/topics');

  // Idempotency check.
  if (!force && fs.existsSync(topicsDir) && fs.readdirSync(topicsDir).filter((f) => f.endsWith('.md')).length > 0) {
    return { skipped: true, topicFiles: [], archiveOps: [], lessonOrphans: [] };
  }

  const text = fs.readFileSync(memoryPath, 'utf8');
  const { sections } = parseMemory(text);

  const topicFiles = [];
  const snapshotMeta = [];
  let lessonsBody = '';

  for (const sec of sections) {
    const cls = classifySection(sec.heading);
    if (cls.category === 'lessons') {
      lessonsBody = sec.body;
      continue;
    }
    const filename = cls.date ? `${cls.date}-${cls.slug}.md` : `${cls.slug}.md`;
    const filePath = path.join(root, 'docs/memory', cls.category, filename);
    const fileContent = `# ${sec.heading}\n\n${sec.body.replace(/^\n+/, '')}`;
    const mtime = getSectionMtime(root, sec.heading);
    topicFiles.push({ category: cls.category, path: filePath, content: fileContent, mtime });
    if (cls.category === 'snapshots') {
      snapshotMeta.push({
        path: filePath,
        scope: scopeFromTitle(sec.heading),
        date: cls.date || '',
        category: 'snapshots',
        mtime: mtime || Date.now(),
      });
    }
  }

  // Plan archive ops (snapshot supersession).
  const archiveTargets = selectForArchive(snapshotMeta, { now: Date.now(), staleDays: Infinity });
  const archiveOps = archiveTargets.map((s) => ({
    from: s.path,
    to: s.path.replace('/memory/snapshots/', '/memory/archive/snapshots/'),
  }));

  if (dry) {
    return {
      skipped: false,
      topicFiles: topicFiles.map((t) => ({ path: t.path, category: t.category })),
      archiveOps,
      lessonOrphans: triageLessons(root, lessonsBody, true),
    };
  }

  // Write topic files.
  for (const t of topicFiles) {
    ensureDir(path.dirname(t.path));
    fs.writeFileSync(t.path, t.content);
    if (t.mtime) {
      const ts = t.mtime / 1000;
      try {
        fs.utimesSync(t.path, ts, ts);
      } catch {
        /* non-fatal */
      }
    }
  }

  // Archive superseded snapshots.
  for (const op of archiveOps) {
    ensureDir(path.dirname(op.to));
    try {
      execFileSync('git', ['-C', root, 'mv', op.from, op.to], { stdio: 'ignore' });
    } catch {
      fs.renameSync(op.from, op.to);
    }
  }

  // Triage lessons.
  const lessonOrphans = triageLessons(root, lessonsBody, false);

  // Regenerate MEMORY.md as compact index.
  compactMemory({ root });

  return { skipped: false, topicFiles, archiveOps, lessonOrphans };
}

module.exports = { migrateMemory };
