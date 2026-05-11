'use strict';
const {
  renderStakeholderTab,
  renderTrendsTab,
  renderStatusTab,
  renderHierarchyTab,
} = require('../../tools/lib/render-tabs');

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
    expect(html).toMatch(/blocked/i);
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

describe('renderTrendsTab — Burn Up chart', () => {
  it('uses line chart type with Completed and Total Scope datasets', () => {
    const html = renderTrendsTab(mkTrendsData());
    // Must be a line chart, not bar
    expect(html).toMatch(/chart-trends-velocity[\s\S]{0,300}type:'line'/);
    // Must have both dataset labels
    expect(html).toContain("label:'Completed'");
    expect(html).toContain("label:'Total Scope'");
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
      completion: null,
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

  it('renders Release Health eyebrow in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).toContain('Release Health');
  });

  it('renders sparkline viz row (pv-hero-vizrow) in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).toContain('pv-hero-vizrow');
  });

  it('renders h2 verdict in Stakeholder tab', () => {
    const html = renderStakeholderTab(mkFullData());
    expect(html).toMatch(/<h2[^>]*>(On track|At risk|Off track)<\/h2>/s);
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

describe('shEpicCompositeStatus — bug cross-reference via relatedStory', () => {
  it('marks epic Needs Attention when a High bug is linked via relatedStory', () => {
    const data = {
      epics: [{ id: 'EPIC-0001', title: 'Core', status: 'In Progress', startDate: null, doneDate: null }],
      stories: [{ id: 'US-0001', epicId: 'EPIC-0001', title: 'Auth', status: 'In Progress', acs: [] }],
      bugs: [{ id: 'BUG-0001', title: 'Critical failure', status: 'Open', severity: 'High', relatedStory: 'US-0001' }],
      costs: null,
      coverage: { available: false },
      trends: null,
      risk: { byStory: new Map(), byEpic: new Map() },
      recentActivity: [],
      sessionTimeline: [],
      atRisk: {},
      completion: null,
      budget: {
        hasBudget: false,
        percentUsed: 0,
        totalBudget: 0,
        totalSpent: 0,
        totalProjected: 0,
        burnRate: 0,
        daysRemaining: null,
      },
    };
    const html = renderStakeholderTab(data);
    expect(html).toContain('Needs Attention');
  });

  it('does NOT mark Needs Attention when bug is Fixed', () => {
    const data = {
      epics: [{ id: 'EPIC-0001', title: 'Core', status: 'In Progress', startDate: null, doneDate: null }],
      stories: [{ id: 'US-0001', epicId: 'EPIC-0001', title: 'Auth', status: 'In Progress', acs: [] }],
      bugs: [{ id: 'BUG-0001', title: 'Was critical', status: 'Fixed', severity: 'High', relatedStory: 'US-0001' }],
      costs: null,
      coverage: { available: false },
      trends: null,
      risk: { byStory: new Map(), byEpic: new Map() },
      recentActivity: [],
      sessionTimeline: [],
      atRisk: {},
      completion: null,
      budget: {
        hasBudget: false,
        percentUsed: 0,
        totalBudget: 0,
        totalSpent: 0,
        totalProjected: 0,
        burnRate: 0,
        daysRemaining: null,
      },
    };
    const html = renderStakeholderTab(data);
    expect(html).not.toContain('Needs Attention');
  });
});

// BUG-0223 regression tests for card-view epic group collapse
const { renderBugsTab } = require('../../tools/lib/render-tabs');

const mkBugsData = () => ({
  epics: [
    { id: 'EPIC-0001', title: 'Core', status: 'In Progress' },
    { id: 'EPIC-0002', title: 'UX', status: 'Planned' },
  ],
  stories: [
    { id: 'US-0001', epicId: 'EPIC-0001', title: 'Parser', status: 'Done', acs: [] },
    { id: 'US-0002', epicId: 'EPIC-0002', title: 'Nav', status: 'Planned', acs: [] },
  ],
  bugs: [
    { id: 'BUG-0001', title: 'Parser crash', severity: 'High', status: 'Open', relatedStory: 'US-0001', fixBranch: '' },
    { id: 'BUG-0002', title: 'Nav overflow', severity: 'Low', status: 'Open', relatedStory: 'US-0002', fixBranch: '' },
    {
      id: 'BUG-0003',
      title: 'Old bug',
      severity: 'Low',
      status: 'Fixed',
      relatedStory: 'US-0001',
      fixBranch: 'feature/fix',
    },
  ],
  costs: { _totals: { costUsd: 0 } },
  trends: null,
  lessons: [],
  snapshots: [],
  completion: null,
  coverage: null,
  risk: null,
});

describe('renderBugsTab — BUG-0223 regression', () => {
  let html;
  beforeAll(() => {
    html = renderBugsTab(mkBugsData());
  });

  test('BUG-0223: card-view epic group content is hidden by default', () => {
    expect(html).toMatch(/id="bugs-card-ep-EPIC-0001"[^>]*class="[^"]*hidden/);
  });

  test('BUG-0223: card-view epic group arrow shows ▶ not ▼', () => {
    expect(html).toContain('id="bugs-card-ep-EPIC-0001-arrow"');
    const arrowIdx = html.indexOf('id="bugs-card-ep-EPIC-0001-arrow"');
    const arrowSnippet = html.slice(arrowIdx, arrowIdx + 150);
    expect(arrowSnippet).toContain('▶');
    expect(arrowSnippet).not.toContain('▼');
  });
});

const mkStatusData = () => ({
  epics: [
    { id: 'EPIC-0001', title: 'Core', status: 'In Progress' },
    { id: 'EPIC-0002', title: 'UX', status: 'Planned' },
  ],
  stories: [
    { id: 'US-0001', epicId: 'EPIC-0001', title: 'Parser', status: 'Done', acs: [] },
    { id: 'US-0002', epicId: 'EPIC-0002', title: 'Nav', status: 'Planned', acs: [] },
  ],
  bugs: [
    {
      id: 'BUG-0001',
      title: 'Parser crash',
      severity: 'High',
      status: 'Open',
      relatedStory: 'US-0001',
      fixBranch: '',
    },
  ],
  costs: { _totals: { costUsd: 0 } },
  lessons: [],
  snapshots: [],
  completion: { likelyDate: '2026-05-28', rangeStart: '2026-05-21', rangeEnd: '2026-06-04', velocityWeeks: 4 },
  coverage: { overall: 93.0, available: true },
  trends: {
    dates: ['2026-04-01', '2026-04-08', '2026-04-15', '2026-04-22', '2026-04-29'],
    doneCounts: [2, 3, 4, 5, 6],
    totalStories: [10, 10, 10, 10, 10],
    coverage: [85, 88, 90, 92, 93],
    openBugs: [5, 4, 4, 3, 2],
    aiCosts: [10, 20, 35, 50, 65],
    velocity: [1, 2, 1, 2, 1],
    atRisk: [1, 1, 0, 0, 0],
  },
  risk: null,
  recentActivity: [],
});

describe('renderStatusTab — BUG-0184 palette regression', () => {
  let html;
  beforeAll(() => {
    html = renderStatusTab(mkStatusData());
  });

  test('BUG-0184: progress sparkline bars do not use var(--plan-accent)', () => {
    const colorMixes = html.match(/color-mix\(in oklab,[^)]+\)/g) || [];
    colorMixes.forEach((cm) => {
      expect(cm).not.toContain('plan-accent');
    });
  });

  test('BUG-0184: burn SVG stroke does not use var(--plan-accent)', () => {
    expect(html).not.toMatch(/stroke="var\(--plan-accent\)"/);
  });

  test('BUG-0184: burn SVG stop-color does not use var(--plan-accent)', () => {
    expect(html).not.toMatch(/stop-color="var\(--plan-accent\)"/);
  });

  test('BUG-0184: progress bars use oklch ok-green', () => {
    expect(html).toContain('oklch(66% 0.17 145)');
  });
});

describe('renderStatusTab — BUG-0183 hero prominence', () => {
  let html, htmlNoTrends;
  beforeAll(() => {
    html = renderStatusTab(mkStatusData());
    // sparse data: no trends, no completion forecast
    htmlNoTrends = renderStatusTab({ ...mkStatusData(), trends: null, completion: null });
  });

  test('BUG-0183: verdict uses 28px font-size', () => {
    expect(html).toContain('font-size:28px');
  });

  test('BUG-0183: "Release Health" eyebrow is present', () => {
    expect(html).toContain('Release Health');
  });

  test('BUG-0183: forecast banner appears before sparkline section', () => {
    const forecastIdx = html.indexOf('likely date');
    const sparklineIdx = html.indexOf('14 snapshots');
    expect(forecastIdx).toBeGreaterThan(-1);
    expect(sparklineIdx).toBeGreaterThan(-1);
    expect(forecastIdx).toBeLessThan(sparklineIdx);
  });

  test('BUG-0183: sparkline bar height uses 48 not 32', () => {
    // Bars are server-rendered — check computed pixel value, not formula string.
    // With doneCounts=[2,3,4,5,6] maxDone=6, tallest bar = Math.round(6/6*48)=48px.
    // Note: height:32px is also valid (Math.round(4/6*48)=32), so don't assert its absence.
    expect(html).toContain('height:48px');
  });

  test('BUG-0183: sparse-data fallback does not show "No history"', () => {
    expect(htmlNoTrends).not.toContain('No history');
    expect(htmlNoTrends).not.toContain('No data');
  });

  test('BUG-0183: forecast unavailable message shown when comp is null', () => {
    expect(htmlNoTrends).toContain('Forecast unavailable');
  });
});

describe('renderTrendsTab — US-0056 date-range filter', () => {
  const dates = [
    '2026-04-01T10:00:00Z',
    '2026-04-05T10:00:00Z',
    '2026-04-10T10:00:00Z',
    '2026-04-15T10:00:00Z',
    '2026-04-20T10:00:00Z',
  ];

  it('renders trends-date-from and trends-date-to inputs in filter bar', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain('id="trends-date-from"');
    expect(html).toContain('id="trends-date-to"');
  });

  it('date inputs are type="date"', () => {
    const html = renderTrendsTab(makeData({ dates }));
    const matches = html.match(/type="date"/g);
    expect(matches).toBeTruthy();
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('filter bar contains both preset buttons and date inputs', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain('trends-range-btn');
    expect(html).toContain('trends-date-from');
  });

  it('applyTrendsFilter JS function is emitted in the script block', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain('function applyTrendsFilter(');
  });

  it('setTrendsRange calls applyTrendsFilter in count mode', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain('applyTrendsFilter({');
    expect(html).toContain("mode:'count'");
  });

  it('date input oninput calls applyTrendsFilter in date mode', () => {
    const html = renderTrendsTab(makeData({ dates }));
    expect(html).toContain("mode:'date'");
  });

  it('chart-velocity-weekly is skipped in applyTrendsFilter', () => {
    const html = renderTrendsTab(makeData({ dates }));
    const fnStart = html.indexOf('function applyTrendsFilter(');
    const fnEnd = html.indexOf('\nfunction ', fnStart + 1);
    const fnBody = fnEnd > 0 ? html.slice(fnStart, fnEnd) : html.slice(fnStart);
    expect(fnBody).toContain('chart-velocity-weekly');
  });

  function makeData({ dates }) {
    const n = dates.length;
    return {
      trends: {
        dates,
        doneCounts: Array(n).fill(0),
        totalStories: Array(n).fill(0),
        aiCosts: Array(n).fill(0),
        coverage: Array(n).fill(0),
        velocity: Array(n).fill(0),
        openBugs: Array(n).fill(0),
        atRisk: Array(n).fill(0),
        inputTokens: Array(n).fill(0),
        outputTokens: Array(n).fill(0),
        avgRisk: Array(n).fill(0),
        velocityByWeek: {
          labels: ['2026-W14', '2026-W15'],
          points: [2, 3],
          rollingAvg: [2, 2.5],
        },
      },
    };
  }
});

