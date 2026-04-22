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

// US-0137: OKLCH design token palette.
// All values use OKLCH (perceptually uniform). Support: Chrome 111+, Firefox 113+, Safari 15.4+.
const palette = {
  ink0: 'oklch(99% 0.004 95)',
  ink1: 'oklch(97% 0.004 95)',
  ink2: 'oklch(94% 0.006 95)',
  ink3: 'oklch(88% 0.008 95)',
  ink4: 'oklch(70% 0.012 95)',
  ink5: 'oklch(52% 0.015 95)',
  ink6: 'oklch(38% 0.015 95)',
  ink7: 'oklch(24% 0.018 95)',
  ink8: 'oklch(16% 0.018 95)',
  ink9: 'oklch(10% 0.018 95)',
  ink10: 'oklch(6%  0.018 95)',

  planAccent: 'oklch(62% 0.19 268)',
  planAccentSoft: 'oklch(62% 0.19 268 / 0.14)',
  planAccentInk: 'oklch(42% 0.18 268)',
  liveAccent: 'oklch(72% 0.19 38)',
  liveAccentSoft: 'oklch(72% 0.19 38 / 0.18)',
  liveAccentInk: 'oklch(55% 0.18 38)',

  ok: 'oklch(68% 0.15 150)',
  warn: 'oklch(74% 0.16 78)',
  risk: 'oklch(64% 0.20 25)',
  info: 'oklch(66% 0.14 240)',
};

const chartColors = {
  ok: palette.ok,
  warn: palette.warn,
  risk: palette.risk,
  info: palette.info,
  accent: palette.planAccent,
  mute: palette.ink4,
};

function generateCssTokens() {
  return `/* === US-0137 OKLCH design tokens === */
  :root {
    --font-sans:    'Inter Tight', ui-sans-serif, system-ui, sans-serif;
    --font-display: 'Inter Tight', ui-sans-serif, system-ui, sans-serif;
    --font-mono:    'JetBrains Mono', ui-monospace, monospace;

    --plan-accent:      ${palette.planAccent};
    --plan-accent-soft: ${palette.planAccentSoft};
    --plan-accent-ink:  ${palette.planAccentInk};
    --live-accent:      ${palette.liveAccent};
    --live-accent-soft: ${palette.liveAccentSoft};
    --live-accent-ink:  ${palette.liveAccentInk};

    --ok:   ${palette.ok};
    --warn: ${palette.warn};
    --risk: ${palette.risk};
    --info: ${palette.info};
  }

  [data-theme="light"] {
    --bg:          ${palette.ink1};
    --bg-sunk:     ${palette.ink2};
    --surface:     ${palette.ink0};
    --surface-2:   ${palette.ink1};
    --border:      ${palette.ink3};
    --border-soft: oklch(94% 0.006 95 / 0.6);
    --text:        ${palette.ink9};
    --text-dim:    ${palette.ink5};
    --text-mute:   ${palette.ink4};
    --shadow:      0 1px 0 rgba(15,15,20,.03), 0 4px 16px -8px rgba(15,15,20,.08);
    --shadow-lg:   0 2px 0 rgba(15,15,20,.04), 0 12px 32px -12px rgba(15,15,20,.12);
    --grid-dot:    rgba(30,30,40,0.08);
  }

  [data-theme="dark"] {
    --bg:          ${palette.ink10};
    --bg-sunk:     oklch(4% 0.018 95);
    --surface:     ${palette.ink9};
    --surface-2:   ${palette.ink8};
    --border:      oklch(22% 0.018 95);
    --border-soft: oklch(22% 0.018 95 / 0.5);
    --text:        ${palette.ink1};
    --text-dim:    ${palette.ink4};
    --text-mute:   ${palette.ink5};
    --shadow:      0 1px 0 rgba(0,0,0,.35), 0 6px 20px -8px rgba(0,0,0,.5);
    --shadow-lg:   0 2px 0 rgba(0,0,0,.4), 0 18px 36px -14px rgba(0,0,0,.55);
    --grid-dot:    rgba(200,210,230,0.06);
  }`.trim();
}

module.exports = { BADGE_TONE, badge, palette, chartColors, generateCssTokens };
