'use strict';
const { renderHtml, badge, sparkline } = require('../../tools/lib/render-html');

const sampleData = {
  epics: [{ id: 'EPIC-0001', title: 'Code Editing', status: 'In Progress', releaseTarget: 'MVP', dependencies: [] }],
  stories: [
    {
      id: 'US-0001',
      epicId: 'EPIC-0001',
      title: 'Open a file',
      priority: 'P0',
      estimate: 'M',
      status: 'In Progress',
      branch: 'feature/US-0001',
      acs: [],
      dependencies: [],
    },
  ],
  tasks: [],
  testCases: [],
  bugs: [
    {
      id: 'BUG-0001',
      title: 'Test critical bug',
      severity: 'Critical',
      status: 'Open',
      relatedStory: 'US-0001',
      fixBranch: 'bugfix/BUG-0001-test',
      epicId: 'EPIC-0001',
    },
  ],
  lessons: [],
  costs: {
    'US-0001': { projectedUsd: 800, aiCostUsd: 0.47, inputTokens: 50000, outputTokens: 14000 },
    _totals: { costUsd: 0.89, inputTokens: 95000, outputTokens: 26000 },
  },
  atRisk: { 'US-0001': { missingTCs: true, noBranch: false, failedTCNoBug: false, isAtRisk: true } },
  coverage: { lines: 84.5, overall: 81.0, meetsTarget: true },
  recentActivity: [{ date: '2026-03-10', summary: 'Implemented FileSystemBridge' }],
  generatedAt: '2026-03-10T12:00:00Z',
  commitSha: 'abc1234',
  projectName: 'NomadCode',
  tagline: 'Code from anywhere.',
};

describe('renderHtml', () => {
  let html;
  beforeAll(() => {
    html = renderHtml(sampleData);
  });

  it('returns a string', () => expect(typeof html).toBe('string'));
  it('includes DOCTYPE', () => expect(html).toMatch(/<!DOCTYPE html>/));
  it('includes Tailwind CDN', () => expect(html).toContain('cdn.tailwindcss.com'));
  it('includes Chart.js CDN', () => expect(html).toContain('cdn.jsdelivr.net'));
  it('includes project name', () => expect(html).toMatch(/NomadCode/));
  it('includes generated timestamp', () => expect(html).toMatch(/2026-03-10/));
  it('includes commit SHA', () => expect(html).toMatch(/abc1234/));
  it('includes total projected cost', () => expect(html).toMatch(/currency-sign[^>]*>\$<\/span>800/));
  it('includes coverage percent', () => expect(html).toMatch(/81/));
  it('includes epic filter option', () => expect(html).toMatch(/EPIC-0001/));
  it('includes all 7 tabs', () => {
    expect(html).toMatch(/Hierarchy/);
    expect(html).toMatch(/Kanban/);
    expect(html).toMatch(/Traceability/);
    expect(html).toMatch(/Charts/);
    expect(html).toMatch(/Costs/);
    expect(html).toMatch(/Bugs/);
    expect(html).toMatch(/Lessons/);
  });
  it('marks at-risk story with warning', () => expect(html).toMatch(/at-risk|⚠/));
});

describe('renderHtml — bugs tab', () => {
  it('renders bug rows when bugs present', () => {
    const dataWithBug = {
      ...sampleData,
      bugs: [
        {
          id: 'BUG-0001',
          title: 'Crash',
          severity: 'High',
          status: 'Open',
          relatedStory: 'US-0001',
          fixBranch: 'bugfix/BUG-0001',
          lessonEncoded: 'Yes',
        },
      ],
    };
    const html = renderHtml(dataWithBug);
    expect(html).toMatch(/BUG-0001/);
    expect(html).toMatch(/Crash/);
  });
});

describe('renderHtml — traceability tab', () => {
  it('renders matrix when test cases present', () => {
    const dataWithTCs = {
      ...sampleData,
      testCases: [
        {
          id: 'TC-0001',
          relatedStory: 'US-0001',
          relatedAC: 'AC-0001',
          status: 'Pass',
          defect: 'None',
          title: 'Test',
          type: 'Functional',
        },
      ],
    };
    const html = renderHtml(dataWithTCs);
    expect(html).toMatch(/TC-0001/);
    expect(html).toMatch(/trace-caption/);
  });
});

describe('renderHtml — no recent activity', () => {
  it('omits activity widget when empty', () => {
    const dataNoActivity = { ...sampleData, recentActivity: [] };
    const html = renderHtml(dataNoActivity);
    expect(html).not.toMatch(/Recent Activity/);
  });
});

describe('renderHtml — recent activity panel', () => {
  it('renders full-height panel with activity items', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/id="activity-panel"/);
    expect(html).toMatch(/id="activity-expanded"/);
    expect(html).toMatch(/id="activity-collapsed"/);
    expect(html).toMatch(/toggleActivityPanel/);
  });

  it('panel starts at 280px width by default', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/width:280px/);
    expect(html).toMatch(/@media \(min-width: 768px\) \{[^}]*body \{ padding-right: 280px; \}/);
  });

  it('collapsed strip contains vertical label text', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/writing-mode:vertical-rl/);
    expect(html).toMatch(/initActivityPanel/);
  });
});

describe('renderHtml — no stories', () => {
  it('shows 0% complete when no stories', () => {
    const dataEmpty = {
      ...sampleData,
      stories: [],
      costs: { _totals: { costUsd: 0, inputTokens: 0, outputTokens: 0 } },
      atRisk: {},
    };
    const html = renderHtml(dataEmpty);
    expect(html).toMatch(/0%/);
  });
});

describe('renderHtml — story with no risk', () => {
  it('does not render at-risk badge for safe story', () => {
    const dataNoRisk = {
      ...sampleData,
      atRisk: { 'US-0001': { missingTCs: false, noBranch: false, failedTCNoBug: false, isAtRisk: false } },
    };
    const html = renderHtml(dataNoRisk);
    expect(html).not.toMatch(/⚠ At Risk/);
  });
});

