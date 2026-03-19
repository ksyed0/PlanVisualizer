'use strict';

function parseLessons(markdown) {
  const results = [];
  const re = /^## (L-\d{4}) — (.+)$/gm;
  let match;
  while ((match = re.exec(markdown)) !== null) {
    const id = match[1];
    const title = match[2].trim();
    const startIdx = match.index;
    const nextRe = /^## L-\d{4}/gm;
    nextRe.lastIndex = startIdx + 1;
    const next = nextRe.exec(markdown);
    const block = markdown.slice(startIdx, next ? next.index : undefined);
    const ruleM = block.match(/\*\*Rule:\*\*\s*(.+?)(?=\n\*|\n\*\*Date|\n---|\n## |$)/s);
    const ctxM  = block.match(/\n\*([^*]+)\*/);
    const dateM = block.match(/\*\*Date:\*\*\s*(\S+)/);
    results.push({
      id,
      title,
      rule: ruleM ? ruleM[1].trim() : '',
      context: ctxM ? ctxM[1].trim() : '',
      date: dateM ? dateM[1].trim() : '',
    });
  }
  return results;
}

module.exports = { parseLessons };
