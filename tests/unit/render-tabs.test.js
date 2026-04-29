'use strict';
const { renderStakeholderTab, renderTrendsTab } = require('../../tools/lib/render-tabs');

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

  // Test 2 — hero section replaces summary bar; check hero card is rendered
  it('hero section — pv-hero card rendered instead of sh-summary-bar', () => {
    expect(html).toContain('pv-hero card');
    expect(html).not.toContain('sh-summary-bar');
  });

  // Test 3
  it('summary bar — budget tile shows Est. and AI spend in USD', () => {
    expect(html).toMatch(/Est\./);
    expect(html).toMatch(/AI spend/i);
    expect(html).toMatch(/USD/);
  });

  // Test 4 — decision widgets show top risks; critical bug and blocked story visible
  it('decision widgets — critical bug and blocked story appear in top risks', () => {
    // BUG-0001 Critical Open appears in pv-risk-list; US-0004 Blocked appears too
    expect(html).toContain('BUG-0001');
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

  // Test 9 — epic/story chips use plain language; "Needs Attention" appears in milestone section
  it('plain language — Blocked renders as "Needs Attention" in milestone chips', () => {
    expect(html).toContain('Needs Attention');
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
    expect(html).not.toMatch(/LESSON-\d+/);
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

function mkTrendsData(overrides = {}) {
  return {
    epics: [],
    stories: [],
    bugs: [],
    costs: {},
    budget: { hasBudget: false },
    recentActivity: [],
    coverage: { available: false },
    trends: {
      dates: ['2026-04-01T00:00:00Z', '2026-04-08T00:00:00Z'],
      doneCounts: [2, 4],
      totalStories: [5, 5],
      aiCosts: [1.0, 2.0],
      coverage: [80, 85],
      velocity: [5, 8],
      openBugs: [3, 2],
      atRisk: [1, 1],
      inputTokens: [1000, 2000],
      outputTokens: [500, 1000],
      avgRisk: [1.0, 0.8],
      velocityByWeek: {
        labels: ['2026-W14', '2026-W15'],
        points: [3, 5],
        rollingAvg: [3.0, 4.0],
      },
      ...(overrides.trends || {}),
    },
    ...overrides,
  };
}

describe('renderTrendsTab — US-0159 Weekly Velocity chart', () => {
  it('renders chart-velocity-weekly canvas in Trends tab', () => {
    const html = renderTrendsTab(mkTrendsData());
    expect(html).toContain('chart-velocity-weekly');
  });

  it('renders velWeeklyLabels, velWeeklyPoints, velWeeklyAvg JS vars', () => {
    const html = renderTrendsTab(mkTrendsData());
    expect(html).toContain('velWeeklyLabels');
    expect(html).toContain('velWeeklyPoints');
    expect(html).toContain('velWeeklyAvg');
  });

  it('renders empty-state placeholder when velocityByWeek has fewer than 2 labels', () => {
    const data = mkTrendsData({
      trends: { velocityByWeek: { labels: ['2026-W14'], points: [3], rollingAvg: [3] } },
    });
    const html = renderTrendsTab(data);
    expect(html).not.toContain('chart-velocity-weekly');
  });

  it('renders empty-state placeholder when velocityByWeek is absent', () => {
    const data = mkTrendsData({ trends: { velocityByWeek: null } });
    const html = renderTrendsTab(data);
    expect(html).not.toContain('chart-velocity-weekly');
  });

  it('uses pvChartColors.info and pvChartColors.warn — no hardcoded hex in chart JS', () => {
    const html = renderTrendsTab(mkTrendsData());
    const idx = html.indexOf('chart-velocity-weekly');
    const chartSection = idx >= 0 ? html.slice(idx, idx + 600) : '';
    expect(chartSection).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});

describe('renderStakeholderTab — epic dates', () => {
  function mkStakeholderData(epicOverrides = {}) {
    return {
      epics: [
        Object.assign(
          { id: 'EPIC-0001', title: 'Core', status: 'Done', startDate: '2026-03-05', doneDate: '2026-03-10' },
          epicOverrides,
        ),
        { id: 'EPIC-0002', title: 'Renderer', status: 'In Progress', startDate: '2026-03-11', doneDate: null },
        { id: 'EPIC-0003', title: 'No Dates', status: 'Planned', startDate: null, doneDate: null },
      ],
      stories: [],
      bugs: [],
      costs: null,
      budget: { hasBudget: false },
      recentActivity: [],
      coverage: { available: false },
      trends: null,
      risk: { byStory: new Map(), byEpic: new Map() },
    };
  }

  it('renders sh-epic-dates element for epic with both dates', () => {
    const html = renderStakeholderTab(mkStakeholderData());
    expect(html).toContain('sh-epic-dates');
  });

  it('contains formatted start date text', () => {
    const html = renderStakeholderTab(mkStakeholderData());
    expect(html).toContain('Mar 5, 2026');
  });

  it('contains formatted done date text', () => {
    const html = renderStakeholderTab(mkStakeholderData());
    expect(html).toContain('Mar 10, 2026');
  });

  it('shows "in progress" for epic with startDate but no doneDate', () => {
    const html = renderStakeholderTab(mkStakeholderData());
    expect(html).toContain('in progress');
  });

  it('omits date line for epics with no dates (only 2 date divs for 3 epics)', () => {
    const html = renderStakeholderTab(mkStakeholderData());
    const count = (html.match(/class="sh-epic-dates"/g) || []).length;
    expect(count).toBe(2);
  });
});

describe('renderStakeholderTab — hero section', () => {
  function mkFullData() {
    return {
      epics: [{ id: 'EPIC-0001', title: 'Core', status: 'Done', startDate: null, doneDate: null }],
      stories: [{ id: 'US-0001', epicId: 'EPIC-0001', title: 'T', status: 'Done', acs: [] }],
      bugs: [],
      costs: { _totals: { costUsd: 0, projectedUsd: 0 } },
      budget: {
        hasBudget: false,
        percentUsed: 0,
        totalBudget: 0,
        totalSpent: 0,
        totalProjected: 0,
        burnRate: 0,
        daysRemaining: null,
      },
      recentActivity: [],
      coverage: { available: false },
      trends: null,
      risk: { byStory: new Map(), byEpic: new Map() },
      sessionTimeline: [],
      atRisk: {},
    };
  }

  it('renders pv-hero card in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).toContain('pv-hero card');
  });

  it('renders pv-widgets in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).toContain('pv-widgets');
  });

  it('does NOT render sh-summary-bar in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).not.toContain('sh-summary-bar');
  });

  it('export bar still renders', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).toContain('stakeholder-export-bar');
  });

  it('does not count Rejected bugs as open in simplified hero', () => {
    const data = {
      epics: [{ id: 'EPIC-0001', title: 'Core', status: 'In Progress', startDate: null, doneDate: null }],
      stories: [{ id: 'US-0001', epicId: 'EPIC-0001', title: 'Auth', status: 'In Progress', acs: [] }],
      bugs: [{ id: 'BUG-X', title: 'Old', status: 'Rejected', severity: 'High', relatedStory: 'US-0001' }],
      costs: { _totals: { costUsd: 0, projectedUsd: 0 } },
      budget: {
        hasBudget: false,
        percentUsed: 0,
        totalBudget: 0,
        totalSpent: 0,
        totalProjected: 0,
        burnRate: 0,
        daysRemaining: null,
      },
      recentActivity: [],
      coverage: { available: false },
      trends: null,
      risk: { byStory: new Map(), byEpic: new Map() },
      sessionTimeline: [],
      atRisk: {},
      completion: null,
    };
    const html = renderStakeholderTab(data);
    expect(html).not.toMatch(/Off track/);
  });
});
