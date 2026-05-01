'use strict';

const { BADGE_TONE, badge } = require('./theme');

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const jsEsc = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n');

function usd(n) {
  const num = Number(n);
  const sign = '<span class="currency-sign">$</span>';
  if (num >= 1000) return sign + Math.round(num).toLocaleString('en-US');
  if (num > 0) return sign + num.toFixed(2);
  return sign + '0.00';
}

function sparkline(values, w = 24, h = 12) {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = ((i / (values.length - 1)) * w).toFixed(1);
      const y = (h - ((v - min) / range) * (h - 1)).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
  return `<svg width="${w}" height="${h}" class="sparkline-svg" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function deltaArrow(delta) {
  if (delta === null || delta === undefined) return '';
  const abs = Math.abs(delta);
  if (abs < 0.5) return '<span class="delta-arrow delta-flat">= </span>';
  if (delta > 0) return `<span class="delta-arrow delta-up">↑ ${usd(abs)}</span>`;
  return `<span class="delta-arrow delta-down">↓ ${usd(abs)}</span>`;
}

function fmtNum(n) {
  return Number(n).toLocaleString();
}

// BUG-0158: normalize relatedStory — bugs in the register sometimes carry
// extra parenthetical context (e.g. "US-0012 (capture-cost)") or free-form
// strings ("n/a"). Extract the canonical US-XXXX token if present so epic
// grouping works regardless of surrounding text.
function normalizeStoryRef(raw) {
  if (!raw) return null;
  const m = String(raw).match(/US-\d{4}/);
  return m ? m[0] : null;
}

const EPIC_ACCENT_COLORS = [
  { border: '#8b5cf6', bg: 'rgba(139,92,246,0.07)', text: '#8b5cf6' }, // violet
  { border: '#06b6d4', bg: 'rgba(6,182,212,0.07)', text: '#06b6d4' }, // cyan
  { border: '#f59e0b', bg: 'rgba(245,158,11,0.07)', text: '#d97706' }, // amber
  { border: '#10b981', bg: 'rgba(16,185,129,0.07)', text: '#10b981' }, // emerald
  { border: '#f43f5e', bg: 'rgba(244,63,94,0.07)', text: '#f43f5e' }, // rose
  { border: '#3b82f6', bg: 'rgba(59,130,246,0.07)', text: '#3b82f6' }, // blue
  { border: '#a855f7', bg: 'rgba(168,85,247,0.07)', text: '#a855f7' }, // purple
  { border: '#14b8a6', bg: 'rgba(20,184,166,0.07)', text: '#14b8a6' }, // teal
];

module.exports = {
  esc,
  jsEsc,
  usd,
  sparkline,
  deltaArrow,
  fmtNum,
  normalizeStoryRef,
  EPIC_ACCENT_COLORS,
  BADGE_TONE,
  badge,
};
