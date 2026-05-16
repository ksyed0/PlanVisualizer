'use strict';

const CANONICAL_AGENTS = [
  'Compass',
  'Palette',
  'Pixel',
  'Keystone',
  'Lens',
  'Forge',
  'Sentinel',
  'Circuit',
  'Conductor',
];

function parseStoryACs(specContent) {
  if (typeof specContent !== 'string') return null;
  const headingRe = /^##\s+\d*\.?\s*Acceptance Criteria/im;
  const match = specContent.match(headingRe);
  if (!match) return null;
  const after = specContent.slice(match.index + match[0].length);
  const nextHeading = after.search(/^##\s+/m);
  const section = nextHeading >= 0 ? after.slice(0, nextHeading) : after;

  const items = [];
  const bulletRe = /^[-*]\s+\*{0,2}(AC-\d+)\*{0,2}:?\s*(.+)$/gm;
  let m;
  while ((m = bulletRe.exec(section)) !== null) {
    const id = m[1];
    const body = m[2]
      .trim()
      .replace(/^\*+\s*/, '')
      .replace(/\*\*$/, '');
    items.push(`${id}: ${body}`);
  }
  return items.length > 0 ? items : null;
}

function parsePlanBlock(planContent, n) {
  if (typeof planContent !== 'string' || !Number.isInteger(n) || n < 1) return null;
  const headingRe = /^##\s+Task\s+\d+\b[^\n]*$/gim;
  const matches = [];
  let m;
  while ((m = headingRe.exec(planContent)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
  }
  if (matches.length === 0) return null;
  if (n > matches.length) return null;

  const target = matches[n - 1];
  const start = target.index;
  const next = matches[n];
  const end = next ? next.index : planContent.length;
  const block = planContent.slice(start, end).trimEnd();
  return { block, totalTasks: matches.length };
}

function filterLessons(lessonsContent, agentName) {
  if (typeof lessonsContent !== 'string' || typeof agentName !== 'string') return [];
  const out = [];
  const entryRe = /^##\s+(L-\d+)\s+—\s+(.+)$/gm;
  let m;
  while ((m = entryRe.exec(lessonsContent)) !== null) {
    const id = m[1];
    const title = m[2].trim();
    const after = lessonsContent.slice(m.index + m[0].length);
    const nextHeading = after.search(/^##\s+/m);
    const body = nextHeading >= 0 ? after.slice(0, nextHeading) : after;
    const tagMatch = body.match(/^@agent:\s*(.+)$/m);
    if (!tagMatch) continue;
    const tags = tagMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (tags.includes('all') || tags.includes(agentName)) {
      out.push({ id, title });
    }
  }
  return out;
}

function validateLessonsTags(lessonsContent) {
  if (typeof lessonsContent !== 'string') {
    return { taggedCount: 0, untaggedCount: 0, invalidNames: [] };
  }
  const valid = new Set([...CANONICAL_AGENTS, 'all']);
  let taggedCount = 0;
  let untaggedCount = 0;
  const invalidNames = new Set();
  const entryRe = /^##\s+L-\d+\s+—/gm;
  let m;
  const positions = [];
  while ((m = entryRe.exec(lessonsContent)) !== null) positions.push(m.index);
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : lessonsContent.length;
    const body = lessonsContent.slice(start, end);
    const tagMatch = body.match(/^@agent:\s*(.+)$/m);
    if (!tagMatch) {
      untaggedCount++;
      continue;
    }
    taggedCount++;
    const tags = tagMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const t of tags) {
      if (!valid.has(t)) invalidNames.add(t);
    }
  }
  return { taggedCount, untaggedCount, invalidNames: Array.from(invalidNames) };
}

function _renderPriorTasks(priorTasks) {
  return [...priorTasks]
    .sort((a, b) => (a.planTaskIndex || 0) - (b.planTaskIndex || 0))
    .map((t) => {
      const idx = t.planTaskIndex !== null && t.planTaskIndex !== undefined ? t.planTaskIndex : '?';
      const head = `- Task ${idx} (${t.state})`;
      const main = t.summary ? `${head}: ${t.summary}` : head;
      if (t.state === 'done_with_concerns' && t.concerns) {
        return `${main}\n  - Concern: ${t.concerns}`;
      }
      return main;
    })
    .join('\n');
}

function _quotePlanBlock(block) {
  return block
    .split('\n')
    .map((line) => '> ' + line)
    .join('\n');
}

function assemble(input) {
  const { story, agent, task, planTaskIndex, totalTasks, ACs, planBlock, priorTasks, lessons } = input;

  const header =
    planTaskIndex !== null && planTaskIndex !== undefined
      ? `## Context for ${agent} — ${story} (Task ${planTaskIndex}/${totalTasks || '?'})`
      : `## Context for ${agent} — ${story}`;

  const parts = [header, '', '### Your task', '', task.description];

  if (Array.isArray(ACs) && ACs.length > 0) {
    parts.push('', '### Story acceptance criteria', '');
    for (const ac of ACs) parts.push(`- ${ac}`);
  }

  if (typeof planBlock === 'string' && planBlock.length > 0) {
    parts.push('', '### Plan excerpt', '', _quotePlanBlock(planBlock));
  }

  if (Array.isArray(priorTasks) && priorTasks.length > 0) {
    parts.push('', '### Prior work on this story', '', _renderPriorTasks(priorTasks));
  }

  if (Array.isArray(lessons) && lessons.length > 0) {
    parts.push('', `### Relevant lessons for ${agent}`, '');
    for (const l of lessons) parts.push(`- **${l.id}** — ${l.title}`);
  }

  return parts.join('\n') + '\n';
}

module.exports = {
  CANONICAL_AGENTS,
  parseStoryACs,
  parsePlanBlock,
  filterLessons,
  validateLessonsTags,
  assemble,
};
