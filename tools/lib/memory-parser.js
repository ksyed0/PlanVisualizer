'use strict';

/**
 * Parse a MEMORY.md document into sections.
 *
 * @param {string} text - Raw markdown text.
 * @returns {{ header: string, sections: Array<{heading: string, body: string, raw: string}> }}
 */
function parseMemory(text) {
  if (!text) return { header: '', sections: [] };
  const lines = text.split('\n');
  const sections = [];
  let header = '';
  let currentHeading = null;
  let currentLines = [];
  let headerLines = [];
  let inHeader = true;

  const flush = () => {
    if (currentHeading === null) return;
    const raw = `## ${currentHeading}\n${currentLines.join('\n')}`;
    sections.push({
      heading: currentHeading,
      body: currentLines.join('\n').replace(/^\n+/, ''),
      raw,
    });
    currentHeading = null;
    currentLines = [];
  };

  for (const line of lines) {
    const m = line.match(/^## (.+?)\s*$/);
    if (m) {
      if (inHeader) {
        header = headerLines.join('\n');
        inHeader = false;
      }
      flush();
      currentHeading = m[1];
    } else if (inHeader) {
      headerLines.push(line);
    } else {
      currentLines.push(line);
    }
  }
  if (inHeader) header = headerLines.join('\n');
  flush();
  return { header, sections };
}

module.exports = { parseMemory };