describe('renderHtml — story with ACs', () => {
  it('renders AC items with linked TC', () => {
    const dataWithACs = {
      ...sampleData,
      stories: [{ ...sampleData.stories[0], acs: [{ id: 'AC-0001', text: 'File picker opens', done: false }] }],
      testCases: [
        {
          id: 'TC-0001',
          relatedStory: 'US-0001',
          relatedAC: 'AC-0001',
          status: 'Pass',
          defect: 'None',
          title: 'Test',
          type: 'Functional',
        },
      ],
    };
    const html = renderHtml(dataWithACs);
    expect(html).toMatch(/AC-0001/);
    expect(html).toMatch(/TC-0001/);
  });

  it('renders AC items without linked TC', () => {
    const dataWithACs = {
      ...sampleData,
      stories: [{ ...sampleData.stories[0], acs: [{ id: 'AC-0002', text: 'No TC yet', done: true }] }],
      testCases: [],
    };
    const html = renderHtml(dataWithACs);
    expect(html).toMatch(/AC-0002/);
    expect(html).toMatch(/No TC yet/);
  });
});

describe('renderHtml — coverage below target', () => {
  it('renders red coverage when below 80%', () => {
    const dataLowCoverage = { ...sampleData, coverage: { lines: 70, overall: 70, meetsTarget: false } };
    const html = renderHtml(dataLowCoverage);
    expect(html).toMatch(/tile-cov tile-danger/);
  });
});

describe('renderHtml — badge fallback', () => {
  it('uses neutral semantic token for unknown status', () => {
    const dataUnknown = {
      ...sampleData,
      stories: [{ ...sampleData.stories[0], status: 'UNKNOWN_STATUS', priority: 'P3' }],
      atRisk: { 'US-0001': { missingTCs: false, noBranch: false, failedTCNoBug: false, isAtRisk: false } },
    };
    const html = renderHtml(dataUnknown);
    // US-0097: unknown text falls through to neutral tone (badge-neutral class)
    expect(html).toMatch(/class="badge badge-neutral">UNKNOWN_STATUS</);
    expect(html).toMatch(/class="badge badge-neutral">P3</);
  });
});

// US-0097 (EPIC-0015): Exhaustive coverage of the BADGE_TONE mapping. Every
// one of the 17 known badge labels must resolve to its expected semantic tone
// class so that styling remains stable as the palette evolves. See
// tools/lib/render-html.js:22 for the authoritative map.
describe('badge() tone mapping — all 17 semantic labels', () => {
  const cases = [
    // success
    ['Done', 'success'],
    ['Pass', 'success'],
    ['Fixed', 'success'],
    // warn
    ['To Do', 'warn'],
    ['Not Run', 'warn'],
    ['Medium', 'warn'],
    ['P1', 'warn'],
    ['High', 'warn'],
    // danger
    ['Blocked', 'danger'],
    ['Fail', 'danger'],
    ['Open', 'danger'],
    ['Critical', 'danger'],
    ['P0', 'danger'],
    // info
    ['In Progress', 'info'],
    // neutral
    ['Planned', 'neutral'],
    ['Low', 'neutral'],
    ['P2', 'neutral'],
  ];

  it('covers all 17 canonical labels', () => {
    expect(cases).toHaveLength(17);
  });

  describe.each(cases)('label "%s"', (label, tone) => {
    const output = badge(label);

    it(`emits class="badge badge-${tone}"`, () => {
      expect(output).toContain(`class="badge badge-${tone}"`);
    });

    it('preserves (escaped) text content', () => {
      // badge() HTML-escapes its argument; for these plain labels the escaped
      // form is identical to the input, so a substring check is sufficient.
      expect(output).toContain(`>${label}<`);
    });
  });
});

describe('badge() unknown input fallback', () => {
  it('falls back to badge-neutral for an unmapped label', () => {
    const output = badge('Unknown');
    expect(output).toBe('<span class="badge badge-neutral">Unknown</span>');
  });

  it('escapes HTML special characters in unknown labels', () => {
    const output = badge('<script>');
    expect(output).toContain('class="badge badge-neutral"');
    expect(output).toContain('&lt;script&gt;');
    expect(output).not.toContain('<script>');
  });
});

describe('renderHtml — epic with no stories', () => {
  it('renders no stories message for empty epic', () => {
    const dataNoStories = {
      ...sampleData,
      epics: [{ id: 'EPIC-0002', title: 'Empty Epic', status: 'Planned', releaseTarget: 'v1', dependencies: [] }],
      stories: [],
      costs: { _totals: { costUsd: 0, inputTokens: 0, outputTokens: 0 } },
      atRisk: {},
    };
    const html = renderHtml(dataNoStories);
    expect(html).toMatch(/No stories yet/);
  });
});

describe('renderHtml — done story in kanban', () => {
  it('places done story in Done column', () => {
    const dataDone = {
      ...sampleData,
      stories: [{ ...sampleData.stories[0], status: 'Done' }],
      atRisk: { 'US-0001': { missingTCs: false, noBranch: false, failedTCNoBug: false, isAtRisk: false } },
    };
    const html = renderHtml(dataDone);
    expect(html).toMatch(/100%/);
  });
});

describe('renderHtml — traceability with Fail TC', () => {
  it('renders Fail cell in traceability matrix', () => {
    const dataFailTC = {
      ...sampleData,
      testCases: [
        {
          id: 'TC-0002',
          relatedStory: 'US-0001',
          relatedAC: 'AC-0001',
          status: 'Fail',
          defect: 'BUG-0001',
          title: 'Fail test',
          type: 'Functional',
        },
      ],
    };
    const html = renderHtml(dataFailTC);
    expect(html).toMatch(/tc-dot-danger/);
  });
});

describe('renderHtml — all three risk flags', () => {
  it('renders all risk reasons in title', () => {
    const dataAllRisks = {
      ...sampleData,
      atRisk: { 'US-0001': { missingTCs: true, noBranch: true, failedTCNoBug: true, isAtRisk: true } },
    };
    const html = renderHtml(dataAllRisks);
    expect(html).toMatch(/Missing TCs/);
    expect(html).toMatch(/No branch/);
    expect(html).toMatch(/Failed TC without bug/);
  });
});

describe('renderHtml — blocked story', () => {
  it('renders Blocked story in kanban', () => {
    const dataBlocked = {
      ...sampleData,
      stories: [{ ...sampleData.stories[0], status: 'Blocked' }],
      atRisk: { 'US-0001': { missingTCs: false, noBranch: false, failedTCNoBug: false, isAtRisk: false } },
    };
    const html = renderHtml(dataBlocked);
    expect(html).toMatch(/Blocked/);
  });
});

