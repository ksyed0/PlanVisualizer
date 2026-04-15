'use strict';

// US-0125 (EPIC-0016): Shared badge theme tokens. Extracted from
// tools/lib/render-html.js so that both the Plan Visualizer
// (render-html.js) and the Agentic Dashboard (generate-dashboard.js)
// render semantic badges with the same vocabulary. Future stories
// (US-0118/US-0119/US-0121) will consume this module when unifying the
// Agentic Dashboard's visual language with the Plan Visualizer.
//
// Scope is intentionally narrow: BADGE_TONE + badge() only. Colours,
// spacing, and other theme concerns remain in their respective renderers
// and are tracked by later stories.

// US-0097 (EPIC-0015): Semantic badge token system. Maps 17 known badge labels
// to 5 semantic tones (success/warn/danger/info/neutral). Colours flow from
// CSS variables defined in :root and html.dark so badges adapt to theme
// (fixes BUG-0110 where hardcoded dark hex values rendered as dark rectangles
// in light mode).
const BADGE_TONE = {
  // success
  Done: 'success',
  Pass: 'success',
  Fixed: 'success',
  // warn
  'To Do': 'warn',
  'Not Run': 'warn',
  Medium: 'warn',
  P1: 'warn',
  High: 'warn',
  // danger
  Blocked: 'danger',
  Fail: 'danger',
  Open: 'danger',
  Critical: 'danger',
  P0: 'danger',
  // info
  'In Progress': 'info',
  // neutral
  Planned: 'neutral',
  Low: 'neutral',
  P2: 'neutral',
};

// Local HTML-escape helper. Kept in-module so theme.js has no runtime
// dependencies and can be required by any renderer without dragging in
// render-html's larger surface. Behaviour is byte-identical to the
// `esc()` helper in render-html.js (BUG-0075 / US-0097 coverage) — if you
// change one, change both.
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function badge(text) {
  const tone = BADGE_TONE[text] || 'neutral';
  return `<span class="badge badge-${tone}">${esc(text)}</span>`;
}

module.exports = { BADGE_TONE, badge };
