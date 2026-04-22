'use strict';
const { renderStakeholderTab } = require('../../tools/lib/render-tabs');

// Minimal but complete data fixture for stakeholder tab tests
const mkData = (overrides = {}) => ({
  epics: [
    { id: 'EPIC-0001', title: 'Authentication', status: 'Done' },
    { id: 'EPIC-0002', title: 'Dashboard', status: 'In Progress' },
    { id: 'EPIC-0003', title: 'Retired Epic', status: 'Retired' },
  ],
  stories: [
    {
      id: 'US-0001',
      epicId: 'EPIC-0001',
      title: 'Login form',
      status: 'Done',
      acs: [{ id: 'AC-0001', text: 'User can log in with email', done: true }],
    },
    { id: 'US-0002', epicId: 'EPIC-0001', title: 'Session management', status: 'Done', acs: [] },
    {
      id: 'US-0003',
      epicId: 'EPIC-0002',
      title: 'Kanban board',
      status: 'In Progress',
      acs: [{ id: 'AC-0002', text: 'Board loads within 2s', done: false }],
    },
    { id: 'US-0004', epicId: 'EPIC-0002', title: 'Analytics view', status: 'Blocked', acs: [] },
    { id: 'US-0005', epicId: null, title: 'Ungrouped story', status: 'Planned', acs: [] },
    { id: 'US-0006', epicId: 'EPIC-0003', title: 'Retired story', status: 'Retired', acs: [] },
  ],
  bugs: [
    { id: 'BUG-0001', severity: 'Critical', status: 'Open', relatedStory: 'US-0003', epicId: 'EPIC-0002' },
    { id: 'BUG-0002', severity: 'Low', status: 'Open', relatedStory: 'US-0001', epicId: 'EPIC-0001' },
  ],
  costs: {
    'US-0001': { projectedUsd: 200, costUsd: 5.5 },
    'US-0002': { projectedUsd: 100, costUsd: 2.0 },
    'US-0003': { projectedUsd: 400, costUsd: 12.0 },
    _totals: { costUsd: 19.5 },
  },
  budget: {
    totalBudget: 1000,
    totalSpent: 19.5,
    totalProjected: 700,
    percentUsed: 2,
    burnRate: 0.065,
    daysRemaining: 150,
    hasBudget: true,
  },
  recentActivity: [{ date: '2026-04-01', summary: 'Setup', sessionNum: 1 }],
  ...overrides,
});

describe('renderStakeholderTab', () => {
  let html;
  beforeAll(() => {
    html = renderStakeholderTab(mkData());
  });

  // Test 1
  it('renders #tab-stakeholder container', () => {
    expect(html).toContain('id="tab-stakeholder"');
  });

  // Test 2
  it('summary bar — progress tile shows % and story count', () => {
    // 4 non-Retired stories total (US-0001 to US-0004; US-0005 epicId=null but not Retired; US-0006 Retired),
    // Wait: US-0005 epicId null = ungrouped, not Retired. So non-Retired = US-0001,US-0002,US-0003,US-0004,US-0005 = 5 stories. Done = US-0001, US-0002 = 2. 40%.
    // Actually count: Retired = US-0006 only. Non-Retired = 5 stories. Done = 2. 40%.
    expect(html).toMatch(/40%/);
    expect(html).toMatch(/2\s+of\s+5/);
  });

  // Test 3
  it('summary bar — budget tile shows Est. and AI spend in USD', () => {
    expect(html).toMatch(/Est\./);
    expect(html).toMatch(/AI spend/i);
    expect(html).toMatch(/USD/);
  });

  // Test 4
  it('summary bar — risk tile shows open bug count and blocked story count', () => {
    // 1 open Critical/High bug (BUG-0001 Critical Open), 1 blocked story (US-0004)
    expect(html).toMatch(/1\s*(high|critical)?\s*bug/i);
    expect(html).toMatch(/1\s*blocked/i);
  });

  // Test 5
  it('epic rows — one .epic-row per non-Retired epic', () => {
    const matches = html.match(/class="[^"]*epic-row[^"]*"/g) || [];
    // EPIC-0001 and EPIC-0002 (non-Retired). EPIC-0003 is Retired. Plus ungrouped = 3 total.
    // Actually ungrouped (US-0005) also gets a row. So 3 rows: EPIC-0001, EPIC-0002, No Epic.
    expect(matches.length).toBe(3);
  });

  // Test 6
  it('epic cost line — Est. and AI spend rendered when data.costs available', () => {
    // EPIC-0001 stories: US-0001 projected=$200, US-0002 projected=$100 => total $300
    // EPIC-0001 AI spend: US-0001 costUsd=5.50, US-0002 costUsd=2.00 => total $7.50
    expect(html).toMatch(/\$300/);
    expect(html).toMatch(/\$7\.50/);
  });

  // Test 7
  it('no cost elements when data.costs is null', () => {
    const noCostData = mkData({ costs: null });
    const noCostHtml = renderStakeholderTab(noCostData);
    expect(noCostHtml).toContain('id="tab-stakeholder"');
    expect(noCostHtml).not.toContain('epic-costs');
  });

  // Test 8
  it('plain language — In Progress renders as "Being Worked On"', () => {
    expect(html).toContain('Being Worked On');
    expect(html).not.toMatch(/chip[^"]*">[^<]*In Progress/);
  });

  // Test 9
  it('plain language — Blocked renders as "Needs Attention"', () => {
    expect(html).toContain('Needs Attention');
    expect(html).not.toMatch(/chip[^"]*">[^<]*Blocked/);
  });

  // Test 10
  it('story rows present inside expanded epic HTML structure', () => {
    expect(html).toContain('story-row');
    expect(html).toContain('US-0001');
    expect(html).toContain('US-0003');
  });

  // Test 11
  it('AC rows present inside story structure', () => {
    expect(html).toContain('AC-0001');
    expect(html).toContain('User can log in with email');
    expect(html).toContain('AC-0002');
  });

  // Test 12
  it('no technical fields — branch names and token counts absent', () => {
    expect(html).not.toMatch(/feature\/|bugfix\//);
    expect(html).not.toMatch(/inputTokens|outputTokens|token.count/i);
    expect(html).not.toMatch(/TC-\d{4}/);
  });

  // Test 13
  it('export bar present with window.print() call', () => {
    expect(html).toContain('stakeholder-export-bar');
    expect(html).toContain('window.print()');
  });

  // Test 14
  it('retired epics produce no epic row', () => {
    expect(html).not.toContain('Retired Epic');
  });

  // Test 15
  it('"No Epic" group appears after all EPIC-* rows', () => {
    const epic1Pos = html.indexOf('EPIC-0001');
    const epic2Pos = html.indexOf('EPIC-0002');
    const ungroupedPos = html.indexOf('No Epic');
    expect(epic1Pos).toBeGreaterThan(-1);
    expect(epic2Pos).toBeGreaterThan(-1);
    expect(ungroupedPos).toBeGreaterThan(-1);
    expect(ungroupedPos).toBeGreaterThan(Math.max(epic1Pos, epic2Pos));
  });
});