describe('renderHtml — story estimate missing', () => {
  it('shows ? for missing estimate', () => {
    const dataNoEstimate = {
      ...sampleData,
      stories: [{ ...sampleData.stories[0], estimate: '' }],
      atRisk: { 'US-0001': { missingTCs: false, noBranch: false, failedTCNoBug: false, isAtRisk: false } },
    };
    const html = renderHtml(dataNoEstimate);
    expect(html).toMatch(/\?/);
  });
});

describe('renderHtml — bugs with lessonEncoded No', () => {
  it('renders ○ for lesson not encoded', () => {
    const dataWithBug = {
      ...sampleData,
      bugs: [
        {
          id: 'BUG-0002',
          title: 'Some bug',
          severity: 'Medium',
          status: 'Fixed',
          relatedStory: 'US-0001',
          fixBranch: '',
          lessonEncoded: 'No',
        },
      ],
    };
    const html = renderHtml(dataWithBug);
    expect(html).toMatch(/BUG-0002/);
  });
});

describe('renderHtml — XSS escaping', () => {
  it('escapes HTML special chars in user fields', () => {
    const xssData = {
      ...sampleData,
      projectName: '<script>alert(1)</script>',
      stories: [{ ...sampleData.stories[0], title: 'A & B <test>' }],
    };
    const html = renderHtml(xssData);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B &lt;test&gt;');
  });
});

describe('renderHtml — traceability with Not Run TC', () => {
  it('renders Not Run cell in traceability matrix', () => {
    const dataNotRunTC = {
      ...sampleData,
      testCases: [
        {
          id: 'TC-0003',
          relatedStory: 'US-0001',
          relatedAC: 'AC-0001',
          status: 'Not Run',
          defect: 'None',
          title: 'Not run test',
          type: 'Functional',
        },
      ],
    };
    const html = renderHtml(dataNotRunTC);
    expect(html).toMatch(/TC-0003/);
  });
});

describe('renderHtml — sticky header (BUG-0004 regression)', () => {
  it('wraps header in a sticky container', () => {
    const html = renderHtml(sampleData);
    expect(html).toContain('id="topbar-fixed"');
  });
});

describe('renderHtml — projected cost from data.costs (BUG-0006)', () => {
  it('uses data.costs.projectedUsd not TSHIRT_HOURS', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/currency-sign[^>]*>\$<\/span>800/);
  });
});

describe('renderHtml — filter bar (BUG-0009)', () => {
  it('includes f-bug-status select for bugs tab filtering', () => {
    expect(renderHtml(sampleData)).toContain('id="f-bug-status"');
  });
  it('assigns bug-row class to bug table rows', () => {
    const dataWithBug = {
      ...sampleData,
      bugs: [
        {
          id: 'BUG-0001',
          title: 'Crash',
          severity: 'High',
          status: 'Open',
          relatedStory: 'US-0001',
          fixBranch: 'bugfix/BUG-0001',
          lessonEncoded: 'No',
        },
      ],
    };
    expect(renderHtml(dataWithBug)).toContain('bug-row');
  });
});

describe('renderHtml — coverage available false shows N/A (BUG-0010)', () => {
  it('shows N/A when coverage not available', () => {
    const noFile = {
      ...sampleData,
      coverage: { lines: 0, overall: 0, branches: 0, meetsTarget: false, available: false },
    };
    const html = renderHtml(noFile);
    expect(html).toMatch(/N\/A/);
  });
});

describe('renderHtml — lessonEncoded startsWith fix (BUG-0038)', () => {
  it('renders ✓ for lessonEncoded starting with Yes', () => {
    const d = {
      ...sampleData,
      bugs: [
        {
          id: 'BUG-0001',
          title: 'Crash',
          severity: 'High',
          status: 'Fixed',
          relatedStory: 'US-0001',
          fixBranch: 'bugfix/BUG-0001',
          lessonEncoded: 'Yes — see docs/LESSONS.md',
        },
      ],
    };
    expect(renderHtml(d)).toContain('✓');
  });
  it('renders ○ for lessonEncoded No', () => {
    const d = {
      ...sampleData,
      bugs: [
        {
          id: 'BUG-0002',
          title: 'Other',
          severity: 'Low',
          status: 'Fixed',
          relatedStory: 'US-0001',
          fixBranch: '',
          lessonEncoded: 'No',
        },
      ],
    };
    expect(renderHtml(d)).toContain('○');
  });
});

describe('renderHtml — bug token dash for estimated costs (BUG-0037)', () => {
  it('shows — for token count when bug cost is estimated', () => {
    const d = {
      ...sampleData,
      bugs: [
        {
          id: 'BUG-0001',
          title: 'Crash',
          severity: 'High',
          status: 'Fixed',
          relatedStory: 'US-0001',
          fixBranch: '',
          lessonEncoded: 'No',
        },
      ],
      costs: {
        ...sampleData.costs,
        _bugs: { 'BUG-0001': { costUsd: 0.5, inputTokens: 0, outputTokens: 0, isEstimated: true } },
      },
    };
    expect(renderHtml(d)).toContain('—');
  });
});

describe('renderHtml — AI cost column colour (BUG-0036)', () => {
  it('uses text-teal-700 for AI cost cells', () => {
    expect(renderHtml(sampleData)).toContain('text-teal-700');
  });
});

describe('renderHtml — Lessons tab (US-0032)', () => {
  const sampleLesson = {
    id: 'L-0010',
    title: 'Update TC statuses',
    rule: 'Always update TCs when story is Done.',
    context: 'BUG-0003 caused 23 TCs to show Not Run.',
    date: '2026-03-10',
  };

  it('renders Lessons tab when lessons present', () => {
    const d = { ...sampleData, lessons: [sampleLesson] };
    const html = renderHtml(d);
    expect(html).toContain('id="tab-lessons"');
    expect(html).toContain('L-0010');
    expect(html).toContain('Always update TCs');
  });

  it('renders column and card view containers', () => {
    const d = { ...sampleData, lessons: [sampleLesson] };
    const html = renderHtml(d);
    expect(html).toContain('lessons-column-view');
    expect(html).toContain('lessons-card-view');
  });

  it('renders setLessonsView toggle JS', () => {
    const d = { ...sampleData, lessons: [sampleLesson] };
    expect(renderHtml(d)).toContain('setLessonsView');
  });

  it('renders Lessons tab button in tab bar', () => {
    const d = { ...sampleData, lessons: [sampleLesson] };
    expect(renderHtml(d)).toMatch(/Lessons/);
  });

  it('shows empty state when no lessons', () => {
    const d = { ...sampleData, lessons: [] };
    expect(renderHtml(d)).toContain('No lessons logged yet');
  });

  it('renders lesson anchor id for scroll target', () => {
    const d = { ...sampleData, lessons: [sampleLesson] };
    const html = renderHtml(d);
    expect(html).toMatch(/id="lesson-(col|card)-L-0010"/);
  });
});

