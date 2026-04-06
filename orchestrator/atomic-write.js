'use strict';

/**
 * atomic-write.js — Atomic File Writes for Shared State
 *
 * Prevents partial/corrupt writes when multiple agents update shared files.
 * Uses write-to-temp + rename pattern (atomic on POSIX).
 *
 * For JSON files (sdlc-status.json), provides read-modify-write with locking.
 * For append-only files (progress.md, AI_COST_LOG.md), provides locked append.
 *
 * Usage:
 *   const { atomicWriteJson, atomicAppend, atomicReadModifyWriteJson } = require('./atomic-write');
 *
 *   // Atomic JSON write
 *   atomicWriteJson('docs/sdlc-status.json', data);
 *
 *   // Locked read-modify-write cycle for JSON
 *   await atomicReadModifyWriteJson('docs/sdlc-status.json', (data) => {
 *     data.currentPhase = 2;
 *     return data;
 *   });
 *
 *   // Locked append for log files
 *   await atomicAppend('progress.md', '\n## New entry\n- Details here\n');
 */

const fs = require('fs');
const path = require('path');
const { withLock } = require('./file-lock');

const ROOT = path.join(__dirname, '..');

/**
 * Write a file atomically using write-to-temp + rename.
 * This prevents other processes from reading a half-written file.
 *
 * @param {string} filePath - Absolute or relative path
 * @param {string} content - File content to write
 */
function atomicWrite(filePath, content) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  const dir = path.dirname(abs);
  const tmpPath = path.join(dir, `.${path.basename(abs)}.tmp.${process.pid}.${Date.now()}`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, abs);
}

/**
 * Atomically write a JSON file (pretty-printed with 2-space indent).
 *
 * @param {string} filePath - Relative path from project root
 * @param {*} data - JSON-serializable data
 */
function atomicWriteJson(filePath, data) {
  atomicWrite(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Locked read-modify-write cycle for JSON files.
 * Acquires a file lock, reads current content, applies modifier, writes back atomically.
 *
 * @param {string} filePath - Relative path from project root
 * @param {Function} modifier - (data) => modifiedData
 * @returns {Promise<*>} The modified data
 */
async function atomicReadModifyWriteJson(filePath, modifier) {
  return withLock(filePath, async () => {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
    const raw = fs.readFileSync(abs, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      throw new Error(`[atomic-write] Invalid JSON in ${filePath}: ${parseErr.message}`, { cause: parseErr });
    }
    const modified = await modifier(data);
    atomicWriteJson(filePath, modified);
    return modified;
  });
}

/**
 * Locked append to a file. Prevents interleaved writes from parallel agents.
 *
 * @param {string} filePath - Relative path from project root
 * @param {string} content - Content to append
 */
async function atomicAppend(filePath, content) {
  return withLock(filePath, async () => {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
    fs.appendFileSync(abs, content, 'utf8');
  });
}

/**
 * Reserve the next ID from ID_REGISTRY.md atomically.
 * Prevents duplicate IDs when parallel agents both need new bug/task IDs.
 *
 * @param {string} sequence - One of: EPIC, US, TASK, AC, TC, BUG, L
 * @returns {Promise<string>} The reserved ID (e.g., "BUG-0044")
 */
async function reserveId(sequence) {
  const registryPath = 'docs/ID_REGISTRY.md';
  let reservedId;

  await withLock(registryPath, async () => {
    const abs = path.join(ROOT, registryPath);
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(
        new RegExp(`^\\|\\s*${sequence}\\s*\\|\\s*(${sequence}-\\d+)\\s*\\|\\s*(${sequence}-\\d+|—)\\s*\\|`),
      );
      if (match) {
        reservedId = match[1];
        const num = parseInt(reservedId.split('-')[1], 10);
        const nextId = `${sequence}-${String(num + 1).padStart(4, '0')}`;
        lines[i] = `| ${sequence}     | ${nextId}         | ${reservedId}      |`;
        break;
      }
    }

    if (!reservedId) {
      throw new Error(`[atomic-write] Sequence "${sequence}" not found in ID_REGISTRY.md`);
    }

    atomicWrite(registryPath, lines.join('\n'));
  });

  return reservedId;
}

module.exports = {
  atomicWrite,
  atomicWriteJson,
  atomicReadModifyWriteJson,
  atomicAppend,
  reserveId,
};
