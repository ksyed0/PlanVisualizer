'use strict';

/**
 * Extracts all fenced code blocks (``` ... ```) from markdown text.
 * Returns array of block content strings.
 */
function extractCodeBlocks(md) {
  // Line-by-line state machine — correctly handles adjacent fences like
  // ```\n\n``` which previously broke regex-based pairing and dropped content
  // between the empty-block pair and the next real block (BUG-0158).
  const blocks = [];
  const lines = md.split('\n');
  let inBlock = false;
  let buf = [];
  for (const line of lines) {
    if (/^```/.test(line)) {
      if (inBlock) {
        blocks.push(buf.join('\n') + '\n');
        buf = [];
      }
      inBlock = !inBlock;
    } else if (inBlock) {
      buf.push(line);
    }
  }
  return blocks;
}

/**
 * Parse "None" or comma-separated IDs into an array.
 */
function parseDeps(val) {
  if (!val || val.trim() === 'None' || val.trim() === '') return [];
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse a single epic block into an object.
 */
function parseEpicBlock(text) {
  const idTitle = text.match(/^(EPIC-\d{4}):\s*(.+)/m);
  if (!idTitle) return null;
  const get = (key) => {
    const m = text.match(new RegExp(`^${key}:[ \\t]*(.*)`, 'm'));
    return m ? m[1].trim() : '';
  };
  return {
    id: idTitle[1],
    title: idTitle[2].trim(),
    description: get('Description'),
    releaseTarget: get('Release Target'),
    status: get('Status'),
    startDate: get('StartDate') || null,
    doneDate: get('DoneDate') || null,
    dependencies: parseDeps(get('Dependencies')),
  };
}

/**
 * Parse acceptance criteria lines.
 * Format: `  - [ ] AC-XXXX: Text` or `  - [x] AC-XXXX: Text`
 */
function parseACs(text) {
  const acs = [];
  const re = /- \[( |x)\] (AC-\d{4}|AC-TBD):\s*(.+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    acs.push({ id: m[2], text: m[3].trim(), done: m[1] === 'x' });
  }
  return acs;
}

/**
 * Parse a single user story block.
 */
function parseStoryBlock(text) {
  const header = text.match(/^(US-\d{4})\s*\((EPIC-\d{4})\):\s*(.+)/m);
  if (!header) return null;
  const get = (key) => {
    const m = text.match(new RegExp(`^${key}:[ \\t]*(.*)`, 'm'));
    return m ? m[1].trim() : '';
  };
  const priorityRaw = get('Priority');
  const priorityMatch = priorityRaw.match(/\((P\d)\)/);
  let priority = priorityMatch ? priorityMatch[1] : priorityRaw;
  if (!priorityMatch && priorityRaw) {
    const levelMatch = priorityRaw.match(/^(High|Medium|Low)/i);
    if (levelMatch) priority = levelMatch[1];
  }
  return {
    id: header[1],
    epicId: header[2],
    title: header[3].trim(),
    priority: priority,
    estimate: get('Estimate'),
    status: get('Status'),
    branch: get('Branch'),
    acs: parseACs(text),
    dependencies: parseDeps(get('Dependencies')),
  };
}

/**
 * Parse a single task block.
 */
function parseTaskBlock(text) {
  const header = text.match(/^(TASK-\d{4})\s*\((US-\d{4})\):\s*(.+)/m);
  if (!header) return null;
  const get = (key) => {
    const m = text.match(new RegExp(`^${key}:[ \\t]*(.*)`, 'm'));
    return m ? m[1].trim() : '';
  };
  return {
    id: header[1],
    storyId: header[2],
    title: header[3].trim(),
    type: get('Type'),
    assignee: get('Assignee'),
    status: get('Status'),
    branch: get('Branch'),
    notes: get('Notes'),
  };
}

/**
 * Main parser. Returns { epics, stories, tasks }.
 */
function parseReleasePlan(markdown) {
  // Structural approach: regardless of code-fence placement, find every line
  // that looks like an EPIC/US/TASK header and collect the following lines
  // until the next header or a blank-line-separated delimiter. Robust to
  // Prettier-added blank lines and adjacent empty-fence pairs that previously
  // broke code-block based extraction (BUG-0158).
  const epics = [],
    stories = [],
    tasks = [];
  const seenEpics = new Set(),
    seenStories = new Set(),
    seenTasks = new Set();

  // Split the document into chunks by blank lines, ignoring fence markers.
  const cleaned = markdown.replace(/^```[^\n]*$/gm, '');
  const chunks = cleaned.split(/\n{2,}/);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    if (/^EPIC-\d{4}:/.test(trimmed)) {
      const e = parseEpicBlock(trimmed);
      if (e && !seenEpics.has(e.id)) {
        seenEpics.add(e.id);
        epics.push(e);
      }
    } else if (/^US-\d{4}\s*\(EPIC-/.test(trimmed)) {
      const s = parseStoryBlock(trimmed);
      if (s && !seenStories.has(s.id)) {
        seenStories.add(s.id);
        stories.push(s);
      }
    } else if (/^TASK-\d{4}\s*\(US-/.test(trimmed)) {
      const t = parseTaskBlock(trimmed);
      if (t && !seenTasks.has(t.id)) {
        seenTasks.add(t.id);
        tasks.push(t);
      }
    }
  }

  return { epics, stories, tasks };
}

module.exports = { parseReleasePlan };
