'use strict';

// US-0125 (EPIC-0016): Unit tests for the extracted badge theme module
// (tools/lib/theme.js). Mirrors the tone assertions in render-html.test.js
// so that any drift between the inline and extracted implementations would
// fail here first. Independent of filesystem state — the module is a pure
// data + render helper.

const { BADGE_TONE, badge } = require('../../tools/lib/theme');

describe('theme.js — export surface', () => {
  it('exports BADGE_TONE as a plain object', () => {
    expect(typeof BADGE_TONE).toBe('object');
    expect(BADGE_TONE).not.toBeNull();
    expect(Array.isArray(BADGE_TONE)).toBe(false);
  });

  it('exports badge as a function', () => {
    expect(typeof badge).toBe('function');
  });

  it('includes the canonical semantic labels (spot-check)', () => {
    // Sample three labels from three different tone buckets — if any of
    // these regress to the wrong tone the Plan Visualizer's status pills
    // will render the wrong colour.
    expect(BADGE_TONE.Fixed).toBe('info');
    expect(BADGE_TONE.Open).toBe('warn');
    expect(BADGE_TONE['In Progress']).toBe('warn');
  });

  it('maps exactly 20 known labels', () => {
    // BUG-0190 update: Added Rejected, Cancelled, Retired (neutral) so
    // bug statuses render as short-keyword badges. Vocabulary 17 → 20.
    expect(Object.keys(BADGE_TONE)).toHaveLength(20);
  });
});

describe('theme.js — badge() tone resolution', () => {
  // One representative label per semantic category. If the resolution
  // logic regresses, at least one of these will fail.
  const cases = [
    { label: 'Done', tone: 'info' },
    { label: 'To Do', tone: 'neutral' },
    { label: 'Blocked', tone: 'warn' },
    { label: 'In Progress', tone: 'warn' },
    { label: 'Planned', tone: 'neutral' },
  ];

  cases.forEach(({ label, tone }) => {
    it(`badge(${JSON.stringify(label)}) emits class="badge badge-${tone}"`, () => {
      const html = badge(label);
      expect(html).toBe(`<span class="badge badge-${tone}">${label}</span>`);
    });
  });
});