describe('renderHtml — Bugs tab lesson hyperlink (US-0032)', () => {
  const bugWithLessonId = {
    id: 'BUG-0001',
    title: 'Crash',
    severity: 'High',
    status: 'Fixed',
    relatedStory: 'US-0001',
    fixBranch: '',
    lessonEncoded: 'Yes — see docs/LESSONS.md (L-0010)',
  };
  const bugWithYesNoId = {
    id: 'BUG-0002',
    title: 'Other',
    severity: 'Low',
    status: 'Fixed',
    relatedStory: 'US-0001',
    fixBranch: '',
    lessonEncoded: 'Yes — see docs/LESSONS.md',
  };
  const bugNoLesson = {
    id: 'BUG-0003',
    title: 'Minor',
    severity: 'Low',
    status: 'Open',
    relatedStory: 'US-0001',
    fixBranch: '',
    lessonEncoded: 'No',
  };

  it('renders lesson-pill link when lesson ID present (AC-0354)', () => {
    const d = { ...sampleData, bugs: [bugWithLessonId] };
    const html = renderHtml(d);
    expect(html).toMatch(/lesson-pill.*L-0010|L-0010.*lesson-pill/);
    expect(html).toContain("'lesson-col-'");
    expect(html).toContain("'L-0010'");
  });

  it('renders plain ✓ when Yes but no L-ID', () => {
    const d = { ...sampleData, bugs: [bugWithYesNoId] };
    const html = renderHtml(d);
    expect(html).toMatch(/&#10003;|✓/);
    // No lesson-pill anchor should be present (only plain ✓ text)
    expect(html).not.toMatch(/<span class="lesson-pill-id">/);
  });

  it('renders ○ when lesson not encoded', () => {
    const d = { ...sampleData, bugs: [bugNoLesson] };
    expect(renderHtml(d)).toContain('○');
  });

  it('adds bug-row id for reverse scroll from Lessons tab', () => {
    const d = { ...sampleData, bugs: [bugWithLessonId] };
    expect(renderHtml(d)).toContain('id="bug-row-BUG-0001"');
  });
});

describe('renderHtml — multi-epic bug grouping sort (BUG-0093)', () => {
  // Data with 2 epics + an ungrouped bug to exercise all sort comparator branches
  const multiEpicData = {
    ...sampleData,
    epics: [
      { id: 'EPIC-0001', title: 'Editing', status: 'Done', releaseTarget: 'MVP', dependencies: [] },
      { id: 'EPIC-0002', title: 'Navigation', status: 'In Progress', releaseTarget: 'MVP', dependencies: [] },
    ],
    stories: [
      {
        id: 'US-0001',
        epicId: 'EPIC-0001',
        title: 'Open a file',
        priority: 'P0',
        estimate: 'M',
        status: 'Done',
        branch: 'feature/US-0001',
        acs: [],
        dependencies: [],
      },
      {
        id: 'US-0002',
        epicId: 'EPIC-0002',
        title: 'Navigate',
        priority: 'P1',
        estimate: 'S',
        status: 'In Progress',
        branch: 'feature/US-0002',
        acs: [],
        dependencies: [],
      },
    ],
    bugs: [
      {
        id: 'BUG-0001',
        title: 'Alpha bug',
        severity: 'High',
        status: 'Fixed',
        relatedStory: 'US-0001',
        fixBranch: 'bugfix/BUG-0001',
        lessonEncoded: 'No',
      },
      {
        id: 'BUG-0002',
        title: 'Beta bug',
        severity: 'Medium',
        status: 'Fixed',
        relatedStory: 'US-0002',
        fixBranch: 'bugfix/BUG-0002',
        lessonEncoded: 'No',
      },
      {
        id: 'BUG-0003',
        title: 'Orphan bug',
        severity: 'Low',
        status: 'Open',
        relatedStory: '',
        fixBranch: '',
        lessonEncoded: 'No',
      },
    ],
    costs: {
      ...sampleData.costs,
      _bugs: {
        'BUG-0001': { costUsd: 0.1, inputTokens: 1000, outputTokens: 300, projectedUsd: 400 },
        'BUG-0002': { costUsd: 0.05, inputTokens: 500, outputTokens: 100, projectedUsd: 200 },
        'BUG-0003': { costUsd: 0, inputTokens: 0, outputTokens: 0, projectedUsd: 200, isEstimated: true },
      },
    },
  };

  it('renders bugs tab with multiple epic groups in ascending order', () => {
    const html = renderHtml(multiEpicData);
    // '_ungrouped' has underscore replaced → '-ungrouped' in DOM IDs
    expect(html).toContain('bugs-ep-EPIC-0001');
    expect(html).toContain('bugs-ep-EPIC-0002');
    expect(html).toContain('bugs-ep--ungrouped');
    const pos1 = html.indexOf('bugs-ep-EPIC-0001');
    const pos2 = html.indexOf('bugs-ep-EPIC-0002');
    const posU = html.indexOf('bugs-ep--ungrouped');
    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(posU);
  });

  it('renders costs tab bug section with multiple epic groups in ascending order', () => {
    const html = renderHtml(multiEpicData);
    expect(html).toContain('bug-costs-ep-EPIC-0001');
    expect(html).toContain('bug-costs-ep-EPIC-0002');
    expect(html).toContain('bug-costs-ep--ungrouped');
    const pos1 = html.indexOf('bug-costs-ep-EPIC-0001');
    const pos2 = html.indexOf('bug-costs-ep-EPIC-0002');
    const posU = html.indexOf('bug-costs-ep--ungrouped');
    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(posU);
  });
});

describe('renderHtml — CSS tokens (US-0096 zebra striping)', () => {
  let html;
  beforeAll(() => {
    html = renderHtml(sampleData);
  });

  // Extract :root { ... } block (stops at closing brace of root block, before html.dark)
  const rootBlock = () => {
    const m = html.match(/:root\s*\{([\s\S]*?)\n\s{2}\}/);
    return m ? m[1] : '';
  };
  // Extract html.dark { ... } block
  const darkBlock = () => {
    const m = html.match(/html\.dark\s*\{([\s\S]*?)\n\s{2}\}/);
    return m ? m[1] : '';
  };

  it('declares --clr-row-alt in :root (light mode)', () => {
    expect(rootBlock()).toMatch(/--clr-row-alt:\s*rgba\(148,163,184,0\.04\)/);
  });

  it('declares --clr-row-hover in :root (light mode)', () => {
    expect(rootBlock()).toMatch(/--clr-row-hover:\s*rgba\(148,163,184,0\.09\)/);
  });

  it('declares --clr-row-alt in html.dark (dark mode)', () => {
    expect(darkBlock()).toMatch(/--clr-row-alt:\s*rgba\(255,255,255,0\.02\)/);
  });

  it('declares --clr-row-hover in html.dark (dark mode)', () => {
    expect(darkBlock()).toMatch(/--clr-row-hover:\s*rgba\(255,255,255,0\.05\)/);
  });

  it('emits .scroll-table tbody tr:nth-child(even) rule using --clr-row-alt', () => {
    expect(html).toMatch(/\.scroll-table tbody tr:nth-child\(even\)\s*\{\s*background-color:\s*var\(--clr-row-alt\)/);
  });

  it('emits .scroll-table tbody tr:hover rule using --clr-row-hover', () => {
    expect(html).toMatch(/\.scroll-table tbody tr:hover\s*\{\s*background-color:\s*var\(--clr-row-hover\)/);
  });
});

describe('renderHtml — hero numbers (US-0099)', () => {
  let html;
  beforeAll(() => {
    html = renderHtml(sampleData);
  });

  // Extract the .hero-num rule body (default variant). Stops at the next closing brace.
  const heroNumBlock = () => {
    const m = html.match(/\.hero-num\s*\{([\s\S]*?)\}/);
    return m ? m[1] : '';
  };
  // Extract the .hero-num.hero-num-sm rule body.
  const heroNumSmBlock = () => {
    const m = html.match(/\.hero-num\.hero-num-sm\s*\{([\s\S]*?)\}/);
    return m ? m[1] : '';
  };

  it('declares .hero-num with Instrument Serif font stack', () => {
    expect(heroNumBlock()).toMatch(/font-family:\s*'Instrument Serif'/);
  });

  it('declares .hero-num with clamp() responsive font-size', () => {
    expect(heroNumBlock()).toMatch(/font-size:\s*clamp\(/);
  });

  it('declares .hero-num with tabular-nums for aligned digits', () => {
    expect(heroNumBlock()).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  it('declares .hero-num.hero-num-sm variant with smaller clamp()', () => {
    expect(heroNumSmBlock()).toMatch(/font-size:\s*clamp\(/);
  });

  it('.hero-num-sm clamp uses rem units (compact topbar scaling)', () => {
    // Distinguishes sm variant from default (which uses px). Contract: sm scales in rem.
    expect(heroNumSmBlock()).toMatch(/clamp\([^)]*rem[^)]*\)/);
  });

  it('applies hero-num hero-num-sm to Bugs Open topbar tile', () => {
    expect(html).toMatch(
      /class="tile-value hero-num hero-num-sm tile-bugs[^"]*"[^>]*>[^<]*Bugs|tile-bugs[^"]*"[^>]*>[^<]*\d+<\/span>\s*<span class="tile-label">Bugs Open/,
    );
    // Precise: the Bugs Open tile-value contains hero-num hero-num-sm
    const bugsTileMatch = html.match(
      /<span class="tile-value ([^"]+) tile-bugs[^"]*">[\s\S]*?<\/span>\s*<span class="tile-label">Bugs Open<\/span>/,
    );
    expect(bugsTileMatch).not.toBeNull();
    expect(bugsTileMatch[1]).toContain('hero-num');
    expect(bugsTileMatch[1]).toContain('hero-num-sm');
  });

  it('applies hero-num hero-num-sm to Coverage topbar tile', () => {
    const covTileMatch = html.match(
      /<span class="tile-value ([^"]+) tile-cov[^"]*">[\s\S]*?<\/span>\s*<span class="tile-label">Coverage<\/span>/,
    );
    expect(covTileMatch).not.toBeNull();
    expect(covTileMatch[1]).toContain('hero-num');
    expect(covTileMatch[1]).toContain('hero-num-sm');
  });

  it('applies hero-num hero-num-sm to AI Cost topbar tile', () => {
    const aiTileMatch = html.match(
      /<span class="tile-value ([^"]+)">[\s\S]*?<\/span>\s*<span class="tile-label">AI Cost<\/span>/,
    );
    expect(aiTileMatch).not.toBeNull();
    expect(aiTileMatch[1]).toContain('hero-num');
    expect(aiTileMatch[1]).toContain('hero-num-sm');
  });

  it('does NOT apply hero-num to Stories tile (treatment is scoped to Bugs/Coverage/AI Cost)', () => {
    const storiesTileMatch = html.match(
      /<span class="tile-value[^"]*">[^<]*<\/span>\s*<span class="tile-label">Stories<\/span>/,
    );
    expect(storiesTileMatch).not.toBeNull();
    expect(storiesTileMatch[0]).not.toContain('hero-num');
  });

  it('renders Coverage doughnut overlay using hero-num (default, not sm)', () => {
    // Inside the Test Coverage card: overlay div wraps the percentage in .hero-num.
    // US-0103: h3 replaced with chart-header-rule + display-title span
    const covOverlayMatch = html.match(
      /display-title[^>]*>Test Coverage[\s\S]*?<div class="hero-num [^"]*">([^<]+)<\/div>/,
    );
    expect(covOverlayMatch).not.toBeNull();
    // Overlay uses the default (large) variant, not hero-num-sm.
    expect(covOverlayMatch[0]).not.toMatch(/hero-num-sm/);
    // And it renders the coverage value (81.0%) from sampleData.
    expect(covOverlayMatch[1]).toMatch(/81(\.0)?%/);
  });

  it('renders Total Budget / Spent / Remaining as hero-num when hasBudget=true', () => {
    const dataWithBudget = {
      ...sampleData,
      budget: {
        hasBudget: true,
        totalBudget: 10000,
        totalSpent: 3500,
        percentUsed: 35,
        burnRate: 100,
        daysRemaining: 65,
        crossedThresholds: [],
        epicBudgets: [],
      },
    };
    const budgetHtml = renderHtml(dataWithBudget);
    // Each of the three totals must be wrapped in hero-num.
    expect(budgetHtml).toMatch(
      /Total Budget<\/div>\s*<div class="hero-num[^"]*"><span class="currency-sign">\$<\/span>10,000<\/div>/,
    );
    expect(budgetHtml).toMatch(
      /Spent<\/div>\s*<div class="hero-num[^"]*"><span class="currency-sign">\$<\/span>3,500<\/div>/,
    );
    expect(budgetHtml).toMatch(
      /Remaining<\/div>\s*<div class="hero-num[^"]*"><span class="currency-sign">\$<\/span>6,500<\/div>/,
    );
  });

  it('omits budget hero-num block when hasBudget=false', () => {
    // sampleData has no budget key, so hasBudget is falsy → the Total Budget section must not render.
    expect(html).not.toMatch(/Total Budget<\/div>\s*<div class="hero-num/);
  });
});

