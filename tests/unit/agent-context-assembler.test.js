'use strict';

const path = require('path');
const ASM_PATH = path.join(__dirname, '../../tools/lib/agent-context-assembler');

describe('parseStoryACs', () => {
  test('extracts an AC list from a fenced "Acceptance Criteria:" block', () => {
    const { parseStoryACs } = require(ASM_PATH);
    const spec = `
## 12. Acceptance Criteria (draft for RELEASE_PLAN.md)

- **AC-0720:** First criterion
- **AC-0721:** Second criterion with **bold** text
- **AC-0722:** Third
`;
    expect(parseStoryACs(spec)).toEqual([
      'AC-0720: First criterion',
      'AC-0721: Second criterion with **bold** text',
      'AC-0722: Third',
    ]);
  });

  test('returns null when no Acceptance Criteria section is present', () => {
    const { parseStoryACs } = require(ASM_PATH);
    expect(parseStoryACs('# random spec\n\nnothing about ACs here\n')).toBeNull();
  });

  test('returns null when the AC section exists but has no bullet items', () => {
    const { parseStoryACs } = require(ASM_PATH);
    expect(parseStoryACs('## Acceptance Criteria\n\n(none yet)\n')).toBeNull();
  });
});

describe('parsePlanBlock', () => {
  const PLAN = `# Some Plan

## Task 1: First task

Some content for task 1.

## Task 2: Second task

Multi-line
content for task 2.

## Task 3: Third task

End content.
`;

  test('returns the requested block and total task count', () => {
    const { parsePlanBlock } = require(ASM_PATH);
    const r = parsePlanBlock(PLAN, 2);
    expect(r).not.toBeNull();
    expect(r.totalTasks).toBe(3);
    expect(r.block).toContain('Second task');
    expect(r.block).toContain('Multi-line');
    expect(r.block).not.toContain('Third task');
  });

  test('returns null when n is out of range', () => {
    const { parsePlanBlock } = require(ASM_PATH);
    expect(parsePlanBlock(PLAN, 5)).toBeNull();
    expect(parsePlanBlock(PLAN, 0)).toBeNull();
    expect(parsePlanBlock(PLAN, -1)).toBeNull();
  });

  test('returns null for non-integer n (float)', () => {
    const { parsePlanBlock } = require(ASM_PATH);
    expect(parsePlanBlock(PLAN, 1.5)).toBeNull();
    expect(parsePlanBlock(PLAN, 2.9)).toBeNull();
  });

  test('returns null when no Task headings are present', () => {
    const { parsePlanBlock } = require(ASM_PATH);
    expect(parsePlanBlock('# No tasks here\n\nplain text\n', 1)).toBeNull();
  });

  test('returns the last block (no trailing heading to bound it)', () => {
    const { parsePlanBlock } = require(ASM_PATH);
    const r = parsePlanBlock(PLAN, 3);
    expect(r.block).toContain('Third task');
    expect(r.block).toContain('End content.');
  });
});

describe('filterLessons', () => {
  const LESSONS = `# LESSONS.md

## L-0057 — Use try/catch ENOENT instead of existsSync+readFileSync
@agent: Forge

Body.

## L-0054 — Always dispatch subagents from absolute paths
@agent: Forge, Sentinel

Body.

## L-0050 — Some cross-cutting truth
@agent: all

Body.

## L-0049 — Compass-only thing
@agent: Compass

Body.

## L-0048 — Untagged old lesson

Body.
`;

  test('returns lessons tagged for the requested agent, including @agent: all', () => {
    const { filterLessons } = require(ASM_PATH);
    const r = filterLessons(LESSONS, 'Forge');
    expect(r.map((l) => l.id)).toEqual(['L-0057', 'L-0054', 'L-0050']);
    expect(r[0].title).toMatch(/Use try\/catch ENOENT/);
  });

  test('returns only @agent: all when no agent-specific matches exist', () => {
    const { filterLessons } = require(ASM_PATH);
    const r = filterLessons(LESSONS, 'Pixel');
    expect(r.map((l) => l.id)).toEqual(['L-0050']);
  });

  test('returns [] when no lessons match and there are no all-tagged lessons', () => {
    const { filterLessons } = require(ASM_PATH);
    const noAll = LESSONS.replace('@agent: all', '@agent: Lens');
    expect(filterLessons(noAll, 'Circuit')).toEqual([]);
  });

  test('comma-separated tags match each listed agent', () => {
    const { filterLessons } = require(ASM_PATH);
    expect(filterLessons(LESSONS, 'Sentinel').map((l) => l.id)).toEqual(['L-0054', 'L-0050']);
  });

  test('untagged lessons are not surfaced', () => {
    const { filterLessons } = require(ASM_PATH);
    const all = filterLessons(LESSONS, 'Forge');
    expect(all.map((l) => l.id)).not.toContain('L-0048');
  });
});

