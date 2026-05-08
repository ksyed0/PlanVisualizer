'use strict';

describe('render-utils', () => {
  describe('esc', () => {
    const { esc } = require('../../tools/lib/render-utils');
    test('escapes HTML entities', () => {
      expect(esc('<div>')).toBe('&lt;div&gt;');
      expect(esc('&')).toBe('&amp;');
      expect(esc('"')).toBe('&quot;');
    });
  });

  describe('timeAgo', () => {
    const { timeAgo } = require('../../tools/lib/render-utils');

    test('returns empty string for null/undefined', () => {
      expect(timeAgo(null)).toBe('');
      expect(timeAgo(undefined)).toBe('');
      expect(timeAgo('')).toBe('');
    });

    test('returns "just now" for sub-minute timestamps', () => {
      const iso = new Date(Date.now() - 30000).toISOString();
      expect(timeAgo(iso)).toBe('just now');
    });

    test('returns Xm ago for minutes', () => {
      const iso = new Date(Date.now() - 5 * 60000).toISOString();
      expect(timeAgo(iso)).toBe('5m ago');
    });

    test('returns Xh ago for hours', () => {
      const iso = new Date(Date.now() - 3 * 3600000).toISOString();
      expect(timeAgo(iso)).toBe('3h ago');
    });

    test('returns >1d ago for older timestamps', () => {
      const iso = new Date(Date.now() - 25 * 3600000).toISOString();
      expect(timeAgo(iso)).toBe('>1d ago');
    });
  });
});
