'use strict';

const fs = require('fs');
const path = require('path');
const { withFileLock } = require('./file-lock');

const ID_REGISTRY_REL = path.join('docs', 'ID_REGISTRY.md');

const PREFIX_OVERRIDES = { Lesson: 'L' };

function _prefixFor(sequence) {
  return PREFIX_OVERRIDES[sequence] || sequence;
}

function _parseRow(text, sequence) {
  const prefix = _prefixFor(sequence);
  const lines = text.split('\n');
  const re = new RegExp(`^\\|\\s*${sequence}\\s*\\|\\s*(${prefix}-\\d+)\\s*\\|\\s*(${prefix}-\\d+)\\s*\\|\\s*$`);
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      const nextId = m[1];
      const lastAssigned = m[2];
      const nextNum = parseInt(nextId.slice(prefix.length + 1), 10);
      const lastNum = parseInt(lastAssigned.slice(prefix.length + 1), 10);
      return { sequence, prefix, nextId, nextNum, lastAssigned, lastNum, lineText: line };
    }
  }
  return null;
}

function _zeroPadWidth(idStr, prefix) {
  return idStr.length - (prefix.length + 1);
}

function _formatId(prefix, num, padWidth) {
  const s = String(num);
  if (s.length >= padWidth) return `${prefix}-${s}`;
  return `${prefix}-${s.padStart(padWidth, '0')}`;
}

function _bumpRow(row, count) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`_bumpRow: count must be positive integer, got ${count}`);
  }
  const padWidth = _zeroPadWidth(row.nextId, row.prefix);
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(_formatId(row.prefix, row.nextNum + i, padWidth));
  }
  const newNextNum = row.nextNum + count;
  const newLastNum = row.nextNum + count - 1;
  const newRow = {
    ...row,
    nextNum: newNextNum,
    nextId: _formatId(row.prefix, newNextNum, padWidth),
    lastNum: newLastNum,
    lastAssigned: _formatId(row.prefix, newLastNum, padWidth),
  };
  return { ids, newRow };
}

function _rewriteRow(text, oldRow, newRow) {
  const cells = oldRow.lineText.split('|').slice(1, -1);
  const seqWidth = cells[0].length - 2;
  const nextWidth = cells[1].length - 2;
  const lastWidth = cells[2].length - 2;
  const fmt = (val, width) => ` ${val.padEnd(width, ' ')} `;
  const newLine =
    '|' +
    fmt(newRow.sequence, seqWidth) +
    '|' +
    fmt(newRow.nextId, nextWidth) +
    '|' +
    fmt(newRow.lastAssigned, lastWidth) +
    '|';
  return text.replace(oldRow.lineText, newLine);
}

class IdAllocator {
  constructor({ root }) {
    this._registryPath = path.join(root, ID_REGISTRY_REL);
  }

  async allocate(sequence, count = 1) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(`IdAllocator.allocate: count must be positive integer, got ${count}`);
    }
    let returned;
    await withFileLock(this._registryPath, async () => {
      const text = fs.readFileSync(this._registryPath, 'utf8');
      const row = _parseRow(text, sequence);
      if (!row) throw new Error(`IdAllocator.allocate: sequence "${sequence}" not found in ${this._registryPath}`);
      const { ids, newRow } = _bumpRow(row, count);
      const next = _rewriteRow(text, row, newRow);
      const tmp = this._registryPath + '.tmp';
      fs.writeFileSync(tmp, next);
      fs.renameSync(tmp, this._registryPath);
      returned = count === 1 ? ids[0] : ids;
    });
    return returned;
  }
}

module.exports = { IdAllocator, _parseRow, _bumpRow, _rewriteRow, _prefixFor, _formatId };