describe('US-0098 — staggered animation', () => {
  it('rendered HTML contains @keyframes fadeInUp', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/@keyframes fadeInUp/);
  });

  it('rendered HTML contains .anim-stagger with animation-delay calc', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/\.anim-stagger/);
    expect(html).toMatch(/animation-delay:\s*calc\(var\(--i/);
  });

  it('rendered HTML contains --i custom property on elements', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/--i:/);
  });

  it('rendered HTML contains anim-stagger class', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/anim-stagger/);
  });

  it('no JS animation library is used', () => {
    const html = renderHtml(sampleData);
    expect(html).not.toMatch(/gsap|anime\.js|framer/);
  });

  it('includes prefers-reduced-motion guard for .anim-stagger', () => {
    const html = renderHtml(sampleData);
    expect(html).toContain('@media (prefers-reduced-motion: reduce)');
    expect(html).toContain('.anim-stagger { animation: none');
  });

  it('costs tab epic accordion headers have anim-stagger', () => {
    const html = renderHtml(sampleData);
    const costsIdx = html.indexOf('id="tab-costs"');
    const costsHtml = html.slice(costsIdx, costsIdx + 30000);
    // accordion header rows are uniquely identifiable by cursor-pointer + select-none
    expect(costsHtml).toMatch(/cursor-pointer select-none anim-stagger/);
  });

  it('traceability story rows have anim-stagger', () => {
    const html = renderHtml({
      ...sampleData,
      testCases: [{ id: 'TC-0001', relatedStory: 'US-0001', status: 'Pass' }],
    });
    const traceIdx = html.indexOf('id="tab-traceability"');
    const traceHtml = html.slice(traceIdx, traceIdx + 30000);
    expect(traceHtml).toContain('anim-stagger');
  });

  it('bugs tab rows have anim-stagger', () => {
    const html = renderHtml(sampleData);
    const bugsIdx = html.indexOf('id="tab-bugs"');
    const bugsHtml = html.slice(bugsIdx, bugsIdx + 20000);
    expect(bugsHtml).toContain('anim-stagger');
  });

  it('lesson cards have anim-stagger', () => {
    const html = renderHtml({
      ...sampleData,
      lessons: [{ id: 'L-0001', title: 'Test', rule: 'Do X', context: 'Ctx', date: '2026-01', bugIds: [] }],
    });
    const lessonsIdx = html.indexOf('id="tab-lessons"');
    const lessonsHtml = html.slice(lessonsIdx, lessonsIdx + 20000);
    expect(lessonsHtml).toContain('anim-stagger');
  });

  it('showTab JS re-triggers anim-stagger on tab switch', () => {
    const html = renderHtml(sampleData);
    expect(html).toContain("classList.remove('anim-stagger')");
    expect(html).toContain('offsetWidth');
    expect(html).toContain("classList.add('anim-stagger')");
  });
});

