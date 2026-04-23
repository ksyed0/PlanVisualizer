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
  Rejected: 'neutral',
  Cancelled: 'neutral',
  Retired: 'neutral',
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
  ink1: 'oklch(97% 0.006 95)',
  ink2: 'oklch(94% 0.008 95)',
  ink3: 'oklch(88% 0.010 95)',
  ink4: 'oklch(78% 0.012 95)',
  ink5: 'oklch(65% 0.014 95)',
  ink6: 'oklch(50% 0.014 95)',
  ink7: 'oklch(36% 0.014 95)',
  ink8: 'oklch(16% 0.012 95)',
  ink9: 'oklch(10% 0.008 95)',
  ink10: 'oklch(6%  0.006 95)',

  // Named hues for semantic use
  indigo: 'oklch(56% 0.22 264)',
  orange: 'oklch(72% 0.19 46)',
  green: 'oklch(66% 0.17 145)',
  amber: 'oklch(76% 0.17 80)',
  red: 'oklch(58% 0.22 25)',
  teal: 'oklch(60% 0.14 185)',
  violet: 'oklch(56% 0.22 290)',

  // Legacy aliases (kept for backward compatibility)
  planAccent: 'oklch(62% 0.19 268)',
  planAccentSoft: 'oklch(62% 0.19 268 / 0.14)',
  planAccentInk: 'oklch(42% 0.18 268)',
  liveAccent: 'oklch(72% 0.19 38)',
  liveAccentSoft: 'oklch(72% 0.19 38 / 0.18)',
  liveAccentInk: 'oklch(55% 0.18 38)',

  ok: 'oklch(66% 0.17 145)',
  warn: 'oklch(76% 0.17 80)',
  risk: 'oklch(58% 0.22 25)',
  info: 'oklch(60% 0.14 185)',
};

const chartColors = {
  ok: palette.green,
  warn: palette.amber,
  risk: palette.red,
  info: palette.teal,
  accent: palette.indigo,
  mute: palette.ink5,
};

const type = {
  sans: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  display: "'Inter', sans-serif",
  mono: "'Departure Mono', 'Fira Code', monospace",
};

const radius = { sm: '4px', md: '8px', lg: '12px', full: '9999px' };

const shadow = {
  card: '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)',
  cardHover: '0 4px 12px rgba(0,0,0,.12)',
  modal: '0 20px 60px rgba(0,0,0,.24)',
};

const spacing = Object.fromEntries([1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => [String(n), `${n * 4}px`]));

