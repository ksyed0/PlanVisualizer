'use strict';
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', '..', 'docs', 'agents');

function read(file) {
  return fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
}

// NOTE TO MAINTAINERS: these section names are the protocol's public API.
// Renames require coordinated updates across all listed files AND this test.
// Brittleness is intentional.

describe('agent-files protocol contract', () => {
  test('DM_AGENT.md contains ## Pre-Dispatch Spec & Plan Orchestration', () => {
    expect(read('DM_AGENT.md')).toMatch(/^## Pre-Dispatch Spec & Plan Orchestration$/m);
  });

  test('PO_AGENT.md contains ## Spec Brainstorming Protocol', () => {
    expect(read('PO_AGENT.md')).toMatch(/^## Spec Brainstorming Protocol$/m);
  });

  test('PO_AGENT.md contains ## Spec Output Schema', () => {
    expect(read('PO_AGENT.md')).toMatch(/^## Spec Output Schema$/m);
  });

  test('ARCHITECT_AGENT.md contains ## Plan Writing Protocol', () => {
    expect(read('ARCHITECT_AGENT.md')).toMatch(/^## Plan Writing Protocol$/m);
  });

  test('ARCHITECT_AGENT.md contains ## Self-Review Checklist', () => {
    expect(read('ARCHITECT_AGENT.md')).toMatch(/^## Self-Review Checklist$/m);
  });

  test('UI_DESIGNER_AGENT.md contains ## Spec Contribution Protocol', () => {
    expect(read('UI_DESIGNER_AGENT.md')).toMatch(/^## Spec Contribution Protocol$/m);
  });

  test('FE_DEV_AGENT.md contains ## UI Mockup Protocol', () => {
    expect(read('FE_DEV_AGENT.md')).toMatch(/^## UI Mockup Protocol$/m);
  });

  test('CODE_REVIEWER_AGENT.md contains ## Spec/Plan Review Protocol', () => {
    expect(read('CODE_REVIEWER_AGENT.md')).toMatch(/^## Spec\/Plan Review Protocol$/m);
  });

  test('CODE_REVIEWER_AGENT.md contains canonical @persona list', () => {
    const text = read('CODE_REVIEWER_AGENT.md');
    expect(text).toContain('@compass');
    expect(text).toContain('@palette');
    expect(text).toContain('@pixel');
    expect(text).toContain('@keystone');
    expect(text).toContain('@lens');
    expect(text).toContain('@plan-author');
  });
});

describe('DM_AGENT.md — US-0184 updates to Per-Task Dispatch Ritual', () => {
  const fs = require('fs');
  const path = require('path');
  const content = fs.readFileSync(path.join(__dirname, '../../docs/agents/DM_AGENT.md'), 'utf8');

  test('start command example includes --plan-task-index flag', () => {
    expect(content).toMatch(/--plan-task-index/);
  });

  test('step 1b context-generation block uses agent-context.js generate', () => {
    expect(content).toMatch(/node tools\/agent-context\.js generate/);
    expect(content).toMatch(/CONTEXT=\$\(node tools\/agent-context\.js/);
  });

  test('done command row includes --summary flag', () => {
    expect(content).toMatch(/agent-lifecycle\.js done[^\n]*--summary/);
  });
});

describe('DM_AGENT.md — US-0185 review gate + automated BLOCKED routing', () => {
  const fs = require('fs');
  const path = require('path');
  const content = fs.readFileSync(path.join(__dirname, '../../docs/agents/DM_AGENT.md'), 'utf8');

  test('captures BASE_SHA before TASK_ID assignment', () => {
    expect(content).toMatch(
      /BASE_SHA=\$\(git rev-parse HEAD\)\s*\n\s*TASK_ID=\$\(node tools\/agent-lifecycle\.js start/,
    );
  });

  test('step 3b uses agent-task-review.js start', () => {
    expect(content).toMatch(/node tools\/agent-task-review\.js start/);
  });

  test('handles SKIP_REVIEW token branch', () => {
    expect(content).toMatch(/SKIP_REVIEW/);
  });

  test('step 3c dispatches Lens for spec compliance and uses spec-verdict', () => {
    expect(content).toMatch(/agent-task-review\.js spec-verdict/);
    expect(content).toMatch(/PROCEED_TO_QUALITY/);
  });

  test('step 3d uses quality-verdict and TASK_CLEARED branch', () => {
    expect(content).toMatch(/agent-task-review\.js quality-verdict/);
    expect(content).toMatch(/TASK_CLEARED/);
  });

  test('forge-retry is called with --triggered-by', () => {
    expect(content).toMatch(/agent-task-review\.js forge-retry[\s\S]+--triggered-by/);
  });

  test('automated BLOCKED routing handles MORE_CONTEXT and UPGRADE_MODEL', () => {
    expect(content).toMatch(/MORE_CONTEXT[\s\S]+UPGRADE_MODEL/);
    expect(content).toMatch(/haiku|sonnet|opus/);
  });

  test('SPLIT_TASK and ESCALATE_HUMAN both halt and surface', () => {
    expect(content).toMatch(/SPLIT_TASK\)[\s\S]+progress\.md/);
    expect(content).toMatch(/ESCALATE_HUMAN\)[\s\S]+progress\.md/);
  });
});

describe('Forge agent files — US-0185 §Commit SHA Reporting', () => {
  const fs = require('fs');
  const path = require('path');

  for (const file of ['BE_DEV_AGENT.md', 'FE_DEV_AGENT.md']) {
    describe(file, () => {
      const content = fs.readFileSync(path.join(__dirname, '../../docs/agents/', file), 'utf8');

      test('contains §Commit SHA Reporting section', () => {
        expect(content).toMatch(/## Commit SHA Reporting/);
      });

      test('documents [sha:<commit>] token format', () => {
        expect(content).toMatch(/\[sha:.*<commit>.*\]/);
      });

      test('documents [sha:none] for no-commit tasks', () => {
        expect(content).toMatch(/\[sha:none\]/);
      });

      test('states that done and done_with_concerns require the token', () => {
        expect(content).toMatch(/done.*and.*done_with_concerns/);
      });
    });
  }
});