describe('US-0107 — Lessons card polish', () => {
  const lessonData = {
    ...sampleData,
    lessons: [
      {
        id: 'L-0001',
        title: 'Validate security tokens',
        rule: 'Always validate security tokens before use',
        context: 'Learned during auth implementation',
        date: '2026-01',
        bugIds: ['BUG-0001'],
      },
    ],
    bugs: [
      {
        id: 'BUG-0001',
        title: 'Token not validated',
        severity: 'High',
        status: 'Fixed',
        relatedStory: 'US-0001',
        fixBranch: 'bugfix/BUG-0001',
        lessonEncoded: 'Yes — L-0001',
      },
    ],
  };

  it('lesson cards have lesson-accent-bar class', () => {
    const html = renderHtml(lessonData);
    expect(html).toMatch(/lesson-accent-bar/);
  });

  it('security keyword produces lock icon', () => {
    const html = renderHtml(lessonData);
    expect(html).toMatch(/🔒/);
  });

  it('lesson card has border-left accent style', () => {
    const html = renderHtml(lessonData);
    expect(html).toMatch(/border-left.*solid/);
  });

  it('related bug renders lesson-bug-inline details element', () => {
    const html = renderHtml(lessonData);
    expect(html).toMatch(/lesson-bug-inline/);
  });

  it('fallback icon for unmatched keyword is lightbulb', () => {
    const genericData = {
      ...sampleData,
      lessons: [
        {
          id: 'L-0002',
          title: 'Keep commits small',
          rule: 'Keep commits small',
          context: '',
          date: '2026-01',
          bugIds: [],
        },
      ],
    };
    const html = renderHtml(genericData);
    expect(html).toMatch(/💡/);
  });
});