describe('renderHierarchyTab — US-0169 risk UI', () => {
  function makeRiskData() {
    const byStory = new Map([
      ['US-0001', { score: 3.2, level: 'Critical' }],
      ['US-0002', { score: 1.5, level: 'Medium' }],
      ['US-0003', { score: 2.5, level: 'High' }],
    ]);
    const byEpic = new Map([
      ['EPIC-0001', { avgScore: 2.4, maxScore: 3.2, level: 'High', counts: {} }],
      ['EPIC-0002', { avgScore: 0.3, maxScore: 0.5, level: 'Low', counts: {} }],
    ]);
    return { byStory, byEpic };
  }

  function makeData() {
    return {
      epics: [
        { id: 'EPIC-0001', title: 'Alpha', status: 'In Progress', releaseTarget: 'R1', startDate: '', doneDate: '' },
        { id: 'EPIC-0002', title: 'Beta', status: 'In Progress', releaseTarget: 'R1', startDate: '', doneDate: '' },
      ],
      stories: [
        {
          id: 'US-0001',
          epicId: 'EPIC-0001',
          title: 'S1',
          status: 'In Progress',
          priority: 'P0',
          estimate: 'M',
          acs: [],
          description: '',
        },
        {
          id: 'US-0002',
          epicId: 'EPIC-0001',
          title: 'S2',
          status: 'Planned',
          priority: 'P1',
          estimate: 'S',
          acs: [],
          description: '',
        },
        {
          id: 'US-0003',
          epicId: 'EPIC-0002',
          title: 'S3',
          status: 'In Progress',
          priority: 'P0',
          estimate: 'L',
          acs: [],
          description: '',
        },
      ],
      testCases: [],
      atRisk: {},
      costs: {},
      risk: makeRiskData(),
      completion: null,
    };
  }

  it('AC-0601: story rows have data-risk-score attribute', () => {
    const html = renderHierarchyTab(makeData());
    expect(html).toContain('data-risk-score="3.2"');
    expect(html).toContain('data-risk-score="1.5"');
  });

  it('AC-0601: story rows have data-risk-level attribute', () => {
    const html = renderHierarchyTab(makeData());
    expect(html).toContain('data-risk-level="Critical"');
    expect(html).toContain('data-risk-level="Medium"');
  });

  it('AC-0601: sortHierarchyBy function exposed for global filter-bar sort dropdown', () => {
    const html = renderHierarchyTab(makeData());
    // BUG-0254: risk sort moved into the global filter-bar (fgrp-hier).
    // The Hierarchy tab keeps the implementation function and exposes it on window.
    expect(html).toContain('sortHierarchyBy');
    expect(html).toContain("case 'risk'");
  });

  it('AC-0603: epic block for EPIC-0001 shows risk badge with level and avgScore', () => {
    const html = renderHierarchyTab(makeData());
    expect(html).toContain('High');
    expect(html).toContain('2.4');
  });

  it('AC-0604: EPIC-0001 (avgScore 2.4) appears before EPIC-0002 (avgScore 0.3)', () => {
    const html = renderHierarchyTab(makeData());
    const pos1 = html.indexOf('EPIC-0001');
    const pos2 = html.indexOf('EPIC-0002');
    expect(pos1).toBeGreaterThan(-1);
    expect(pos2).toBeGreaterThan(-1);
    expect(pos1).toBeLessThan(pos2);
  });

  it('AC-0605: applyHierRiskFilter function exposed for global filter-bar risk-filter dropdown', () => {
    const html = renderHierarchyTab(makeData());
    // BUG-0254: risk filter moved into the global filter-bar (fgrp-hier).
    // The Hierarchy tab keeps the implementation function and exposes it on window.
    expect(html).toContain('applyHierRiskFilter');
  });

  it('AC-0605: epic blocks have data-epic-risk-level attribute', () => {
    const html = renderHierarchyTab(makeData());
    expect(html).toContain('data-epic-risk-level="High"');
    expect(html).toContain('data-epic-risk-level="Low"');
  });

  it('AC-0603: no risk badge for Done epics', () => {
    const data = makeData();
    data.epics[0].status = 'Done';
    const html = renderHierarchyTab(data);
    const ep1Start = html.indexOf('EPIC-0001');
    const ep2Start = html.indexOf('EPIC-0002');
    const ep1Section = html.slice(ep1Start, ep2Start > ep1Start ? ep2Start : html.length);
    expect(ep1Section).not.toContain('2.4');
  });

  it('AC-0601: story rows in column view have data-risk-score for client-side sort', () => {
    const html = renderHierarchyTab(makeData());
    // Each story row container should be targetable for sort — story rows need the attribute
    const matches = html.match(/data-risk-score="[^"]+"/g);
    expect(matches).toBeTruthy();
    expect(matches.length).toBeGreaterThanOrEqual(3); // 3 stories in makeData
  });

  it('AC-0601: sortHierarchyBy targets story rows within epic-stories containers', () => {
    const html = renderHierarchyTab(makeData());
    // JS function should reference epic-stories containers and .story-row
    expect(html).toContain('epic-stories-');
    expect(html).toContain('.story-row');
  });

  it('AC-0602: chart-trends-avg-risk has High threshold dataset with _isRefLine', () => {
    const trendsData = {
      dates: ['2026-04-01T00:00:00Z', '2026-04-02T00:00:00Z'],
      done: [0, 1],
      total: [2, 2],
      cost: [0, 0],
      coverage: [80, 85],
      velocity: [0, 1],
      bugs: [1, 0],
      atRisk: [0, 0],
      inputTokens: [0, 0],
      outputTokens: [0, 0],
      avgRisk: [1.5, 1.8],
    };
    const html = renderTrendsTab(trendsData);
    expect(html).toContain('High threshold');
    expect(html).toContain('_isRefLine:true');
  });
});

