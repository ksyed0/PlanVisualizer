'use strict';

/**
 * Find the half-open [start, end) character range of the fenced code block
 * (``` ... ```) in `text` whose body's first non-empty line matches `idRe`.
 * Returns null if no matching block exists.
 *
 * The returned range includes the opening fence line, the body, the closing
 * fence line, and the trailing newline of the closing fence (so splicing
 * a replacement of the same shape preserves the surrounding blank-line
 * structure byte-for-byte).
 */
function findBlockRange(text, idRe) {
  const FENCE = /^```\s*$/;
  const lines = text.split('\n');
  let cursor = 0;
  const lineStarts = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    lineStarts[i] = cursor;
    cursor += lines[i].length + 1;
  }

  for (let i = 0; i < lines.length; i++) {
    if (!FENCE.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && !FENCE.test(lines[j])) j++;
    if (j >= lines.length) return null;
    for (let b = i + 1; b < j; b++) {
      const trimmed = lines[b].trim();
      if (!trimmed) continue;
      if (idRe.test(trimmed)) {
        const start = lineStarts[i];
        const end = j + 1 < lines.length ? lineStarts[j + 1] : text.length;
        return { start, end, openFenceLine: i, closeFenceLine: j };
      }
      break;
    }
    i = j;
  }
  return null;
}

function joinLines(lines) {
  if (lines.length === 0) return '';
  return lines.join('\n') + '\n';
}

module.exports = { findBlockRange, joinLines };