describe('US-0100 — Hierarchy tab polish', () => {
  it('epic ID renders with EPIC / split pattern', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/epic-id-display/);
    expect(html).toMatch(/EPIC \//);
  });

  it('epic progress rule div is present', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/epic-progress-track/);
    expect(html).toMatch(/epic-progress-fill/);
  });

  it('AC list has left-guide class', () => {
    const dataWithACs = {
      ...sampleData,
      stories: [
        {
          ...sampleData.stories[0],
          acs: [{ id: 'AC-0001', text: 'Should work', done: false }],
        },
      ],
    };
    const html = renderHtml(dataWithACs);
    expect(html).toMatch(/ac-guide/);
  });

  it('card view story cards have accent dot', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/epic-accent-dot/);
  });

  it('progress rule is 0% when no stories done', () => {
    // sampleData story has status "In Progress" — doneCnt=0, so width should be 0%
    const html = renderHtml(sampleData);
    expect(html).toMatch(/width:0%/);
  });
});

describe('US-0101 — Kanban board polish', () => {
  it('rendered HTML contains ksw-inprogress class for In Progress column', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/ksw-inprogress/);
  });

  it('rendered HTML contains kswPulse animation', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/kswPulse/);
  });

  it('rendered HTML contains wip-pill class', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/wip-pill/);
  });

  it('P0 story card has danger priority stripe', () => {
    const p0Data = {
      ...sampleData,
      stories: [{ ...sampleData.stories[0], priority: 'P0', status: 'In Progress' }],
    };
    const html = renderHtml(p0Data);
    expect(html).toMatch(/badge-danger-text|#dc2626/);
  });

  it('BUG-0112: kanban cards do not contain hardcoded bg-white class; use card-elev instead', () => {
    const html = renderHtml(sampleData);
    // Cards should use card-elev not hardcoded bg-white
    expect(html).toMatch(/card-elev/);
    expect(html).not.toMatch(/story-row story-card-hover bg-white/);
  });
});

describe('US-0102 — Traceability matrix redesign', () => {
  const tcData = {
    ...sampleData,
    testCases: [
      {
        id: 'TC-0010',
        relatedStory: 'US-0001',
        relatedAC: 'AC-0001',
        status: 'Pass',
        defect: 'None',
        title: 'Pass test',
        type: 'Functional',
      },
      {
        id: 'TC-0011',
        relatedStory: 'US-0001',
        relatedAC: 'AC-0002',
        status: 'Fail',
        defect: 'BUG-0001',
        title: 'Fail test',
        type: 'Functional',
      },
      {
        id: 'TC-0012',
        relatedStory: 'US-0001',
        relatedAC: 'AC-0003',
        status: 'Not Run',
        defect: 'None',
        title: 'Not run test',
        type: 'Functional',
      },
    ],
  };

  let html;
  beforeAll(() => {
    html = renderHtml(tcData);
  });

  it('Pass TC cell has tc-dot-success class', () => {
    expect(html).toContain('tc-dot tc-dot-success');
  });

  it('Fail TC cell has tc-dot-danger class', () => {
    expect(html).toContain('tc-dot tc-dot-danger');
  });

  it('Caption contains Pass/Fail/Not Run counts', () => {
    expect(html).toMatch(/class="trace-caption"/);
    expect(html).toMatch(/Pass: 1/);
    expect(html).toMatch(/Fail: 1/);
    expect(html).toMatch(/Not Run: 1/);
  });

  it('First td in story rows has trace-sticky-col class', () => {
    expect(html).toMatch(/class="trace-sticky-col[^"]*"/);
  });

  it('TC header cells have data-col attribute', () => {
    expect(html).toMatch(/data-col="TC-0010"/);
    expect(html).toMatch(/data-col="TC-0011"/);
    expect(html).toMatch(/data-col="TC-0012"/);
  });
});

describe('US-0106 — Bug severity styling', () => {
  it('severity badge cells have badge-sev class', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/badge-sev/);
  });

  it('Critical bug card has border-left with danger token', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/border-left:4px solid var\(--badge-danger-text/);
  });

  it('fix branch cell has title attribute', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/class="truncate" title="/);
  });

  it('lesson link renders lesson-pill', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/lesson-pill/);
  });

  it('compact view button and container are present', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/bugs-compact-view/);
    expect(html).toMatch(/setBugsView\('compact'\)/);
  });

  it('applyFilters targets bug-compact-row elements', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/\.bug-row,\s*\.bug-compact-row/);
  });
});

describe('US-0104 Trends', () => {
  const trendsData = {
    ...sampleData,
    trends: {
      dates: ['2026-01-01', '2026-01-15'],
      doneCounts: [5, 10],
      totalStories: [20, 20],
      aiCosts: [1.5, 3.0],
      coverage: [80, 85],
      velocity: [3, 5],
      openBugs: [2, 1],
      atRisk: [1, 0],
      inputTokens: [100000, 200000],
      outputTokens: [30000, 60000],
    },
  };

  it('renders Progress supertitle in Trends tab', () => {
    const html = renderHtml(trendsData);
    const idx = html.indexOf('id="tab-trends"');
    const trendsHtml = html.slice(idx, idx + 30000);
    expect(trendsHtml).toContain('Progress');
    expect(trendsHtml).toContain('chart-trends-progress');
  });

  it('renders Cost & Spend supertitle in Trends tab', () => {
    const html = renderHtml(trendsData);
    const idx = html.indexOf('id="tab-trends"');
    const trendsHtml = html.slice(idx, idx + 30000);
    expect(trendsHtml).toMatch(/Cost.*Spend|Cost &amp; Spend/);
    expect(trendsHtml).toContain('chart-trends-cost');
  });

  it('renders Quality supertitle in Trends tab', () => {
    const html = renderHtml(trendsData);
    const idx = html.indexOf('id="tab-trends"');
    const trendsHtml = html.slice(idx, idx + 30000);
    expect(trendsHtml).toContain('Quality');
    expect(trendsHtml).toContain('chart-trends-coverage');
  });

  it('renders filter bar buttons in Trends tab', () => {
    const html = renderHtml(trendsData);
    const idx = html.indexOf('id="tab-trends"');
    const trendsHtml = html.slice(idx, idx + 30000);
    expect(trendsHtml).toContain('trends-filter-bar');
    expect(trendsHtml).toContain('data-range="all"');
    expect(trendsHtml).toContain('data-range="7"');
    expect(trendsHtml).toContain('data-range="30"');
    expect(trendsHtml).toContain('data-range="90"');
  });

  it('includes setTrendsRange function', () => {
    const html = renderHtml(trendsData);
    expect(html).toContain('function setTrendsRange');
    expect(html).toContain("localStorage.setItem('pv-trends-range'");
  });

  it('restores trends range from localStorage', () => {
    const html = renderHtml(trendsData);
    expect(html).toContain("localStorage.getItem('pv-trends-range'");
  });

  it('applies gradient fills via createLinearGradient', () => {
    const html = renderHtml(trendsData);
    expect(html).toContain('createLinearGradient');
    expect(html).toContain('addColorStop');
  });
});

