'use strict';

function parseBugs(markdown) {
  const results = [];
  // Match both "BUG-0001: title" and "### BUG-0001: title" formats
  const re = /^(?:#{1,4}\s+)?(BUG-\d{4}):\s*(.+)$/gm;
  let match;
  while ((match = re.exec(markdown)) !== null) {
    const id = match[1];
    const title = match[2].trim();
    const startIdx = match.index;
    const nextRe = /^(?:#{1,4}\s+)?BUG-\d{4}:/gm;
    nextRe.lastIndex = startIdx + 1;
    const nextResult = nextRe.exec(markdown);
    const block = markdown.slice(startIdx, nextResult ? nextResult.index : undefined);

    const get = (key) => {
      // Match both "Key: value" and "- **Key:** value" formats
      const m =
        block.match(new RegExp(`^-\\s*\\*\\*${key}:\\*\\*\\s*(.+)`, 'm')) ||
        block.match(new RegExp(`^${key}:[ \\t]*(.+)`, 'm'));
      return m ? m[1].trim() : '';
    };

    results.push({
      id,
      title,
      severity: get('Severity'),
      relatedStory: get('Story') || get('Related Story'),
      relatedTask: get('Related Task'),
      status: get('Status'),
      fixBranch: get('Fix Branch'),
      lessonEncoded: get('Lesson Encoded'),
      estimatedCostUsd: parseFloat(get('Estimated Cost USD')) || 0,
    });
  }
  return results;
}

module.exports = { parseBugs };
