'use strict';

function parseBugs(markdown) {
  const results = [];
  const re = /^(BUG-\d{4}):\s*(.+)$/gm;
  let match;
  while ((match = re.exec(markdown)) !== null) {
    const id = match[1];
    const title = match[2].trim();
    const startIdx = match.index;
    const nextRe = /^BUG-\d{4}:/gm;
    nextRe.lastIndex = startIdx + 1;
    const nextResult = nextRe.exec(markdown);
    const block = markdown.slice(startIdx, nextResult ? nextResult.index : undefined);

    const get = (key) => {
      const m = block.match(new RegExp(`^${key}:[ \\t]*(.+)`, 'm'));
      return m ? m[1].trim() : '';
    };

    results.push({
      id,
      title,
      severity: get('Severity'),
      relatedStory: get('Related Story'),
      relatedTask: get('Related Task'),
      status: get('Status'),
      fixBranch: get('Fix Branch'),
      lessonEncoded: get('Lesson Encoded'),
    });
  }
  return results;
}

module.exports = { parseBugs };
