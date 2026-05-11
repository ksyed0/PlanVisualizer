'use strict';
const { renderSettingsTab } = require('../../tools/lib/render-tabs');

describe('renderSettingsTab — Memory card', () => {
  const baseData = (extra = {}) => ({
    githubConfig: { enabled: false, repo: 'x/y' },
    githubTokenSet: false,
    syncState: null,
    memoryConfig: { staleDays: 90, autoArchive: false },
    ...extra,
  });

  test('renders Memory heading', () => {
    const html = renderSettingsTab(baseData());
    expect(html).toContain('Memory');
    expect(html).toContain('Stale threshold');
  });

  test('renders staleDays input with config value', () => {
    const html = renderSettingsTab(baseData({ memoryConfig: { staleDays: 45, autoArchive: false } }));
    expect(html).toContain('value="45"');
  });

  test('renders autoArchive toggle as checked when true', () => {
    const html = renderSettingsTab(baseData({ memoryConfig: { staleDays: 90, autoArchive: true } }));
    expect(html).toContain('id="memory-autoArchive"');
    expect(html).toMatch(/id="memory-autoArchive"[^>]*checked/);
  });

  test('falls back to defaults when memoryConfig missing', () => {
    const html = renderSettingsTab({
      githubConfig: { enabled: false, repo: 'x/y' },
      githubTokenSet: false,
      syncState: null,
    });
    expect(html).toContain('value="90"');
  });
});
