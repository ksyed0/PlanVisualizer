'use strict';

function parseRecentActivity(markdown, limit = 5) {
  const sessions = [];
  const re = /^## Session \d+ — (\d{4}-\d{2}-\d{2})/gm;
  let match;
  while ((match = re.exec(markdown)) !== null) {
    const date = match[1];
    const startIdx = match.index;
    const nextRe = /^## Session/gm;
    nextRe.lastIndex = startIdx + 1;
    const nextResult = nextRe.exec(markdown);
    const block = markdown.slice(startIdx, nextResult ? nextResult.index : undefined);
    const doneMatch = block.match(/### What Was Done\n([\s\S]*?)(?=\n###|\n---|\n##|$)/);
    const summary = doneMatch
      ? doneMatch[1].replace(/^- /gm, '').trim().split('\n').slice(0, 3).join('; ')
      : '';
    sessions.push({ date, summary });
  }
  return sessions.slice(0, limit);
}

module.exports = { parseRecentActivity };