const chromeTokens = `
  --chrome-bg:      oklch(18% 0.015 220);
  --chrome-brand:   ${palette.ink0};
  --chrome-text:    ${palette.ink2};
  --chrome-muted:   ${palette.ink5};
  --chrome-subtle:  ${palette.ink6};
  --chrome-seg-active-bg: oklch(100% 0 0 / 0.08);
  --chrome-hover-bg:      oklch(100% 0 0 / 0.07);
  --chrome-theme-bg:      oklch(100% 0 0 / 0.07);
  --chrome-theme-active:  oklch(100% 0 0 / 0.12);
  --chrome-report-bg: color-mix(in oklab, ${palette.indigo} 25%, transparent);
  --chrome-report-text: oklch(79% 0.10 264);
  --chrome-report-pip: oklch(68% 0.14 264);
  --chrome-live-bg:   color-mix(in oklab, ${palette.orange} 20%, transparent);
  --chrome-live-text: oklch(83% 0.10 46);
  --chrome-live-pip:  oklch(77% 0.14 46);
  --chrome-border:    oklch(100% 0 0 / 0.06);
`.trim();

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

    /* BUG-0190/BUG-0198: --clr-* aliases (accent + shadow are theme-independent) */
    --clr-accent:        var(--plan-accent);
    --clr-accent-subtle: color-mix(in oklab, var(--plan-accent) 10%, transparent);
    --shadow-card:       var(--shadow);
    --shadow-card-hover: var(--shadow-lg);
    --surface-alt:       oklch(25% 0.015 220);
    ${chromeTokens}
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

    /* BUG-0190/BUG-0198: --clr-* compatibility aliases for light theme */
    --clr-body-bg:      var(--bg);
    --clr-text-primary: var(--text);
    --clr-text-secondary: var(--text-dim);
    --clr-text-muted:   var(--text-mute);
    --clr-panel-bg:     var(--surface);
    --clr-surface:      var(--surface);
    --clr-surface-raised: var(--surface-2);
    --clr-border:       var(--border);
    --clr-border-mid:   var(--border);
    --clr-header-bg:    var(--surface-2);
    --clr-header-text:  var(--text);
    --clr-row-alt:      color-mix(in oklab, var(--border) 25%, transparent);
    --clr-row-hover:    color-mix(in oklab, var(--plan-accent) 6%, transparent);
    --clr-sidebar-bg:   var(--surface);
    --clr-input-bg:     var(--surface);
    --clr-input-border: var(--border);
    --clr-input-text:   var(--text);
    /* Badge tokens */
    --badge-success-bg:     color-mix(in oklab, var(--ok)   12%, transparent);
    --badge-success-text:   oklch(45% 0.15 150);
    --badge-success-border: color-mix(in oklab, var(--ok)   30%, transparent);
    --badge-warn-bg:        color-mix(in oklab, var(--warn)  12%, transparent);
    --badge-warn-text:      oklch(48% 0.16 78);
    --badge-warn-border:    color-mix(in oklab, var(--warn)  30%, transparent);
    --badge-danger-bg:      color-mix(in oklab, var(--risk)  10%, transparent);
    --badge-danger-text:    oklch(48% 0.20 25);
    --badge-danger-border:  color-mix(in oklab, var(--risk)  25%, transparent);
    --badge-info-bg:        color-mix(in oklab, var(--info)  10%, transparent);
    --badge-info-text:      oklch(45% 0.14 240);
    --badge-info-border:    color-mix(in oklab, var(--info)  25%, transparent);
    --badge-neutral-bg:     var(--surface-2);
    --badge-neutral-text:   var(--text-dim);
    --badge-neutral-border: var(--border);
  }

  [data-theme="dark"] {
    --bg:          ${palette.ink10};
    --bg-sunk:     oklch(4% 0.018 95);
    --surface:     ${palette.ink8};
    --surface-2:   ${palette.ink7};
    --border:      oklch(28% 0.018 95);
    --border-soft: oklch(22% 0.018 95 / 0.5);
    --text:        ${palette.ink1};
    --text-dim:    ${palette.ink4};
    --text-mute:   ${palette.ink5};
    --shadow:      0 1px 0 rgba(0,0,0,.35), 0 6px 20px -8px rgba(0,0,0,.5);
    --shadow-lg:   0 2px 0 rgba(0,0,0,.4), 0 18px 36px -14px rgba(0,0,0,.55);
    --grid-dot:    rgba(200,210,230,0.06);

    /* BUG-0190/BUG-0198: --clr-* compatibility aliases for dark theme */
    --clr-body-bg:      var(--bg);
    --clr-text-primary: var(--text);
    --clr-text-secondary: var(--text-dim);
    --clr-text-muted:   var(--text-mute);
    --clr-panel-bg:     var(--surface);
    --clr-surface:      var(--surface);
    --clr-surface-raised: var(--surface-2);
    --clr-border:       var(--border);
    --clr-border-mid:   var(--border);
    --clr-header-bg:    var(--surface-2);
    --clr-header-text:  var(--text);
    --clr-row-alt:      color-mix(in oklab, var(--border) 30%, transparent);
    --clr-row-hover:    color-mix(in oklab, var(--plan-accent) 8%, transparent);
    --clr-sidebar-bg:   var(--surface);
    --clr-input-bg:     var(--surface-2);
    --clr-input-border: var(--border);
    --clr-input-text:   var(--text);
    /* Badge tokens - dark mode */
    --badge-success-bg:     color-mix(in oklab, var(--ok)   15%, transparent);
    --badge-success-text:   var(--ok);
    --badge-success-border: color-mix(in oklab, var(--ok)   35%, transparent);
    --badge-warn-bg:        color-mix(in oklab, var(--warn)  15%, transparent);
    --badge-warn-text:      var(--warn);
    --badge-warn-border:    color-mix(in oklab, var(--warn)  35%, transparent);
    --badge-danger-bg:      color-mix(in oklab, var(--risk)  15%, transparent);
    --badge-danger-text:    var(--risk);
    --badge-danger-border:  color-mix(in oklab, var(--risk)  30%, transparent);
    --badge-info-bg:        color-mix(in oklab, var(--info)  15%, transparent);
    --badge-info-text:      var(--info);
    --badge-info-border:    color-mix(in oklab, var(--info)  30%, transparent);
    --badge-neutral-bg:     var(--surface-2);
    --badge-neutral-text:   var(--text-dim);
    --badge-neutral-border: var(--border);
  }`.trim();
}

function generateDashboardCssTokens() {
  return `:root {
  --live-accent: ${palette.orange}; --live-accent-soft: oklch(72% 0.12 46 / 0.15);
  --report-accent: ${palette.indigo}; --bg: ${palette.ink1}; --surface: ${palette.ink0};
  --text: ${palette.ink9}; --text-muted: ${palette.ink5}; --border: ${palette.ink3};
  --ok: ${palette.green}; --warn: ${palette.amber}; --risk: ${palette.red}; --info: ${palette.teal};
  ${chromeTokens}
}
[data-theme="dark"] {
  --bg: ${palette.ink10}; --surface: ${palette.ink8}; --text: ${palette.ink1};
  --text-muted: ${palette.ink5}; --border: oklch(28% 0.018 95);
}`.trim();
}

module.exports = {
  BADGE_TONE,
  badge,
  palette,
  chartColors,
  type,
  radius,
  shadow,
  spacing,
  chromeTokens,
  generateCssTokens,
  generateDashboardCssTokens,
};
