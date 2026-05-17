'use strict';
const { renderPendingApprovalsWidget } = require('../../tools/lib/render-tabs');

function mkData(stories) {
  return { stories };
}

describe('renderPendingApprovalsWidget', () => {
  test('renders empty state when no pending approvals', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0001': { specPhase: { state: 'approved' }, planPhase: { state: 'approved' } },
      }),
    );
    expect(html).toContain('No pending approvals');
  });

  test('renders awaiting_ac_approval row', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_ac_approval' }, planPhase: { state: 'pending' } },
      }),
    );
    expect(html).toContain('US-0181');
    expect(html).toContain('AC');
    expect(html).toContain('approve-US-0181-ac');
  });

  test('renders awaiting_spec_approval row', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_spec_approval' }, planPhase: { state: 'pending' } },
      }),
    );
    expect(html).toContain('US-0181');
    expect(html).toContain('Spec');
  });

  test('renders awaiting_plan_approval row', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'approved' }, planPhase: { state: 'awaiting_plan_approval' } },
      }),
    );
    expect(html).toContain('Plan');
  });

  test('Approve button has correct data attributes for flag download', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_ac_approval' }, planPhase: { state: 'pending' } },
      }),
    );
    expect(html).toMatch(/data-story="US-0181"/);
    expect(html).toMatch(/data-gate="ac"/);
    expect(html).toMatch(/data-action="approve"/);
  });

  test('Reject button shows reason textarea', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_ac_approval' }, planPhase: { state: 'pending' } },
      }),
    );
    expect(html).toMatch(/data-action="reject"/);
    expect(html).toMatch(/<textarea[^>]*data-reason-for="US-0181-ac"/);
  });

  test('lists multiple pending stories', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0181': { specPhase: { state: 'awaiting_ac_approval' }, planPhase: { state: 'pending' } },
        'US-0182': { specPhase: { state: 'approved' }, planPhase: { state: 'awaiting_plan_approval' } },
      }),
    );
    expect(html).toContain('US-0181');
    expect(html).toContain('US-0182');
  });

  test('handles stories without orchestration state gracefully', () => {
    const html = renderPendingApprovalsWidget(
      mkData({
        'US-0001': { status: 'Done' },
      }),
    );
    expect(html).toContain('No pending approvals');
  });

  test('handles stories supplied as an array (from parseReleasePlan)', () => {
    // parseReleasePlan returns stories as an array of {id, ...} records.
    // generate-plan.js merges specPhase from sdlc-status.json onto each.
    const html = renderPendingApprovalsWidget({
      stories: [
        {
          id: 'US-0001',
          title: 'Test',
          status: 'In Progress',
          specPhase: { state: 'awaiting_ac_approval' },
          planPhase: { state: 'pending' },
        },
        { id: 'US-0002', title: 'Other', status: 'Planned' },
      ],
    });
    expect(html).toContain('US-0001');
    expect(html).toContain('AC');
    expect(html).not.toContain('US-0002');
  });
});
