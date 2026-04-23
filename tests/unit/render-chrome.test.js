'use strict';

const {
  renderChrome,
  renderModeBadge,
  renderDashboardSwitcher,
  renderThemeToggle,
} = require('../../tools/lib/render-chrome');

describe('render-chrome — US-0137/US-0138', () => {
  test('report badge has aria-label and mode-report class, no pulse', () => {
    const h = renderModeBadge('report');
    expect(h).toContain('mode-report');
    expect(h).toContain('aria-label="Mode: Report"');
    expect(h).not.toContain('mode-pip-pulse');
  });

  test('live badge has pulsing pip and mode-live', () => {
    const h = renderModeBadge('live');
    expect(h).toContain('mode-live');
    expect(h).toContain('aria-label="Mode: Live"');
    expect(h).toContain('mode-pip-pulse');
  });

  test('plan-status active on switcher when mode=report', () => {
    expect(renderDashboardSwitcher('plan-status')).toMatch(/pv-seg-active[^>]*>Plan-Status/);
  });

  test('pipeline active on switcher when mode=pipeline', () => {
    expect(renderDashboardSwitcher('pipeline')).toMatch(/pv-seg-active[^>]*>Pipeline/);
  });

  test('renderChrome report has pv-chrome and mode-report badge', () => {
    const h = renderChrome('report', {});
    expect(h).toContain('pv-chrome');
    expect(h).toContain('mode-report');
    // header tag should not have live class
    expect(h).not.toContain('mode-live-bg');
    expect(h).not.toContain('aria-label="Mode: Live"');
  });

  test('renderChrome live has mode-live badge not mode-report badge', () => {
    const h = renderChrome('live', {});
    expect(h).toContain('mode-live');
    expect(h).toContain('aria-label="Mode: Live"');
    expect(h).not.toContain('aria-label="Mode: Report"');
  });

  test('renderChrome output has no hex colour literals', () => {
    const h = renderChrome('report', {}) + renderChrome('live', {});
    expect(h).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
