'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const Lifecycle = require('../../tools/agent-lifecycle');
const Context = require('../../tools/agent-context');

function mkProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-context-int-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs/sdlc-status.json'),
    JSON.stringify({
      stories: { 'US-0184': { planPhase: { planPath: 'docs/plan.md' } } },
      tasks: {},
    }),
  );
  fs.writeFileSync(path.join(root, 'docs/plan.md'), '## Task 1: First\n\nstep one\n\n## Task 2: Second\n\nstep two\n');
  fs.writeFileSync(path.join(root, 'docs/LESSONS.md'), '');
  return root;
}

test('start → done(summary) → start → generate yields prior-work containing the first summary', () => {
  const root = mkProject();
  const sdlcPath = path.join(root, 'docs/sdlc-status.json');
  const out = [];

  // Task 1 start + done with summary
  Lifecycle.dispatch(
    { cmd: 'start', story: 'US-0184', agent: 'Forge', task: 'first task', planTaskIndex: 1 },
    { sdlcPath, stdout: (s) => out.push(s), skipRegen: true },
  );
  const data1 = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  const task1Id = Object.keys(data1.tasks)[0];
  Lifecycle.dispatch(
    { cmd: 'done', taskId: task1Id, summary: 'Implemented first thing [sha:abc1234]' },
    { sdlcPath, stdout: () => {}, skipRegen: true },
  );

  // Task 2 start
  Lifecycle.dispatch(
    { cmd: 'start', story: 'US-0184', agent: 'Forge', task: 'second task', planTaskIndex: 2 },
    { sdlcPath, stdout: () => {}, skipRegen: true },
  );
  const data2 = JSON.parse(fs.readFileSync(sdlcPath, 'utf8'));
  const task2Id = Object.values(data2.tasks).find((t) => t.id !== task1Id).id;

  // generate context for task 2
  const payload = [];
  const rc = Context.dispatch(
    { cmd: 'generate', story: 'US-0184', agent: 'Forge', taskId: task2Id },
    { root, stdout: (s) => payload.push(s), stderr: () => {} },
  );

  expect(rc).toBe(0);
  const md = payload.join('');
  expect(md).toContain('## Context for Forge — US-0184 (Task 2/2)');
  expect(md).toContain('### Prior work on this story');
  expect(md).toContain('Task 1 (done): Implemented first thing');
  expect(md).toContain('### Plan excerpt');
  expect(md).toContain('## Task 2: Second');
});