describe('US-0105 costs polish', () => {
  it('sparkline() returns empty string for < 2 values', () => {
    expect(sparkline([])).toBe('');
    expect(sparkline([5])).toBe('');
  });

  it('sparkline() returns SVG polyline for >= 2 values', () => {
    const svg = sparkline([1, 2, 3]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<polyline');
    expect(svg).toContain('sparkline-svg');
  });

  it('usd() wraps $ in currency-sign span', () => {
    const html = renderHtml(sampleData);
    expect(html).toContain('<span class="currency-sign">$</span>');
  });

  it('renders delta arrow beside totalSpent when deltaSpend provided', () => {
    const html = renderHtml({
      ...sampleData,
      deltaSpend: 5.5,
      budget: {
        hasBudget: true,
        epicBudgets: [],
        totalBudget: 100,
        totalSpent: 50,
        burnRate: 0,
        daysRemaining: null,
      },
    });
    const costsIdx = html.indexOf('id="tab-costs"');
    const costsHtml = html.slice(costsIdx, costsIdx + 5000);
    expect(costsHtml).toMatch(/delta-arrow|delta-up|delta-down|delta-flat/);
  });

  it('uses .progress-bar class instead of inline height/background style', () => {
    const html = renderHtml({
      ...sampleData,
      budget: {
        hasBudget: true,
        epicBudgets: [{ id: 'EPIC-0001', budget: 100, spent: 50, remaining: 50, percentUsed: 50 }],
        totalBudget: 100,
        totalSpent: 50,
        burnRate: 0,
        daysRemaining: null,
      },
    });
    expect(html).toContain('class="progress-bar"');
    expect(html).not.toMatch(/style="width:60px;height:6px;background:#334155/);
  });
});

describe('renderHtml — kanban tab US-0101', () => {
  const kanbanData = {
    ...sampleData,
    stories: [
      { ...sampleData.stories[0], id: 'US-0001', priority: 'P0', status: 'In Progress' },
      { ...sampleData.stories[0], id: 'US-0002', priority: 'P1', status: 'Planned', branch: 'feature/US-0002' },
      { ...sampleData.stories[0], id: 'US-0003', priority: 'P2', status: 'To Do', branch: 'feature/US-0003' },
    ],
    costs: {
      'US-0001': { projectedUsd: 100, aiCostUsd: 0.1, inputTokens: 1000, outputTokens: 500 },
      'US-0002': { projectedUsd: 100, aiCostUsd: 0.1, inputTokens: 1000, outputTokens: 500 },
      'US-0003': { projectedUsd: 100, aiCostUsd: 0.1, inputTokens: 1000, outputTokens: 500 },
      _totals: { costUsd: 0.3, inputTokens: 3000, outputTokens: 1500 },
    },
    atRisk: {},
  };

  let html;
  beforeAll(() => { html = renderHtml(kanbanData); });

  // TC-0140
  it('TC-0140: kanban column headers have gradient and accent border', () => {
    expect(html).toMatch(/ksw-status-cell/);
    expect(html).toMatch(/border-bottom:\s*2px solid/);
  });

  // TC-0141
  it('TC-0141: P0 card renders danger border-left; P1 renders warn border-left', () => {
    expect(html).toMatch(/badge-danger-text[^)]*\)/);
    expect(html).toMatch(/badge-warn-text[^)]*\)/);
  });

  // TC-0142
  it('TC-0142: In-Progress column cell has ksw-inprogress class', () => {
    expect(html).toMatch(/ksw-inprogress/);
  });

  // TC-0143
  it('TC-0143: WIP pill element is present in kanban output', () => {
    expect(html).toMatch(/wip-pill/);
  });

  // TC-0144
  it('TC-0144: story-card-hover hover uses CSS variable not hardcoded rgba', () => {
    expect(html).toMatch(/story-card-hover:hover[^}]*var\(--shadow-card-hover\)/);
    expect(html).not.toMatch(/story-card-hover:hover[^}]*rgba\(0,0,0/);
  });
});

describe('renderHtml — traceability tab US-0102', () => {
  const tcData = {
    ...sampleData,
    testCases: [
      { id: 'TC-0001', relatedStory: 'US-0001', relatedAC: 'AC-0001', status: 'Pass',    defect: 'None',     title: 'Passes', type: 'Functional' },
      { id: 'TC-0002', relatedStory: 'US-0001', relatedAC: 'AC-0001', status: 'Fail',    defect: 'BUG-0001', title: 'Fails',  type: 'Functional' },
      { id: 'TC-0003', relatedStory: 'US-0001', relatedAC: 'AC-0001', status: 'Not Run', defect: 'None',     title: 'Pending',type: 'Functional' },
    ],
  };

  let html;
  beforeAll(() => { html = renderHtml(tcData); });

  // TC-0145
  it('TC-0145: TC cells render tc-dot class not letter text', () => {
    expect(html).toMatch(/class="tc-dot tc-dot-success"/);
    expect(html).toMatch(/class="tc-dot tc-dot-danger"/);
    expect(html).toMatch(/class="tc-dot tc-dot-warn"/);
    expect(html).not.toMatch(/<td[^>]*>\s*Pass\s*<\/td>/);
    expect(html).not.toMatch(/<td[^>]*>\s*Fail\s*<\/td>/);
  });

  // TC-0146
  it('TC-0146: first column th and story td have trace-sticky-col class', () => {
    expect(html).toMatch(/class="[^"]*trace-sticky-col[^"]*"/);
  });

  // TC-0147
  it('TC-0147: caption contains pass/fail/not-run counts', () => {
    expect(html).toMatch(/trace-caption/);
    expect(html).toMatch(/Pass:\s*\d/);
    expect(html).toMatch(/Fail:\s*\d/);
    expect(html).toMatch(/Not Run:\s*\d/);
  });

  // TC-0148
  it('TC-0148: TC header th elements have data-col attributes', () => {
    expect(html).toMatch(/data-col="TC-0001"/);
    expect(html).toMatch(/data-col="TC-0002"/);
  });
});
