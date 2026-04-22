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
    expect(BADGE_TONE.Fixed).toBe('success');
    expect(BADGE_TONE.Open).toBe('danger');
    expect(BADGE_TONE['In Progress']).toBe('info');
  });

  it('maps exactly 17 known labels', () => {
    // Locks the extracted vocabulary at 17 entries (the full set defined
    // in US-0097). Additions are fine but must be deliberate — this test
    // forces a test update alongside any vocabulary growth.
    expect(Object.keys(BADGE_TONE)).toHaveLength(17);
  });
});

describe('theme.js — badge() tone resolution', () => {
  // One representative label per semantic category. If the resolution
  // logic regresses, at least one of these will fail.
  const cases = [
    { label: 'Done', tone: 'success' },
    { label: 'To Do', tone: 'warn' },
    { label: 'Blocked', tone: 'danger' },
    { label: 'In Progress', tone: 'info' },
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
