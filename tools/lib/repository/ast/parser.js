'use strict';

/**
 * Parse markdown into an ordered AST of prose segments and fenced code blocks.
 *
 * Node shapes:
 *   { kind: 'prose',  text }
 *   { kind: 'fenced', fence, info, body, raw }
 *
 * Invariant: concatenating ast[i].text (for prose) and ast[i].raw (for fenced)
 * in order reproduces the original input byte-identically.
 *
 * Fence semantics: a fenced block's raw spans from the opening marker line's
 * first character up to (but not including) the newline that terminates the
 * closing marker line. The newline that follows the closing marker — and any
 * subsequent prose — belongs to the next prose node. This keeps blank lines
 * between blocks visible to the prose round-trip assertion.
 */
function parseMarkdown(src) {
  const ast = [];
  const lines = src.split('\n');

  // Character offsets for each line's start.
  const lineStart = new Array(lines.length);
  let off = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStart[i] = off;
    off += lines[i].length;
    if (i < lines.length - 1) off += 1; // newline consumed by split
  }
  const totalLen = src.length;

  function lineContentEnd(i) {
    return lineStart[i] + lines[i].length;
  }

  let proseStartOffset = 0;
  let inFence = false;
  let fenceStartLine = 0;
  let fenceMarker = '';
  let fenceInfo = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inFence) {
      const m = line.match(/^\s*(```+|~~~+)(.*)$/);
      if (m) {
        const openOffset = lineStart[i];
        if (openOffset > proseStartOffset) {
          ast.push({ kind: 'prose', text: src.slice(proseStartOffset, openOffset) });
        }
        proseStartOffset = openOffset;
        inFence = true;
        fenceStartLine = i;
        fenceMarker = m[1];
        fenceInfo = m[2];
      }
    } else {
      const closeRe = new RegExp('^\\s*' + fenceMarker + '\\s*$');
      if (closeRe.test(line)) {
        const body = lines.slice(fenceStartLine + 1, i).join('\n');
        const rawEnd = lineContentEnd(i);
        const raw = src.slice(lineStart[fenceStartLine], rawEnd);
        ast.push({ kind: 'fenced', fence: fenceMarker, info: fenceInfo, body, raw });
        inFence = false;
        proseStartOffset = rawEnd;
      }
    }
  }

  // Unterminated fence: fall back to treating its region as prose to preserve
  // byte-identical round-trip. proseStartOffset already points at the start of
  // the opener (we never advanced it past an unclosed fence), so the remaining
  // slice below covers the orphan content.
  if (proseStartOffset < totalLen) {
    ast.push({ kind: 'prose', text: src.slice(proseStartOffset) });
  }

  return ast;
}

module.exports = { parseMarkdown };