describe('validateLessonsTags', () => {
  test('reports tagged + untagged + invalid agent names', () => {
    const { validateLessonsTags } = require(ASM_PATH);
    const content = `
## L-0001 — A
@agent: Forge

## L-0002 — B
@agent: Pixel, NotAnAgent

## L-0003 — C
(untagged)

## L-0004 — D
@agent: all
`;
    const r = validateLessonsTags(content);
    expect(r.taggedCount).toBe(3);
    expect(r.untaggedCount).toBe(1);
    expect(r.invalidNames.sort()).toEqual(['NotAnAgent']);
  });

  test('returns zero counts on empty input', () => {
    const { validateLessonsTags } = require(ASM_PATH);
    expect(validateLessonsTags('')).toEqual({ taggedCount: 0, untaggedCount: 0, invalidNames: [] });
  });
});

describe('assemble', () => {
  const { assemble } = require(ASM_PATH);

  const fullInput = {
    story: 'US-0184',
    agent: 'Forge',
    task: { description: 'Implement parseTaskBlock() in tools/lib/plan-parser.js' },
    planTaskIndex: 3,
    totalTasks: 7,
    ACs: ['AC-0720: First', 'AC-0721: Second'],
    planBlock: '## Task 3: Implement parseTaskBlock()\n\nSteps:\n1. Read plan\n2. Split on headings',
    priorTasks: [
      { state: 'done', summary: 'Added parseHeading() helper', planTaskIndex: 1 },
      { state: 'done_with_concerns', summary: 'Wrote initial tests', concerns: 'edge case untested', planTaskIndex: 2 },
    ],
    lessons: [
      { id: 'L-0057', title: 'Use try/catch ENOENT instead of existsSync+readFileSync' },
      { id: 'L-0054', title: 'Always dispatch subagents from absolute paths' },
    ],
  };

  test('renders all sections when content is present', () => {
    const md = assemble(fullInput);
    expect(md).toMatch(/^## Context for Forge — US-0184 \(Task 3\/7\)/);
    expect(md).toContain('### Your task');
    expect(md).toContain('Implement parseTaskBlock() in tools/lib/plan-parser.js');
    expect(md).toContain('### Story acceptance criteria');
    expect(md).toContain('- AC-0720: First');
    expect(md).toContain('### Plan excerpt');
    expect(md).toContain('> ## Task 3: Implement parseTaskBlock()');
    expect(md).toContain('### Prior work on this story');
    expect(md).toContain('- Task 1 (done): Added parseHeading() helper');
    expect(md).toContain('- Task 2 (done_with_concerns): Wrote initial tests');
    expect(md).toContain('  - Concern: edge case untested');
    expect(md).toContain('### Relevant lessons for Forge');
    expect(md).toContain('- **L-0057**');
  });

  test('drops "(Task N/M)" suffix when planTaskIndex missing', () => {
    const md = assemble({ ...fullInput, planTaskIndex: null });
    expect(md).toMatch(/^## Context for Forge — US-0184\n/);
    expect(md).not.toMatch(/\(Task /);
  });

  test('suppresses "Plan excerpt" section when planBlock is null', () => {
    const md = assemble({ ...fullInput, planBlock: null });
    expect(md).not.toContain('### Plan excerpt');
  });

  test('suppresses "Story acceptance criteria" section when ACs is null', () => {
    const md = assemble({ ...fullInput, ACs: null });
    expect(md).not.toContain('### Story acceptance criteria');
  });

  test('suppresses "Prior work on this story" section when priorTasks is empty', () => {
    const md = assemble({ ...fullInput, priorTasks: [] });
    expect(md).not.toContain('### Prior work on this story');
  });

  test('suppresses "Relevant lessons" section when lessons is empty', () => {
    const md = assemble({ ...fullInput, lessons: [] });
    expect(md).not.toContain('### Relevant lessons');
  });

  test('prior-task summary falls back to bare line when summary is null', () => {
    const md = assemble({
      ...fullInput,
      priorTasks: [{ state: 'done', summary: null, planTaskIndex: 1 }],
    });
    expect(md).toContain('- Task 1 (done)\n');
  });

  test('done_with_concerns prior task renders concern as sub-bullet', () => {
    const md = assemble({
      ...fullInput,
      priorTasks: [
        { state: 'done_with_concerns', summary: 'wrote tests', concerns: 'multi-line\nconcern', planTaskIndex: 2 },
      ],
    });
    expect(md).toContain('  - Concern: multi-line\nconcern');
  });

  test('your task section is always rendered even with everything else empty', () => {
    const md = assemble({
      story: 'US-0184',
      agent: 'Forge',
      task: { description: 'Bare task' },
      planTaskIndex: null,
      totalTasks: 0,
      ACs: null,
      planBlock: null,
      priorTasks: [],
      lessons: [],
    });
    expect(md).toContain('### Your task');
    expect(md).toContain('Bare task');
  });
});
