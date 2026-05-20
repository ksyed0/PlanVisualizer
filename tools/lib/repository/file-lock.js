'use strict';
const lockfile = require('proper-lockfile');

async function withFileLock(file, fn, opts = {}) {
  const release = await lockfile.lock(file, {
    retries: { retries: 50, minTimeout: 10, maxTimeout: 200 },
    stale: 30_000,
    realpath: false,
    ...opts,
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}

async function acquireMany(files, onAcquired = () => {}) {
  const sorted = [...new Set(files)].sort();
  const releases = [];
  try {
    for (const f of sorted) {
      const release = await lockfile.lock(f, {
        retries: { retries: 50, minTimeout: 10, maxTimeout: 200 },
        stale: 30_000,
        realpath: false,
      });
      releases.push(release);
      onAcquired(f);
    }
  } catch (err) {
    for (const r of releases.reverse()) {
      try {
        await r();
      } catch {
        /* ignore */
      }
    }
    throw err;
  }
  return async () => {
    for (const r of releases.reverse()) {
      try {
        await r();
      } catch {
        /* ignore */
      }
    }
  };
}

module.exports = { withFileLock, acquireMany };
