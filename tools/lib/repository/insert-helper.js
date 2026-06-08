'use strict';

/**
 * Factory returning a `tryInsert(fn, entityId)` closure that wraps a SQLite
 * INSERT call. Catches:
 *   - SQLITE_CONSTRAINT_CHECK     → warnings.push({code: 'check-rejected'})
 *   - SQLITE_CONSTRAINT_PRIMARYKEY → warnings.push({code: 'duplicate-id'})
 *   - SQLITE_CONSTRAINT_UNIQUE     → warnings.push({code: 'duplicate-id'})
 * Rethrows everything else so the indexer's transaction rolls back on
 * unexpected failures.
 *
 * Returns true if the INSERT succeeded; false if a known constraint
 * violation was caught and a warning was logged.
 */
function createTryInsert({ warnings }) {
  return function tryInsert(fn, entityId) {
    try {
      fn();
      return true;
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_CHECK') {
        warnings.push({ code: 'check-rejected', entityId, message: e.message });
        return false;
      }
      if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        warnings.push({ code: 'duplicate-id', entityId, message: `Duplicate entity skipped: ${entityId}` });
        return false;
      }
      throw e;
    }
  };
}

module.exports = { createTryInsert };
