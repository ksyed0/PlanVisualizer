'use strict';

function parseStatus(raw) {
  if (/\[x\] Pass/i.test(raw)) return 'Pass';
  if (/\[x\] Fail/i.test(raw)) return 'Fail';
  return 'Not Run';
}

function parseTestCases(markdown) {
  const results = [];
  const re = /^(TC-\d{4}):\s*(.+)$/gm;
  let match;
  while ((match = re.exec(markdown)) !== null) {
    const id = match[1];
    const title = match[2].trim();
    const startIdx = match.index;
    const nextRe = /^TC-\d{4}:/gm;
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
      relatedStory: get('Related Story'),
      relatedTask: get('Related Task'),
      relatedAC: get('Related AC'),
      type: get('Type'),
      status: parseStatus(get('Status')),
      defect: get('Defect Raised') || 'None',
    });
  }
  return results;
}

module.exports = { parseTestCases };