describe('theme.js — badge() fallback for unknown labels', () => {
  it('uses badge-neutral for an unmapped label', () => {
    expect(badge('SomeUnknownLabel')).toBe('<span class="badge badge-neutral">SomeUnknownLabel</span>');
  });

  it('uses badge-neutral for an empty string', () => {
    // esc('') === ''; fallback tone is neutral.
    expect(badge('')).toBe('<span class="badge badge-neutral"></span>');
  });

  it('HTML-escapes the displayed text to prevent markup injection', () => {
    // Mirrors the security expectation in render-html.test.js — the tone
    // map lookup uses the raw string but the rendered text is escaped.
    const html = badge('<script>alert(1)</script>');
    expect(html).toContain('class="badge badge-neutral"');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('AC-0498 — no hex literals in generated HTML', () => {
  test('renderHtml output contains no hex colour literals', () => {
    const { renderHtml } = require('../../tools/lib/render-html');
    const data = {
      epics: [],
      stories: [],
      tasks: [],
      testCases: [],
      bugs: [],
      lessons: [],
      costs: { _totals: { costUsd: 0, projectedUsd: 0 } },
      atRisk: {},
      coverage: { available: false },
      recentActivity: [],
      generatedAt: new Date().toISOString(),
      commitSha: 'x',
      projectName: 'T',
      tagline: '',
      risk: { byStory: new Map(), byEpic: new Map() },
      sdlcStatus: null,
      completion: null,
    };
    const html = renderHtml(data);
    const hits = html.match(/#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(/g) || [];
    expect(hits).toHaveLength(0);
  });
});

describe('theme.js — parity with render-html re-export', () => {
  it('render-html re-exports the same BADGE_TONE object', () => {
    // AC-0431: existing render-html callers must keep seeing BADGE_TONE /
    // badge via require('./render-html'). Assert identity (same reference)
    // so we know render-html consumes theme.js rather than shadowing it.
    const renderHtml = require('../../tools/lib/render-html');
    expect(renderHtml.BADGE_TONE).toBe(BADGE_TONE);
    expect(renderHtml.badge).toBe(badge);
  });
});

describe('theme token exports — US-0137', () => {
  const theme = require('../../tools/lib/theme');

  test('palette exports ink scale', () => {
    expect(theme.palette.ink0).toMatch(/oklch/);
  });

  test('chartColors has ok/warn/risk/info/accent/mute', () => {
    ['ok', 'warn', 'risk', 'info', 'accent', 'mute'].forEach((k) => expect(theme.chartColors[k]).toBeDefined());
  });

  test('type has sans and mono', () => {
    expect(theme.type.sans).toBeDefined();
    expect(theme.type.mono).toBeDefined();
  });

  test('radius.full is 9999px', () => {
    expect(theme.radius.full).toBe('9999px');
  });

  test('shadow.card is defined', () => {
    expect(theme.shadow.card).toBeDefined();
  });

  test('spacing[1] is 4px', () => {
    expect(theme.spacing['1']).toBe('4px');
  });

  test('chromeTokens contains --chrome-bg and no hex', () => {
    expect(theme.chromeTokens).toContain('--chrome-bg');
    expect(theme.chromeTokens).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  test('generateCssTokens has :root and [data-theme="dark"] and no hex', () => {
    const css = theme.generateCssTokens();
    expect(css).toContain(':root');
    expect(css).toContain('[data-theme="dark"]');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  test('generateDashboardCssTokens has --live-accent and no hex', () => {
    const css = theme.generateDashboardCssTokens();
    expect(css).toContain('--live-accent');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});

describe('US-0141 — Dual Theme tokens', () => {
  const theme = require('../../tools/lib/theme');

  test('generateCssTokens has dark mode block', () => {
    expect(theme.generateCssTokens()).toContain('[data-theme="dark"]');
  });

  test('dark mode bg is not pure black', () => {
    expect(theme.generateCssTokens()).not.toContain('#000');
    expect(theme.generateCssTokens()).not.toContain('#fff');
  });
});

describe('theme.js — OKLCH palette tokens (US-0137)', () => {
  const { palette, chartColors, generateCssTokens } = require('../../tools/lib/theme');

  it('exports palette object', () => {
    expect(typeof palette).toBe('object');
    expect(palette).not.toBeNull();
  });

  it('palette contains planAccent and liveAccent keys', () => {
    expect(palette).toHaveProperty('planAccent');
    expect(palette).toHaveProperty('liveAccent');
    expect(palette).toHaveProperty('planAccentSoft');
    expect(palette).toHaveProperty('planAccentInk');
    expect(palette).toHaveProperty('liveAccentSoft');
    expect(palette).toHaveProperty('liveAccentInk');
    expect(palette.planAccent).toMatch(/oklch/);
    expect(palette.liveAccent).toMatch(/oklch/);
    expect(palette.planAccentSoft).toMatch(/oklch/);
    expect(palette.planAccentInk).toMatch(/oklch/);
    expect(palette.liveAccentSoft).toMatch(/oklch/);
    expect(palette.liveAccentInk).toMatch(/oklch/);
  });

  it('palette contains all 11 ink stops (ink0 through ink10)', () => {
    for (let i = 0; i <= 10; i++) {
      expect(palette).toHaveProperty(`ink${i}`);
    }
  });

  it('palette contains semantic tokens ok/warn/risk/info', () => {
    ['ok', 'warn', 'risk', 'info'].forEach((k) => {
      expect(palette).toHaveProperty(k);
      expect(palette[k]).toMatch(/oklch/);
    });
  });

  it('exports chartColors with required keys', () => {
    expect(typeof chartColors).toBe('object');
    ['ok', 'warn', 'risk', 'info', 'accent', 'mute'].forEach((k) => {
      expect(chartColors).toHaveProperty(k);
    });
  });

  it('exports generateCssTokens as a function returning a string', () => {
    expect(typeof generateCssTokens).toBe('function');
    const css = generateCssTokens();
    expect(typeof css).toBe('string');
    expect(css).toContain('--plan-accent');
    expect(css).toContain('--live-accent');
    expect(css).toContain('--ok');
    expect(css).toContain('--warn');
    expect(css).toContain('--risk');
    expect(css).toContain('--info');
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('[data-theme="dark"]');
  });

  it('generateCssTokens output contains no bare hex literals', () => {
    const css = generateCssTokens();
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}(?![0-9a-fA-F*])/);
  });
});

// US-0141: pvSetTheme() persistence in render-scripts.js
describe('US-0141 — pvSetTheme in renderScripts output', () => {
  const { renderScripts } = require('../../tools/lib/render-scripts');

  it('renderScripts output defines pvSetTheme function', () => {
    const html = renderScripts({ data: { sdlcStatus: null } });
    expect(html).toContain('function pvSetTheme');
  });

  it('pvSetTheme persists to localStorage under pv-theme key', () => {
    const html = renderScripts({ data: { sdlcStatus: null } });
    expect(html).toContain("localStorage.setItem('pv-theme'");
  });

  it('init reads localStorage pv-theme before falling back to prefers-color-scheme', () => {
    const html = renderScripts({ data: { sdlcStatus: null } });
    expect(html).toContain("localStorage.getItem('pv-theme')");
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('setTheme is an alias for pvSetTheme (backward compat)', () => {
    const html = renderScripts({ data: { sdlcStatus: null } });
    expect(html).toContain('var setTheme = pvSetTheme');
  });

  it('OS theme change listener is wired when no stored pref exists', () => {
    const html = renderScripts({ data: { sdlcStatus: null } });
    expect(html).toContain("addEventListener('change'");
  });
});
