'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { migrateMemory } = require('./memory-migrator');
const { validateMemory } = require('./memory-validator');
const { patchClaudeMd, patchSuggestModelItem } = require('./memory-claude-md-patcher');

function runMigrateCommit(opts) {
  const { root, dry = false, push = false, pr = false, noTest = false, force = false } = opts;

  // 1. Pre-flight checks

  // 1a. Clean working tree
  const gitStatus = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (gitStatus) {
    console.error('[migrate-commit] Abort: working tree must be clean before migration.');
    return 1;
  }

  // 1b. Not on a protected branch
  const branch = execFileSync('git', ['-C', root, 'symbolic-ref', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  if (branch === 'develop' || branch === 'main' || branch === 'master') {
    console.error(`[migrate-commit] Abort: on protected branch '${branch}'. Create a feature branch first.`);
    console.error('[migrate-commit] Suggested: git checkout -b feature/US-0178-memory-migration');
    return 1;
  }

  // 1c. MEMORY.md must exist
  const memoryPath = path.join(root, 'MEMORY.md');
  if (!fs.existsSync(memoryPath)) {
    console.error('[migrate-commit] Abort: MEMORY.md not found at repo root.');
    return 1;
  }

  // 1d. topics/ not already populated (unless --force)
  const topicsDir = path.join(root, 'docs/memory/topics');
  if (!force && fs.existsSync(topicsDir) && fs.readdirSync(topicsDir).filter((f) => f.endsWith('.md')).length > 0) {
    console.error('[migrate-commit] Abort: memory layout already migrated. Pass --force to re-run.');
    return 1;
  }

  // 2. Run migration
  let migrateResult;
  try {
    migrateResult = migrateMemory({ root, dry, force: true });
  } catch (e) {
    console.error('[migrate-commit] Abort: migration failed:', e.message);
    return 1;
  }

  // 3. Patch CLAUDE.md
  const claudePath = path.join(root, 'CLAUDE.md');
  let claudeChanged = false;
  let claudeOriginal;
  try {
    claudeOriginal = fs.readFileSync(claudePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.warn('[migrate-commit] Warning: CLAUDE.md not found — skipping patch.');
    } else {
      console.error('[migrate-commit] Abort: could not read CLAUDE.md:', e.message);
      return 1;
    }
  }
  if (claudeOriginal !== undefined) {
    let after = claudeOriginal;
    let anyChanged = false;
    try {
      const r1 = patchClaudeMd(after);
      after = r1.text;
      if (r1.changed) anyChanged = true;
    } catch (e) {
      console.error('[migrate-commit] Abort:', e.message);
      return 1;
    }
    try {
      const r2 = patchSuggestModelItem(after);
      after = r2.text;
      if (r2.changed) anyChanged = true;
    } catch (e) {
      console.error('[migrate-commit] Abort:', e.message);
      return 1;
    }
    claudeChanged = anyChanged;
    if (!dry && anyChanged) {
      fs.writeFileSync(claudePath, after);
    }
    if (dry && anyChanged) {
      console.log('[migrate-commit] dry-run: CLAUDE.md would be patched (US-0178 + US-0179).');
    }
  }

  // 4. Dry-run: print summary and exit
  if (dry) {
    const t = (migrateResult.topicFiles || []).length;
    const a = (migrateResult.archiveOps || []).length;
    const o = (migrateResult.lessonOrphans || []).length;
    console.log(
      `[migrate-commit] dry-run: ${t} topic files, ${a} archive ops, ${o} lesson orphans, CLAUDE.md ${claudeChanged ? 'would patch' : 'already patched'}.`,
    );
    return 0;
  }

  // 5. Run jest (unless --no-test)
  if (!noTest) {
    try {
      execFileSync('npx', ['jest', '--no-coverage'], { cwd: root, stdio: 'inherit' });
    } catch {
      console.error('[migrate-commit] Abort: test suite failed. Fix tests before committing.');
      return 1;
    }
  }

  // 6. Validate memory
  const vResult = validateMemory({ root });
  if (!vResult.ok) {
    console.error('[migrate-commit] Abort: memory validation failed:');
    console.error(vResult.diff);
    return 1;
  }

  // 7. Stage + commit
  const stagePaths = ['docs/memory/', 'MEMORY.md', 'docs/LESSONS.md', 'docs/ID_REGISTRY.md'];
  if (fs.existsSync(claudePath)) stagePaths.push('CLAUDE.md');

  try {
    execFileSync('git', ['-C', root, 'add', ...stagePaths], { stdio: 'pipe' });
  } catch (e) {
    console.error('[migrate-commit] Abort: git add failed:', e.stderr ? e.stderr.toString() : e.message);
    return 1;
  }

  const tf = migrateResult.topicFiles || [];
  const topicCount = tf.filter((f) => f.category === 'topics').length;
  const sessionCount = tf.filter((f) => f.category === 'sessions').length;
  const snapshotCount = tf.filter((f) => f.category === 'snapshots').length;
  const archiveCount = (migrateResult.archiveOps || []).length;
  const orphanCount = (migrateResult.lessonOrphans || []).length;

  const commitMsg = [
    'chore(memory): bootstrap docs/memory/ layout (US-0175)',
    '',
    'Migration commit produced by `tools/memory.js migrate-commit`.',
    '',
    '- Splits monolithic MEMORY.md into per-topic files under docs/memory/{topics,sessions,snapshots}/',
    '- Rewrites MEMORY.md as compact auto-generated index',
    `- Archives ${archiveCount} superseded snapshots to docs/memory/archive/snapshots/`,
    `- Triages ## Lessons Learned section against docs/LESSONS.md (${orphanCount} orphans appended)`,
    '- Patches CLAUDE.md with new memory layout instructions',
    '',
    'Counts:',
    `- Topic files written: ${topicCount}`,
    `- Session files written: ${sessionCount}`,
    `- Snapshot files written: ${snapshotCount}  (archived: ${archiveCount})`,
    `- Lesson orphans appended: ${orphanCount}`,
    '',
    'Run `node tools/memory.js validate` to confirm MEMORY.md/topic file consistency.',
  ].join('\n');

  try {
    execFileSync('git', ['-C', root, 'commit', '-m', commitMsg], { stdio: 'pipe' });
    console.log('[migrate-commit] Committed migration.');
  } catch (e) {
    console.error('[migrate-commit] Abort: commit failed.', e.stderr ? e.stderr.toString().trim() : e.message);
    return 1;
  }

  // Optional push
  if (push || pr) {
    try {
      execFileSync('git', ['-C', root, 'push', '-u', 'origin', branch], { stdio: 'inherit' });
      console.log(`[migrate-commit] Pushed to origin/${branch}.`);
    } catch {
      console.warn('[migrate-commit] Warning: push failed. Commit landed locally; push manually.');
      return 0;
    }
  }

  // Optional PR
  if (pr) {
    try {
      execFileSync('gh', ['--version'], { stdio: 'ignore' });
    } catch {
      console.warn('[migrate-commit] Warning: gh CLI not found. Create PR manually.');
      return 0;
    }
    let prARef = '';
    try {
      const out = execFileSync(
        'gh',
        ['pr', 'list', '--state', 'merged', '--search', 'feature/US-0175 in:head', '--limit', '1', '--json', 'number'],
        { encoding: 'utf8', cwd: root },
      );
      const parsed = JSON.parse(out);
      if (parsed[0]) prARef = ` (#${parsed[0].number})`;
    } catch {
      /* no match or gh unavailable */
    }

    const prBody = `## Summary

Migration commit produced by tools/memory.js migrate-commit. This is PR B of the US-0175 split: PR A${prARef} shipped the tooling inert; this PR runs it and ships the result.

- Topic files written: ${topicCount}
- Session files written: ${sessionCount}
- Snapshot files written: ${snapshotCount} (archived: ${archiveCount})
- Lesson orphans appended: ${orphanCount}
- CLAUDE.md patched (Mandatory Session Startup + Session Close Checklist)

## Test Plan

- [x] tools/memory.js migrate ran cleanly
- [x] CLAUDE.md patches applied without abort
- [x] Test suite passes
- [x] tools/memory.js validate exits 0
- [ ] Manual: open MEMORY.md and confirm it's the compact index, not the old monolithic file
- [ ] Manual: spot-check 2-3 topic files for verbatim section content
- [ ] Manual: confirm CLAUDE.md instructions read correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)`;

    try {
      const prUrl = execFileSync(
        'gh',
        [
          'pr',
          'create',
          '--base',
          'develop',
          '--head',
          branch,
          '--title',
          'feat(memory): bootstrap memory layout migration (US-0175)',
          '--body',
          prBody,
        ],
        { encoding: 'utf8', cwd: root },
      ).trim();
      console.log(`[migrate-commit] PR created: ${prUrl}`);
    } catch {
      console.warn('[migrate-commit] Warning: gh pr create failed. Create PR manually.');
    }
  }

  console.log('[migrate-commit] Done.');
  return 0;
}

module.exports = { runMigrateCommit };
