'use strict';

const {
  renderModeBadge,
  renderChrome,
  renderMasthead,
  renderCompletionBanner,
} = require('../../tools/lib/render-shell');

const minData = {
  projectName: 'Test Project',
  release: 'R1.0',
  tagline: 'A test project',
  branch: 'develop',
  commitSha: 'abc1234',
  generatedAt: '2026-04-21T00:00:00Z',
  stories: [
    { id: 'US-0001', status: 'Done' },
    { id: 'US-0002', status: 'In Progress' },
    { id: 'US-0003', status: 'Retired' },
  ],
  bugs: [
    { id: 'BUG-0001', status: 'Open' },
    { id: 'BUG-0002', status: 'Fixed' },
  ],
  coverage: { available: true, overall: 82.5, meetsTarget: true },
  costs: { _totals: { costUsd: 12.34 } },
  epics: [],
  budget: null,
  completion: null,
};

describe('renderModeBadge', () => {
  describe('report mode (default)', () => {
    let html;
    beforeEach(() => {
      html = renderModeBadge('report');
    });

    test('contains mode-badge class', () => expect(html).toContain('mode-badge'));
    test('contains mode-report class', () => expect(html).toContain('mode-report'));
    test('does NOT contain mode-live class', () => expect(html).not.toContain('mode-live'));
    test('contains REPORT label', () => expect(html).toContain('REPORT'));
    test('aria-label is Mode: Report', () => expect(html).toContain('aria-label="Mode: Report"'));
    test('is keyboard-focusable (tabindex=0)', () => expect(html).toContain('tabindex="0"'));
    test('pip is aria-hidden', () => expect(html).toContain('aria-hidden="true"'));
  });

  describe('live mode', () => {
    let html;
    beforeEach(() => {
      html = renderModeBadge('live');
    });

    test('contains mode-badge class', () => expect(html).toContain('mode-badge'));
    test('contains mode-live class', () => expect(html).toContain('mode-live'));
    test('does NOT contain mode-report class', () => expect(html).not.toContain('mode-report'));
    test('contains LIVE label', () => expect(html).toContain('LIVE'));
    test('aria-label is Mode: Live', () => expect(html).toContain('aria-label="Mode: Live"'));
    test('is keyboard-focusable (tabindex=0)', () => expect(html).toContain('tabindex="0"'));
  });

  test('defaults to report mode when no argument', () => {
    const html = renderModeBadge();
    expect(html).toContain('mode-report');
    expect(html).toContain('REPORT');
  });
});

describe('renderChrome (US-0136)', () => {
  let html;
  beforeEach(() => {
    html = renderChrome(minData);
  });

  test('contains pv-chrome class', () => expect(html).toContain('pv-chrome'));
  test('contains brand dot element', () => expect(html).toContain('pv-chrome-dot'));
  test('contains project name', () => expect(html).toContain('Test Project'));
  test('contains Plan-Status switcher button', () => expect(html).toContain('Plan-Status'));
  test('contains Pipeline switcher link', () => expect(html).toContain('Pipeline'));
  test('embeds mode-badge (via renderModeBadge)', () => expect(html).toContain('mode-badge'));
  test('contains About button', () => expect(html).toContain('About'));
  test('contains Light theme button', () => expect(html).toContain('Light'));
  test('contains Dark theme button', () => expect(html).toContain('Dark'));
  test('height-constraining class present', () => expect(html).toContain('pv-chrome'));
  test('XSS-safe: project name is escaped', () => {
    const xss = renderChrome({ ...minData, projectName: '<script>alert(1)</script>' });
    expect(xss).not.toContain('<script>alert(1)</script>');
    expect(xss).toContain('&lt;script&gt;');
  });
  test('handles missing data gracefully', () => {
    const h = renderChrome(null);
    expect(h).toContain('Plan Visualizer');
  });
});

describe('renderMasthead (US-0136)', () => {
  let html;
  beforeEach(() => {
    html = renderMasthead(minData);
  });

  test('contains pv-masthead class', () => expect(html).toContain('pv-masthead'));
  test('contains project name', () => expect(html).toContain('Test Project'));
  test('contains release string', () => expect(html).toContain('R1.0'));
  test('stories ratio excludes Retired', () => expect(html).toContain('1/2'));
  test('coverage percentage displayed', () => expect(html).toContain('82.5%'));
  test('open bugs count (excludes Fixed)', () => expect(html).toContain('>1<'));
  test('AI spend formatted', () => expect(html).toContain('12'));
  test('shows N/A when coverage unavailable', () => {
    const h = renderMasthead({ ...minData, coverage: { available: false } });
    expect(h).toContain('N/A');
  });
});

describe('renderCompletionBanner (EPIC-0010 preservation)', () => {
  test('returns empty string when completion is null', () => {
    expect(renderCompletionBanner(minData)).toBe('');
  });

  test('renders banner when completion data present', () => {
    const data = {
      ...minData,
      completion: { likelyDate: 'May 15', rangeStart: 'May 10', rangeEnd: 'May 20', velocityWeeks: 3 },
    };
    const html = renderCompletionBanner(data);
    expect(html).toContain('completion-banner');
    expect(html).toContain('May 15');
    expect(html).toContain('May 10');
    expect(html).toContain('May 20');
    expect(html).toContain('3');
  });

  test('XSS-safe: likelyDate is escaped', () => {
    const data = {
      ...minData,
      completion: { likelyDate: '<b>bad</b>', rangeStart: 'a', rangeEnd: 'b', velocityWeeks: 1 },
    };
    const html = renderCompletionBanner(data);
    expect(html).not.toContain('<b>bad</b>');
    expect(html).toContain('&lt;b&gt;');
  });
});