describe('US-0170: variable-length artefact IDs', () => {
  it('normalizeStoryRef handles 5-digit US IDs (US-10000)', () => {
    const { normalizeStoryRef } = require('../../tools/lib/render-utils');
    expect(normalizeStoryRef('US-10000')).toBe('US-10000');
    expect(normalizeStoryRef('US-10000 (some title)')).toBe('US-10000');
  });
});

describe('renderSettingsTab — US-0172', () => {
  const { renderSettingsTab } = require('../../tools/lib/render-tabs');

  const baseGithubConfig = {
    enabled: false,
    repo: 'owner/repo',
    syncBugs: true,
    syncStories: false,
    labelMap: { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' },
    defaultLabels: ['planvisualizer'],
  };

  it('renders #tab-settings container', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('id="tab-settings"');
  });

  it('renders GitHub Sync section heading', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('GitHub Issues Sync');
  });

  it('renders repo field with current value', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('owner/repo');
  });

  it('shows token NOT SET when githubTokenSet is false', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('Not set');
  });

  it('shows token SET when githubTokenSet is true', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: true, syncState: null });
    expect(html).toContain('Set');
  });

  it('renders Copy config JSON button', () => {
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: false, syncState: null });
    expect(html).toContain('copyGithubConfig');
  });

  it('shows last sync summary when syncState provided', () => {
    const syncState = { lastSyncAt: '2026-05-03T14:32:00Z', summary: { created: 3, closed: 1 }, lastError: null };
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: true, syncState });
    expect(html).toContain('2026-05-03');
    expect(html).toContain('3');
  });

  it('shows warning badge when lastError is set', () => {
    const syncState = { lastSyncAt: '2026-05-03T14:32:00Z', summary: {}, lastError: 'API 401' };
    const html = renderSettingsTab({ githubConfig: baseGithubConfig, githubTokenSet: true, syncState });
    expect(html).toContain('API 401');
  });
});

