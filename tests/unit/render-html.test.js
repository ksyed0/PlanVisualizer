'use strict';
const { renderHtml } = require('../../tools/lib/render-html');

const sampleData = {
  epics: [{ id: 'EPIC-0001', title: 'Code Editing', status: 'In Progress', releaseTarget: 'MVP', dependencies: [] }],
  stories: [{ id: 'US-0001', epicId: 'EPIC-0001', title: 'Open a file', priority: 'P0', estimate: 'M', status: 'In Progress', branch: 'feature/US-0001', acs: [], dependencies: [] }],
  tasks: [],
  testCases: [],
  bugs: [],
  costs: { 'US-0001': { projectedUsd: 800, aiCostUsd: 0.47, inputTokens: 50000, outputTokens: 14000 }, _totals: { costUsd: 0.89, inputTokens: 95000, outputTokens: 26000 } },
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
  beforeAll(() => { html = renderHtml(sampleData); });

  it('returns a string', () => expect(typeof html).toBe('string'));
  it('includes DOCTYPE', () => expect(html).toMatch(/<!DOCTYPE html>/));
  it('includes Tailwind CDN', () => expect(html).toContain('cdn.tailwindcss.com'));
  it('includes Chart.js CDN', () => expect(html).toContain('cdn.jsdelivr.net'));
  it('includes project name', () => expect(html).toMatch(/NomadCode/));
  it('includes generated timestamp', () => expect(html).toMatch(/2026-03-10/));
  it('includes commit SHA', () => expect(html).toMatch(/abc1234/));
  it('includes total projected cost', () => expect(html).toMatch(/\$800/));
  it('includes coverage percent', () => expect(html).toMatch(/81/));
  it('includes epic filter option', () => expect(html).toMatch(/EPIC-0001/));
  it('includes all 6 tabs', () => {
    expect(html).toMatch(/Hierarchy/);
    expect(html).toMatch(/Kanban/);
    expect(html).toMatch(/Traceability/);
    expect(html).toMatch(/Charts/);
    expect(html).toMatch(/Costs/);
    expect(html).toMatch(/Bugs/);
  });
  it('marks at-risk story with warning', () => expect(html).toMatch(/at-risk|⚠/));
});

describe('renderHtml — bugs tab', () => {
  it('renders bug rows when bugs present', () => {
    const dataWithBug = { ...sampleData, bugs: [{ id: 'BUG-0001', title: 'Crash', severity: 'High', status: 'Open', relatedStory: 'US-0001', fixBranch: 'bugfix/BUG-0001', lessonEncoded: 'Yes' }] };
    const html = renderHtml(dataWithBug);
    expect(html).toMatch(/BUG-0001/);
    expect(html).toMatch(/Crash/);
  });
});

describe('renderHtml — traceability tab', () => {
  it('renders matrix when test cases present', () => {
    const dataWithTCs = { ...sampleData, testCases: [{ id: 'TC-0001', relatedStory: 'US-0001', relatedAC: 'AC-0001', status: 'Pass', defect: 'None', title: 'Test', type: 'Functional' }] };
    const html = renderHtml(dataWithTCs);
    expect(html).toMatch(/TC-0001/);
    expect(html).toMatch(/Legend/);
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
    expect(html).toMatch(/padding-right:280px/);
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
      testCases: [{ id: 'TC-0001', relatedStory: 'US-0001', relatedAC: 'AC-0001', status: 'Pass', defect: 'None', title: 'Test', type: 'Functional' }],
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
    expect(html).toMatch(/text-red-400/);
  });
});

describe('renderHtml — badge fallback', () => {
  it('uses grey fallback for unknown status', () => {
    const dataUnknown = {
      ...sampleData,
      stories: [{ ...sampleData.stories[0], status: 'UNKNOWN_STATUS', priority: 'P3' }],
      atRisk: { 'US-0001': { missingTCs: false, noBranch: false, failedTCNoBug: false, isAtRisk: false } },
    };
    const html = renderHtml(dataUnknown);
    expect(html).toMatch(/bg-gray-100 text-gray-600/);
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
      testCases: [{ id: 'TC-0002', relatedStory: 'US-0001', relatedAC: 'AC-0001', status: 'Fail', defect: 'BUG-0001', title: 'Fail test', type: 'Functional' }],
    };
    const html = renderHtml(dataFailTC);
    expect(html).toMatch(/bg-red-100/);
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
      bugs: [{ id: 'BUG-0002', title: 'Some bug', severity: 'Medium', status: 'Fixed', relatedStory: 'US-0001', fixBranch: '', lessonEncoded: 'No' }],
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
      testCases: [{ id: 'TC-0003', relatedStory: 'US-0001', relatedAC: 'AC-0001', status: 'Not Run', defect: 'None', title: 'Not run test', type: 'Functional' }],
    };
    const html = renderHtml(dataNotRunTC);
    expect(html).toMatch(/TC-0003/);
  });
});

describe('renderHtml — sticky header (BUG-0004 regression)', () => {
  it('wraps header in a sticky container', () => {
    const html = renderHtml(sampleData);
    expect(html).toContain('sticky top-0 z-30');
  });
});

describe('renderHtml — projected cost from data.costs (BUG-0006)', () => {
  it('uses data.costs.projectedUsd not TSHIRT_HOURS', () => {
    const html = renderHtml(sampleData);
    expect(html).toMatch(/\$800/);
  });
});

describe('renderHtml — f-type filter (BUG-0009)', () => {
  it('includes f-type select in filter bar', () => {
    expect(renderHtml(sampleData)).toContain('id="f-type"');
  });
  it('assigns bug-row class to bug table rows', () => {
    const dataWithBug = { ...sampleData, bugs: [{ id: 'BUG-0001', title: 'Crash', severity: 'High', status: 'Open', relatedStory: 'US-0001', fixBranch: 'bugfix/BUG-0001', lessonEncoded: 'No' }] };
    expect(renderHtml(dataWithBug)).toContain('bug-row');
  });
});

describe('renderHtml — coverage available false shows N/A (BUG-0010)', () => {
  it('shows N/A when coverage not available', () => {
    const noFile = { ...sampleData, coverage: { lines: 0, overall: 0, branches: 0, meetsTarget: false, available: false } };
    const html = renderHtml(noFile);
    expect(html).toMatch(/N\/A/);
  });
});
