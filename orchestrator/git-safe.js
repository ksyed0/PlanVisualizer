'use strict';

/**
 * git-safe.js — Concurrency-Safe Git Operations
 *
 * Provides retry logic for git push, pull-before-push, and merge conflict
 * detection for parallel agent branches.
 *
 * Designed for hackathon orchestration where Forge + Pixel push to separate
 * branches simultaneously, and Conductor merges them sequentially.
 *
 * Usage:
 *   const { safePush, safePull, detectConflicts } = require('./git-safe');
 *
 *   // Push with auto-retry (pulls on rejection, retries up to 4 times)
 *   const result = safePush('feature/forge-services');
 *
 *   // Check for merge conflicts before merging two branches
 *   const conflicts = detectConflicts('feature/forge', 'feature/pixel');
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 2000;

/**
 * Execute a git command in the project root.
 * Returns { ok, stdout, stderr }.
 */
function git(cmd) {
  try {
    const stdout = execSync(`git ${cmd}`, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60_000,
    });
    return { ok: true, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      ok: false,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
    };
  }
}

/**
 * Sleep for the specified milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Push to remote with exponential backoff retry.
 * On rejection (remote has new commits), pulls and retries.
 *
 * @param {string} branch - Branch name to push
 * @param {object} opts - Options
 * @param {boolean} opts.setUpstream - Use -u flag (default: true)
 * @returns {Promise<{ok: boolean, attempts: number, error?: string}>}
 */
async function safePush(branch, opts = {}) {
  const setUpstream = opts.setUpstream !== false;
  const flag = setUpstream ? '-u' : '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = git(`push ${flag} origin "${branch}"`);

    if (result.ok) {
      return { ok: true, attempts: attempt };
    }

    // Check if it's a rejection (needs pull) vs. auth/network error
    const isRejection =
      result.stderr.includes('fetch first') ||
      result.stderr.includes('non-fast-forward') ||
      result.stderr.includes('failed to push');

    if (!isRejection) {
      // Network or auth error — retry with backoff
      if (attempt < MAX_RETRIES) {
        const wait = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
        console.warn(`[git-safe] Push attempt ${attempt} failed (network), retrying in ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      return { ok: false, attempts: attempt, error: result.stderr };
    }

    // Rejection — pull first, then retry
    console.warn(`[git-safe] Push rejected (remote has new commits), pulling...`);
    const pullResult = git(`pull --no-rebase origin "${branch}"`);

    if (!pullResult.ok) {
      if (pullResult.stderr.includes('CONFLICT') || pullResult.stdout.includes('CONFLICT')) {
        return {
          ok: false,
          attempts: attempt,
          error: `Merge conflict during pull. Resolve manually:\n${pullResult.stdout}`,
        };
      }
      // Other pull error — retry
      if (attempt < MAX_RETRIES) {
        const wait = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
        await sleep(wait);
      }
    }
    // Pull succeeded — loop back to push
  }

  return { ok: false, attempts: MAX_RETRIES, error: 'Max retries exceeded' };
}

/**
 * Pull from remote with retry.
 *
 * @param {string} branch - Branch name
 * @returns {Promise<{ok: boolean, conflicts: boolean, error?: string}>}
 */
async function safePull(branch) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = git(`pull --no-rebase origin "${branch}"`);

    if (result.ok) {
      return { ok: true, conflicts: false };
    }

    if (result.stderr.includes('CONFLICT') || result.stdout.includes('CONFLICT')) {
      return { ok: false, conflicts: true, error: result.stdout };
    }

    // Network error — retry
    if (attempt < MAX_RETRIES) {
      const wait = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`[git-safe] Pull attempt ${attempt} failed, retrying in ${wait}ms...`);
      await sleep(wait);
    }
  }

  return { ok: false, conflicts: false, error: 'Max retries exceeded' };
}

/**
 * Detect merge conflicts between two branches WITHOUT actually merging.
 * Uses `git merge-tree` (dry-run merge).
 *
 * @param {string} branchA - First branch
 * @param {string} branchB - Second branch
 * @returns {{hasConflicts: boolean, conflictFiles: string[]}}
 */
function detectConflicts(branchA, branchB) {
  // Find merge base
  const baseResult = git(`merge-base "${branchA}" "${branchB}"`);
  if (!baseResult.ok) {
    return { hasConflicts: false, conflictFiles: [], error: 'Could not find merge base' };
  }
  const base = baseResult.stdout;

  // Dry-run merge
  const mergeResult = git(`merge-tree "${base}" "${branchA}" "${branchB}"`);
  const output = mergeResult.stdout;

  // Look for conflict markers
  const conflictFiles = [];
  const matches = output.matchAll(
    /changed in both\n\s+base\s+\d+ \S+ \S+\n\s+our\s+\d+ \S+ \S+\n\s+their\s+\d+ \S+ (.+)/g,
  );
  for (const m of matches) {
    conflictFiles.push(m[1]);
  }

  return {
    hasConflicts: conflictFiles.length > 0,
    conflictFiles,
  };
}

/**
 * Get the list of files modified on a branch since it diverged from base.
 * Used to check for overlapping edits between parallel agent branches.
 *
 * @param {string} branch - Feature branch
 * @param {string} base - Base branch (default: develop)
 * @returns {string[]} List of modified file paths
 */
function branchFiles(branch, base = 'develop') {
  const result = git(`diff --name-only "${base}...${branch}"`);
  return result.ok ? result.stdout.split('\n').filter(Boolean) : [];
}

/**
 * Check if two parallel branches have overlapping file edits.
 * Warns Conductor before attempting merges.
 *
 * @param {string} branchA - First branch
 * @param {string} branchB - Second branch
 * @param {string} base - Common base branch
 * @returns {{overlapping: boolean, files: string[]}}
 */
function checkOverlap(branchA, branchB, base = 'develop') {
  const filesA = new Set(branchFiles(branchA, base));
  const filesB = branchFiles(branchB, base);
  const overlap = filesB.filter((f) => filesA.has(f));
  return { overlapping: overlap.length > 0, files: overlap };
}

module.exports = {
  safePush,
  safePull,
  detectConflicts,
  branchFiles,
  checkOverlap,
  git,
};
