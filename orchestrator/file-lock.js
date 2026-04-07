'use strict';

/**
 * file-lock.js — Simple File Locking for Shared State
 *
 * Prevents race conditions when multiple agents write to shared files
 * (sdlc-status.json, progress.md, BUGS.md, ID_REGISTRY.md, AI_COST_LOG.md).
 *
 * Uses mkdir-based locking (atomic on all platforms) with stale lock detection.
 * NOT a distributed lock — designed for local multi-process agent orchestration.
 *
 * Usage:
 *   const { withLock } = require('./file-lock');
 *   await withLock('docs/sdlc-status.json', async () => {
 *     const data = JSON.parse(fs.readFileSync('docs/sdlc-status.json', 'utf8'));
 *     data.currentPhase = 2;
 *     fs.writeFileSync('docs/sdlc-status.json', JSON.stringify(data, null, 2));
 *   });
 */

const fs = require('fs');
const path = require('path');

const LOCK_DIR = path.join(__dirname, '..', '.locks');
const STALE_THRESHOLD_MS = 30_000; // 30s — locks older than this are considered stale
const RETRY_INTERVAL_MS = 200;
const MAX_WAIT_MS = 10_000; // 10s max wait before giving up

/**
 * Ensure the .locks directory exists.
 */
function ensureLockDir() {
  try {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
  } catch {
    // Already exists or created by another process
  }
}

/**
 * Get the lock path for a given file.
 */
function lockPath(filePath) {
  const name = filePath.replace(/[/\\]/g, '_').replace(/\./g, '_');
  return path.join(LOCK_DIR, `${name}.lock`);
}

/**
 * Try to acquire a lock. Returns true if acquired, false if held by another process.
 * Uses mkdir which is atomic on POSIX and Windows.
 */
function tryAcquire(filePath, _depth = 0) {
  if (_depth > 2) {
    throw new Error(`[file-lock] Too many stale lock retries for "${filePath}"`);
  }
  ensureLockDir();
  const lp = lockPath(filePath);
  try {
    fs.mkdirSync(lp);
    // Write PID + timestamp for stale detection
    fs.writeFileSync(path.join(lp, 'info'), JSON.stringify({ pid: process.pid, ts: Date.now() }));
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      // Lock exists — check if stale
      try {
        const info = JSON.parse(fs.readFileSync(path.join(lp, 'info'), 'utf8'));
        if (Date.now() - info.ts > STALE_THRESHOLD_MS) {
          // Stale lock — break it
          console.warn(`[file-lock] Breaking stale lock for "${filePath}" (held by PID ${info.pid})`);
          release(filePath);
          return tryAcquire(filePath, _depth + 1);
        }
      } catch {
        // Can't read info — break the lock
        release(filePath);
        return tryAcquire(filePath, _depth + 1);
      }
      return false;
    }
    if (err.code === 'ENOENT') {
      // .locks/ dir was removed between ensureLockDir() and mkdirSync(lp) — recreate and retry
      ensureLockDir();
      return tryAcquire(filePath, _depth + 1);
    }
    throw err;
  }
}

/**
 * Release a lock.
 */
function release(filePath) {
  const lp = lockPath(filePath);
  try {
    // Remove info file first, then directory
    const infoPath = path.join(lp, 'info');
    if (fs.existsSync(infoPath)) fs.unlinkSync(infoPath);
    if (fs.existsSync(lp)) {
      try {
        fs.rmdirSync(lp);
      } catch (err) {
        console.warn(`[file-lock] Failed to remove lock dir for "${filePath}": ${err.message}`);
      }
    }
  } catch {
    // Already released
  }
}

/**
 * Acquire a lock with retry, execute the callback, then release.
 * Ensures lock is always released even if callback throws.
 *
 * @param {string} filePath - Relative path of the file to lock
 * @param {Function} fn - Async or sync callback to execute while holding the lock
 * @returns {Promise<*>} Return value of the callback
 */
async function withLock(filePath, fn) {
  const start = Date.now();
  while (!tryAcquire(filePath)) {
    if (Date.now() - start > MAX_WAIT_MS) {
      throw new Error(`[file-lock] Timeout acquiring lock for "${filePath}" after ${MAX_WAIT_MS}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
  }
  try {
    return await fn();
  } finally {
    release(filePath);
  }
}

/**
 * Synchronous version — acquire, execute, release.
 */
function withLockSync(filePath, fn) {
  const start = Date.now();
  while (!tryAcquire(filePath)) {
    if (Date.now() - start > MAX_WAIT_MS) {
      throw new Error(`[file-lock] Timeout acquiring lock for "${filePath}" after ${MAX_WAIT_MS}ms`);
    }
    // Busy wait (sync only — prefer async version)
    const waitUntil = Date.now() + RETRY_INTERVAL_MS;
    while (Date.now() < waitUntil) {
      /* spin */
    }
  }
  try {
    return fn();
  } finally {
    release(filePath);
  }
}

module.exports = { withLock, withLockSync, tryAcquire, release, LOCK_DIR };