describe('renderStatusTab GitHub surfaces', () => {
  const baseData = {
    epics: [{ id: 'EPIC-0001', title: 'Auth', status: 'In Progress' }],
    stories: [
      { id: 'US-0001', epicId: 'EPIC-0001', title: 'Login', status: 'Done', acs: [] },
      { id: 'US-0002', epicId: 'EPIC-0001', title: 'Session', status: 'In Progress', acs: [] },
    ],
    bugs: [],
    costs: { _totals: { costUsd: 0 } },
    coverage: { available: false },
    trends: null,
    completion: null,
    risk: null,
    githubStatus: {
      deployment: {
        environment: 'production',
        url: 'https://example.com',
        status: 'success',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      prs: [
        {
          storyId: 'US-0002',
          number: 994,
          url: 'https://github.com/owner/repo/pull/994',
          ciStatus: 'success',
          title: 'feat: test',
          reviewCount: 1,
          createdAt: new Date().toISOString(),
        },
        {
          storyId: 'US-0001',
          number: 41,
          url: 'https://github.com/owner/repo/pull/41',
          ciStatus: 'failure',
          title: 'fix: something',
          reviewCount: 0,
          createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
    },
  };

  it('renders deployment banner when githubStatus.deployment is present', () => {
    const html = renderStatusTab(baseData);
    expect(html).toContain('pv-gh-deploy-banner');
  });

  it('renders deployment env label in banner', () => {
    const html = renderStatusTab(baseData);
    expect(html).toContain('production');
  });

  it('renders deployment URL as link in banner', () => {
    const html = renderStatusTab(baseData);
    expect(html).toContain('https://example.com');
  });

  it('renders CI tile in the KPI grid when githubStatus is set', () => {
    const html = renderStatusTab(baseData);
    expect(html).toContain('CI Status');
  });

  it('renders open PRs details section', () => {
    const html = renderStatusTab(baseData);
    expect(html).toContain('pv-gh-pr-list');
  });

  it('open PRs list rendered when PRs present', () => {
    const html = renderStatusTab(baseData);
    expect(html).toContain('#994');
    expect(html).toContain('feat: test');
    expect(html).toContain('1</td>');
    // timeAgo of a just-created PR should be recent (contains "ago" or "just now" or "0m")
    expect(html).toMatch(/just now|0m ago|<1m/);
  });
});

describe('renderHierarchyTab GitHub badges', () => {
  const { renderHierarchyTab } = require('../../tools/lib/render-tabs');

  const baseData = () => ({
    projectName: 'Test',
    release: 'R1',
    stories: [
      {
        id: 'US-0001',
        status: 'In Progress',
        epicId: 'EPIC-0001',
        title: 'My story',
        acs: [],
        priority: 'P1',
        estimate: 'S',
      },
    ],
    epics: [{ id: 'EPIC-0001', title: 'Epic One', status: 'In Progress' }],
    bugs: [],
    testCases: [],
    lessons: [],
    coverage: { available: false },
    costs: { 'US-0001': { projectedUsd: 0 } },
    atRisk: { 'US-0001': { isAtRisk: false } },
    risk: { byStory: new Map(), byEpic: new Map() },
    githubStatus: null,
  });

  test('no badge when githubStatus is null', () => {
    const html = renderHierarchyTab(baseData());
    expect(html).not.toMatch(/#\d+&thinsp;→/);
  });

  test('renders CI badge and PR link for matched story', () => {
    const data = baseData();
    data.githubStatus = {
      prs: [
        {
          number: 994,
          ciStatus: 'success',
          storyId: 'US-0001',
          bugId: null,
          url: 'https://github.com/x/y/pull/994',
          title: 't',
          reviewCount: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      ciSummary: { total: 1, passing: 1, failing: 0, pending: 0 },
      fetchedAt: new Date().toISOString(),
    };
    const html = renderHierarchyTab(data);
    expect(html).toContain('#994');
    expect(html).toContain('chip ok');
  });

  test('no badge for unmatched story', () => {
    const data = baseData();
    data.githubStatus = {
      prs: [
        {
          number: 999,
          ciStatus: 'success',
          storyId: 'US-9999',
          bugId: null,
          url: 'u',
          title: 't',
          reviewCount: 0,
          createdAt: new Date().toISOString(),
        },
      ],
      ciSummary: { total: 1, passing: 1, failing: 0, pending: 0 },
      fetchedAt: new Date().toISOString(),
    };
    const html = renderHierarchyTab(data);
    expect(html).not.toContain('#999');
  });
});
