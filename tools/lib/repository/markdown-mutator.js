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

/**
 * For files where entities are NOT in fenced blocks. Splices the line
 * range from the first line matching `startRe` to the line BEFORE the
 * next `nextRe` match (or end-of-file). Pure-string helper — callers
 * own the file-lock and atomic write.
 */
function replaceUnfencedRange(text, startRe, nextRe, mutator) {
  const lines = text.split('\n');
  let i = lines.findIndex((l) => startRe.test(l));
  if (i < 0) throw new Error(`replaceUnfencedRange: startRe ${startRe} not found`);
  let j = i + 1;
  while (j < lines.length && !nextRe.test(lines[j])) j++;
  const body = lines.slice(i, j).join('\n') + '\n';
  const newBody = mutator(body);
  const newLines = newBody.replace(/\n$/, '').split('\n');
  const out = [...lines.slice(0, i), ...newLines, ...lines.slice(j)].join('\n');
  return out;
}

module.exports = { replaceBlockInText, replaceBlock, replaceUnfencedRange };
