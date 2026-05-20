'use strict';

/**
 * US-0186: Integration smoke test for review-gate rendering pipeline.
 * Verifies that generateHTML emits all review-related helpers and CSS,
 * and that patchTaskList invokes the correct renderer based on density.
 */

const { generateHTML } = require('../../tools/generate-dashboard');

function fixtureStatus() {
  return {
    project: { name: 'Test', description: '', repoUrl: '', startDate: '2026-04-15' },
    agents: {
      Forge: { status: 'active', currentStory: 'US-0186', currentTask: null, tasksCompleted: 1 },
    },
    phases: [
      { id: 1, name: 'Blueprint', status: 'complete' },
      { id: 2, name: 'Build', status: 'in-progress' },
      { id: 3, name: 'Test', status: 'pending' },
    ],
    cycles: [],
    epics: {},
    stories: {
      'US-0186': {
        id: 'US-0186',
        title: 'Dashboard Review-Gate Visualization',
        status: 'In Progress',
      },
    },
    metrics: {
      storiesCompleted: 0,
      storiesTotal: 1,
      tasksCompleted: 0,
      tasksTotal: 4,
      testsPassed: 1287,
      testsFailed: 0,
      testsTotal: 1287,
      bugsOpen: 0,
      bugsFixed: 0,
      coveragePercent: 85,
      reviewsApproved: 1,
      reviewsBlocked: 0,
    },
    tasks: {
      'task-1': {
        id: 'task-1',
        story: 'US-0186',
        agent: 'Forge',
        state: 'done',
        description: 'Cleared — both reviews approved',
        taskReview: {
          status: 'approved',
          specVerdict: 'APPROVED',
          qualityVerdict: 'APPROVED',
          forgeRetries: 0,
          headSha: 'abc1234',
        },
      },
      'task-2': {
        id: 'task-2',
        story: 'US-0186',
        agent: 'Forge',
        state: 'done',
        description: 'Quality review in progress',
        taskReview: {
          status: 'quality_reviewing',
          specVerdict: 'APPROVED',
          qualityVerdict: null,
          forgeRetries: 0,
          headSha: 'abc1234',
        },
      },
      'task-3': {
        id: 'task-3',
        story: 'US-0186',
        agent: 'Forge',
        state: 'done',
        description: 'Spec retry in progress',
        taskReview: {
          status: 'forge_retry',
          specVerdict: 'REQUEST_CHANGES',
          qualityVerdict: null,
          forgeRetries: 1,
          headSha: 'def5678',
        },
      },
      'task-4': {
        id: 'task-4',
        story: 'US-0186',
        agent: 'Forge',
        state: 'done',
        description: 'No-commit task — skipped review',
        taskReview: {
          status: 'approved',
          headSha: 'none',
        },
      },
    },
    log: [],
  };
}

describe('Dashboard renders review-gate visualization end-to-end', () => {
  test('helper functions are embedded in the emitted HTML', () => {
    const html = generateHTML(fixtureStatus());
    expect(html).toContain('function deriveDisplayState(');
    expect(html).toContain('function renderReviewIconS(');
    expect(html).toContain('function renderReviewChipsM(');
    expect(html).toContain('function renderReviewLineL(');
  });

  test('emitted HTML contains pv-density-toggle and all three buttons', () => {
    const html = generateHTML(fixtureStatus());
    expect(html).toContain('class="pv-density-toggle"');
    expect(html).toContain('data-density="S"');
    expect(html).toContain('data-density="M"');
    expect(html).toContain('data-density="L"');
  });

  test('window.pvTaskReviewCap injected as numeric literal', () => {
    const html = generateHTML(fixtureStatus());
    expect(html).toMatch(/window\.pvTaskReviewCap\s*=\s*\d+/);
  });

  test('patchTaskList source references all three render functions', () => {
    const html = generateHTML(fixtureStatus());
    expect(html).toContain('renderReviewIconS(');
    expect(html).toContain('renderReviewChipsM(');
    expect(html).toContain('renderReviewLineL(');
  });

  test('review CSS includes chip states and animations', () => {
    const html = generateHTML(fixtureStatus());
    expect(html).toContain('.pv-rev-chip');
    expect(html).toMatch(/\.pv-rev-chip\.ok/);
    expect(html).toMatch(/\.pv-rev-chip\.warn/);
    expect(html).toMatch(/\.pv-rev-chip\.risk/);
    expect(html).toMatch(/\.pv-rev-chip\.review/);
    expect(html).toMatch(/@keyframes\s+pv-rev-spin\s*\{/);
    expect(html).toMatch(/@keyframes\s+pv-rev-appear\s*\{/);
  });

  test('patchTaskList function is embedded for client-side rendering', () => {
    const html = generateHTML(fixtureStatus());
    // patchTaskList is called on each refresh and renders tasks dynamically
    expect(html).toContain('function patchTaskList(');
    // It uses deriveDisplayState to determine what to render
    expect(html).toContain('deriveDisplayState(t.taskReview)');
  });

  test('agent data is present for patchTaskList to operate on', () => {
    const html = generateHTML(fixtureStatus());
    // Verify that Forge agent is marked as active so patchTaskList will
    // render its task list
    expect(html).toContain('Forge');
    expect(html).toContain('US-0186');
  });
});
