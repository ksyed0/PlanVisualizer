'use strict';

const fs = require('fs');
const { withFileLock } = require('./file-lock');
const { findBlockRange } = require('./serializers/_fence-utils');

/**
 * Pure-string version of replaceBlock — extracts the body between the
 * fences of the block whose first non-empty line matches `idRegex`,
 * passes it to `mutator(bodyText) -> newBodyText`, and returns a new
 * document with the new body spliced in. Throws if no block matches.
 */
function replaceBlockInText(text, idRegex, mutator) {
  const range = findBlockRange(text, idRegex);
  if (!range) {
    throw new Error(`replaceBlockInText: block matching ${idRegex} not found`);
  }
  const fullBlock = text.slice(range.start, range.end);
  const openFenceEnd = fullBlock.indexOf('\n') + 1;
  const trimmed = fullBlock.replace(/```\s*\n?$/, '');
  const closeFenceStart = trimmed.length;
  const body = fullBlock.slice(openFenceEnd, closeFenceStart);
  const newBody = mutator(body);
  const newBlock = fullBlock.slice(0, openFenceEnd) + newBody + fullBlock.slice(closeFenceStart);
  return text.slice(0, range.start) + newBlock + text.slice(range.end);
}

/**
 * Filesystem version — acquires withFileLock(path), reads, mutates via
 * replaceBlockInText, writes via tmp+rename.
 */
async function replaceBlock({ path: filePath, idRegex, mutator }) {
  return withFileLock(filePath, async () => {
    const text = fs.readFileSync(filePath, 'utf8');
    const next = replaceBlockInText(text, idRegex, mutator);
    if (next === text) return { changed: false };
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, next);
    fs.renameSync(tmp, filePath);
    return { changed: true };
  });
}

module.exports = { replaceBlockInText, replaceBlock };
