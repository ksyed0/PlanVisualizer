'use strict';

const { generateCssTokens } = require('./theme');
const { esc, sparkline, BADGE_TONE, badge } = require('./render-utils');
const {
  renderChrome,
  renderFilterBar,
  renderSidebar,
  renderCompletionBanner,
  renderMasthead,
} = require('./render-shell');
const {
  renderHierarchyTab,
  renderKanbanTab,
  renderTraceabilityTab,
  renderChartsTab,
  renderTrendsTab,
  renderCostsTab,
  renderBugsTab,
  renderLessonsTab,
  renderRecentActivity,
} = require('./render-tabs');
const { renderScripts, renderPrintCSS } = require('./render-scripts');

function renderHtml(data, options = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(data.projectName)} — Plan Status</title>
  <script>(function(){
  var old=localStorage.getItem('theme');
  if(old&&!localStorage.getItem('pv-theme')){localStorage.setItem('pv-theme',old);localStorage.removeItem('theme');}
  var t=localStorage.getItem('pv-theme');
  var dark=t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.setAttribute('data-theme',dark?'dark':'light');
  if(dark){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}
})()</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={darkMode:'class'}</script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* === Base === */
    body { font-family: var(--font-sans, 'Inter Tight', sans-serif); padding-top: 52px; background-color: var(--clr-body-bg); color: var(--clr-text-primary); }
    body.has-alert { padding-top: 80px; }
    #topbar-fixed.has-alert { top: 28px; }
    #sidebar.has-alert { top: 80px; height: calc(100vh - 80px); }
    code, .font-mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }

    /* === Typography utilities (US-0094) === */
    .font-display { font-family: var(--font-display, 'Inter Tight', sans-serif); font-weight: 400; letter-spacing: -0.005em; }
    .display-title { font-family: var(--font-sans, 'Inter Tight', sans-serif); font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--clr-text-muted); }
    .tabular-nums, .usd, .num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "ss01" 1; }
    /* Apply tabular-nums to currency/number-heavy elements automatically */
    td.num, td.cost, .topbar-tile .tile-value, .hero-num,
    .scroll-table td, .scroll-table th, .font-mono, code,
    .budget-stat, #tab-costs td, #tab-bugs td { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "ss01" 1; }

    /* === Card elevation (US-0095) — shadow-based cards, no hard border === */
    .card-elev { background-color: var(--clr-panel-bg); box-shadow: var(--shadow-card); transition: box-shadow 180ms ease; padding: 1rem; }
    .card-elev:hover { box-shadow: var(--shadow-card-hover); }

    /* === Chrome (sticky, frosted-glass neutral) — US-0136 === */
    /* Old navy gradient topbar replaced with neutral frosted-glass chrome. */
    .pv-chrome {
      position: sticky;
      top: 0;
      z-index: 60;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 18px;
      min-height: 52px;
      max-height: 52px;
      border-bottom: 1px solid var(--border);
      background: color-mix(in oklab, var(--bg) 80%, transparent);
      backdrop-filter: blur(12px) saturate(1.2);
      -webkit-backdrop-filter: blur(12px) saturate(1.2);
    }
    .pv-chrome-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--font-display);
      font-size: 17px;
      letter-spacing: -0.01em;
      color: var(--text);
    }
    .pv-chrome-dot {
      width: 9px;
      height: 9px;
      border-radius: 2px;
      background: linear-gradient(135deg, var(--plan-accent), var(--live-accent));
      flex-shrink: 0;
    }
    .pv-chrome-spacer { flex: 1; }
    .pv-chrome-segs,
    .pv-theme-segs {
      display: flex;
      gap: 2px;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
    }
    .pv-seg {
      padding: 5px 11px;
      font-size: 12.5px;
      font-weight: 500;
      border-radius: 6px;
      color: var(--text-dim);
      cursor: pointer;
      background: none;
      border: 0;
      font-family: var(--font-sans);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .pv-seg:hover {
      color: var(--text);
      background: var(--surface-2);
    }
    .pv-seg-active,
    .pv-seg[aria-pressed='true'] {
      background: var(--surface-2);
      color: var(--text);
      box-shadow: inset 0 0 0 1px var(--border-soft);
    }
    .pv-iconbtn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-dim);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: var(--font-sans);
    }
    .pv-iconbtn:hover {
      color: var(--text);
      background: var(--surface-2);
    }
    /* Legacy topbar classes kept for backward-compat with any external CSS references */
    .topbar-inner { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; }
    .topbar-project { flex: 1; min-width: 0; }
    .topbar-btn { background: rgba(255,255,255,0.18); border: none; color: #ffffff; border-radius: 20px; padding: 5px 14px; font-size: 13px; cursor: pointer; transition: background 0.2s; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
    .topbar-btn:hover { background: rgba(255,255,255,0.30); color: #ffffff; }
    .topbar-btn-group { margin-left: auto; display: inline-flex; gap: 6px; flex-shrink: 0; }
    /* Search pill — hide shortcut hint on mobile */
    @media (max-width: 640px) { #search-pill-shortcut { display: none; } }

    /* === Search modal === */
    .search-section-header { padding:6px 16px 4px; font-size:10px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--clr-text-muted); background:var(--clr-surface-raised); border-bottom:1px solid var(--clr-border); }
    .search-result { display:flex; align-items:center; gap:10px; padding:9px 16px; cursor:pointer; border-bottom:1px solid var(--clr-border); }
    .search-result:last-child { border-bottom:none; }
    .search-result:hover, .search-result.search-cursor { background:rgba(139,92,246,0.08); }
    .search-result-icon { flex-shrink:0; font-size:13px; }
    .search-result-title { flex:1; font-size:13px; color:var(--clr-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .search-result-title strong { color:var(--clr-accent); font-weight:600; }
    .search-result-sub { font-size:11px; color:var(--clr-text-muted); white-space:nowrap; }
    .search-no-results { padding:20px; text-align:center; color:var(--clr-text-muted); font-size:13px; }
    .search-recent-header { display:flex; align-items:center; justify-content:space-between; padding:8px 16px 4px; }
    .search-recent-pills { display:flex; flex-wrap:wrap; gap:6px; padding:4px 16px 12px; }
    .search-recent-pill { background:var(--clr-surface-raised); border:1px solid var(--clr-border); border-radius:12px; padding:3px 10px; font-size:12px; color:var(--clr-text-secondary); cursor:pointer; }
    .search-recent-pill:hover { background:rgba(139,92,246,0.08); }
    @keyframes search-fade { from { outline:2px solid rgba(96,165,250,.7); } to { outline:2px solid rgba(96,165,250,0); } }
    .search-highlight { animation:search-fade 1.5s ease-out forwards; border-radius:4px; }

    /* Glassmorphic stat tiles */
    .topbar-tiles { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .topbar-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 12px; border-radius: 8px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); min-width: 58px; }
    .tile-value { font-size: 15px; font-weight: 700; color: #ffffff; line-height: 1.25; white-space: nowrap; }
    .tile-label { font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.68); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; white-space: nowrap; }
    .tile-danger { color: #fca5a5 !important; }
    .tile-warn { color: #fde68a !important; }

    /* === Hero numbers (US-0099) === */
    /* Default hero-num: large display treatment for prominent KPIs (budget totals, coverage %, bug counts). */
    .hero-num {
      font-family: var(--font-display, 'Inter Tight', sans-serif);
      font-size: clamp(28px, 4vw, 44px);
      font-weight: 500;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum" 1, "ss01" 1;
      line-height: 1;
    }
    /* Compact variant for cramped contexts (e.g. topbar tiles). Scales down so it doesn't overflow. */
    .hero-num.hero-num-sm {
      font-size: clamp(1rem, 2.5vw, 1.6rem);
    }

    /* === Status tab editorial (US-0103) === */
    .chart-supertitle { grid-column: 1 / -1; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--clr-text-muted, rgba(255,255,255,0.4)); padding: 16px 0 6px; border-bottom: 1px solid var(--clr-border); margin-bottom: 4px; }
    .chart-header-rule { border-top: 1px solid var(--clr-border); padding-top: 10px; margin-bottom: 8px; }
    .chart-subtitle { display: block; font-size: 11px; color: var(--clr-text-muted, rgba(255,255,255,0.5)); margin-top: 2px; font-weight: 400; }
    .chart-center-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }

    /* === App shell === */
    #app-shell { display: flex; min-height: calc(100vh - 52px); }

    /* === Sidebar === */
    #sidebar { width: 200px; flex-shrink: 0; position: sticky; top: 52px; height: calc(100vh - 52px); overflow-y: auto; background: var(--clr-sidebar-bg); border-right: 2px solid var(--clr-border); }
    #sidebar-nav { display: flex; flex-direction: column; padding: 8px 0; }
    .nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 16px; text-align: left; font-size: 13px; font-weight: 500; color: var(--clr-text-secondary); border: none; border-left: 3px solid transparent; border-bottom: 1px solid var(--clr-border); background: none; cursor: pointer; transition: color 150ms, background 150ms; }
    .nav-item:last-child { border-bottom: none; }
    .nav-item:hover { color: var(--clr-text-primary); background: rgba(139,92,246,0.08); }
    .nav-item.nav-active { color: var(--clr-accent); background: rgba(139,92,246,0.12); border-left-color: var(--clr-accent); font-weight: 600; }
    /* Active view-toggle button (column / card / compact) — all tabs */
    button.active-view { background: var(--clr-accent) !important; color: #fff !important; border-color: var(--clr-accent) !important; font-weight: 600 !important; }
    .nav-item svg { flex-shrink: 0; }
    .nav-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* === Main content === */
    #main-content { flex: 1; min-width: 0; }
    #filter-sticky { position: sticky; top: 52px; z-index: 20; }

    /* ── Responsive tiers ───────────────────────────── */
    /* Activity panel offset: ≥768px */
    @media (min-width: 768px) { body { padding-right: 280px; } #topbar-fixed { padding-right: 280px; } }

    /* Tablet portrait / unfolded foldable (768–1023px) */
    @media (min-width: 768px) and (max-width: 1023px) {
      #sidebar { width: 160px; }
      .nav-label { font-size: 11px; }
    }

    /* Phone landscape / folded foldable — icon sidebar (480–767px) */
    @media (max-width: 767px) {
      #sidebar { width: 44px; }
      .nav-label { display: none; }
      .nav-item { justify-content: center; padding: 10px 0; gap: 0; }
      .nav-item.nav-active { border-left-color: transparent; border-bottom: 2px solid var(--clr-accent); }
      .tokens-col { display: none !important; }
      #filter-bar { padding: 4px 12px !important; gap: 4px !important; }
      #filter-bar select, #filter-bar input[type="text"] { padding: 2px 4px !important; font-size: 0.7rem !important; }
    }

    /* Activity toggle: clear the topbar */
    #activity-toggle { top: 76px !important; }
    @media (max-height: 500px) and (orientation: landscape) { #activity-toggle { top: 44px !important; } }
    @media (max-width: 479px) { #activity-toggle { top: auto !important; bottom: 16px; } }

    /* Phone portrait (<480px) — topbar in flow, tiles trimmed */
    @media (max-width: 479px) {
      #topbar-fixed { position: relative; height: auto; min-height: 56px; padding: 8px 12px 6px; flex-wrap: wrap; align-items: flex-start; box-shadow: none; border-bottom: 1px solid rgba(0,80,179,0.4); }
      body { padding-top: 0; }
      #app-shell { min-height: 100vh; }
      #sidebar { top: 0; height: 100vh; }
      #filter-sticky { top: 0; }
      .tile-coverage, .tile-ai-cost { display: none !important; }
      .topbar-project { width: 100%; }
      .topbar-tiles { padding-top: 4px; }
    }

    /* Phone landscape — compact topbar (short height) */
    @media (max-height: 500px) and (orientation: landscape) {
      #topbar-fixed { height: 40px; }
      body { padding-top: 40px; }
      #sidebar { top: 40px; height: calc(100vh - 40px); }
      #filter-sticky { top: 40px; }
      .nav-item { padding: 7px 0; }
    }

    /* Foldable unfolded (dual-segment) */
    @media (horizontal-viewport-segments: 2) {
      #app-shell { width: 100vw; }
      #sidebar { width: 200px; }
      .nav-label { display: flex !important; }
    }

    /* US-0138: Mode badge */
    .mode-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 10px 5px 8px;
      border-radius: 999px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
    }
    .mode-badge .pip {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      display: inline-block;
    }
    .mode-report .pip {
      background: var(--plan-accent);
      box-shadow: 0 0 0 3px var(--plan-accent-soft);
    }
    .mode-live .pip {
      background: var(--live-accent);
      box-shadow: 0 0 0 3px var(--live-accent-soft);
      animation: pv-pulse 1.6s ease-in-out infinite;
    }
    @keyframes pv-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    /* US-0135: Status hero */
    .pv-hero { padding: 0; overflow: hidden; }
    .pv-hero-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 16px 10px;
      flex-wrap: wrap;
    }
    .pv-hero-verdict { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .pv-hero-narrative { margin: 0; font-size: 13px; color: var(--text-dim); line-height: 1.4; }
    .pv-hero-stats { display: flex; gap: 24px; flex-shrink: 0; }
    .pv-stat { display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
    .pv-stat-lbl { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-mute); font-family: var(--font-mono); }
    .pv-stat-val { font-family: var(--font-display); font-size: 20px; font-weight: 500; letter-spacing: -0.01em; color: var(--text); }
    .pv-delta { font-size: 11px; font-weight: 500; }
    .pv-delta.up { color: var(--ok); }
    .pv-delta.dn { color: var(--risk); }
    .pv-hero-vizrow { padding: 0 16px 14px; }
    .pv-heat { display: grid; grid-template-columns: repeat(30, 1fr); gap: 2px; }
    .pv-heat-cell { aspect-ratio: 1; border-radius: 2px; background: var(--surface-2); }
    /* chip component */
    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--font-mono); font-size: 10.5px;
      padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border);
      font-weight: 500; letter-spacing: 0.04em;
    }
    .chip .d { width: 5px; height: 5px; border-radius: 999px; background: currentColor; }
    .chip.ok { color: var(--ok); border-color: color-mix(in oklab, var(--ok) 40%, var(--border)); background: color-mix(in oklab, var(--ok) 8%, transparent); }
    .chip.warn { color: var(--warn); border-color: color-mix(in oklab, var(--warn) 40%, var(--border)); background: color-mix(in oklab, var(--warn) 8%, transparent); }
    .chip.risk { color: var(--risk); border-color: color-mix(in oklab, var(--risk) 40%, var(--border)); background: color-mix(in oklab, var(--risk) 10%, transparent); }
    .chip.info { color: var(--info); border-color: color-mix(in oklab, var(--info) 40%, var(--border)); background: color-mix(in oklab, var(--info) 8%, transparent); }
    /* card shared primitive */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); }
    /* US-0139: Decision widgets */
    .card-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border-soft);
    }
    .card-head h3 {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-dim);
    }
    .card-body { padding: 14px; }
    .pv-widgets {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
    @media (max-width: 1100px) {
      .pv-widgets { grid-template-columns: minmax(0, 1fr); }
    }
    .pv-risk-list { display: flex; flex-direction: column; gap: 8px; }
    .pv-risk-item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
    .pv-risk-label { color: var(--text-dim); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pv-widget-empty { margin: 0; font-size: 12.5px; color: var(--text-mute); }
    .pv-kv { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid var(--border-soft); font-size: 12.5px; }
    .pv-kv:last-child { border-bottom: 0; }
    .pv-kv-k { color: var(--text-dim); }
    .pv-kv-v { font-family: var(--font-mono); font-weight: 600; color: var(--text); }
    .pv-wl-row { display: grid; grid-template-columns: 90px 1fr 28px; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 12px; }
    .pv-wl-row:last-child { margin-bottom: 0; }
    .pv-wl-name { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pv-wl-bar-bg { background: var(--surface-2); border-radius: 3px; height: 6px; overflow: hidden; }
    .pv-wl-bar { height: 100%; border-radius: 3px; background: var(--plan-accent); opacity: 0.85; }
    .pv-wl-count { font-family: var(--font-mono); font-size: 11px; color: var(--text-mute); text-align: right; }
    /* US-0136: Masthead */
    .pv-masthead {
      display: grid;
      grid-template-columns: minmax(0, auto) 1fr;
      align-items: center;
      column-gap: 20px;
      padding: 12px 18px;
      margin: 0 0 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .pv-eyebrow {
      font-size: 10.5px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--text-mute);
      font-weight: 600;
      font-family: var(--font-sans);
    }
    .pv-masthead-title {
      margin: 2px 0 0;
      font-family: var(--font-display);
      font-size: 24px;
      line-height: 1.05;
      letter-spacing: -0.02em;
      font-weight: 600;
    }
    .pv-masthead-title em {
      font-style: normal;
      color: var(--plan-accent-ink);
      font-weight: 500;
      font-size: 0.62em;
      vertical-align: middle;
      padding: 2px 7px;
      margin-left: 8px;
      border: 1px solid var(--plan-accent);
      border-radius: 4px;
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .pv-masthead-meta {
      display: flex;
      flex-wrap: nowrap;
      gap: 4px 18px;
      justify-content: flex-end;
      align-items: center;
    }
    .pv-meta-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
      align-items: flex-end;
    }
    .pv-meta-lbl {
      font-size: 9.5px;
      letter-spacing: 0.1em;
      color: var(--text-mute);
      text-transform: uppercase;
      font-family: var(--font-mono);
    }
    .pv-meta-val {
      font-size: 12px;
      color: var(--text);
      font-weight: 600;
      white-space: nowrap;
    }
    .tnum {
      font-variant-numeric: tabular-nums;
      font-feature-settings: 'tnum' 1;
    }
    @media (max-width: 820px) {
      .pv-meta-item--hide-sm { display: none; }
    }
    @media (max-width: 680px) {
      .pv-masthead { grid-template-columns: 1fr; }
      .pv-masthead-meta { justify-content: flex-start; flex-wrap: wrap; }
    }
  </style>
  ${renderPrintCSS()}
</head>
<body class="min-h-screen ${data.budget && data.budget.crossedThresholds && data.budget.crossedThresholds.length > 0 ? 'has-alert' : ''}">
  ${
    data.budget && data.budget.crossedThresholds && data.budget.crossedThresholds.length > 0
      ? `
  <div id="budget-alert" class="fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-between ${data.budget.percentUsed >= 90 ? 'bg-red-600' : data.budget.percentUsed >= 75 ? 'bg-orange-500' : 'bg-amber-500'} text-white">
    <span class="font-medium">
      ${data.budget.percentUsed >= 90 ? '⛔' : '⚠️'} Budget Alert: ${data.budget.percentUsed}% of budget consumed
    </span>
    <button onclick="dismissBudgetAlert()" class="text-white hover:text-gray-200 text-sm font-bold px-2">✕</button>
  </div>
  <script>function dismissBudgetAlert(){document.getElementById('budget-alert').style.display='none';document.body.classList.remove('has-alert');localStorage.setItem('budgetAlertDismissed','${data.generatedAt}');}</script>
  `
      : ''
  }
  ${renderChrome(data)}
  ${renderCompletionBanner(data)}
  <div id="app-shell">
    ${renderSidebar()}
    <main id="main-content" role="main">
      ${renderMasthead(data)}
      <div id="filter-sticky">
        ${renderFilterBar(data)}
      </div>
      <div id="tab-content">
        ${renderHierarchyTab(data)}
        ${renderKanbanTab(data)}
        ${renderTraceabilityTab(data)}
        ${renderChartsTab(data)}
        ${renderTrendsTab(data, options)}
        ${renderCostsTab(data, options)}
        ${renderBugsTab(data)}
        ${renderLessonsTab(data)}
      </div>
    </main>
  </div>
  ${renderRecentActivity(data)}
  <div id="search-backdrop" onclick="closeSearch()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(2px);z-index:200"></div>
  <div id="search-modal" role="dialog" aria-label="Search" aria-modal="true" style="display:none;position:fixed;top:20vh;left:50%;transform:translateX(-50%);width:min(560px,92vw);z-index:201;border-radius:12px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.4);background:var(--clr-panel-bg);border:1px solid var(--clr-border);">
    <div style="position:relative">
      <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);opacity:.45;font-size:16px;pointer-events:none">🔍</span>
      <input id="search-input" type="search" placeholder="Search stories, bugs, lessons…" autocomplete="off" spellcheck="false"
        style="width:100%;padding:13px 16px 13px 42px;border:none;border-bottom:1px solid var(--clr-border);background:transparent;color:var(--clr-text-primary);font-size:15px;font-family:inherit;outline:none;box-sizing:border-box" />
    </div>
    <div id="search-body" style="max-height:360px;overflow-y:auto"></div>
    <div style="padding:7px 16px;font-size:11px;color:var(--clr-text-muted);text-align:center;border-top:1px solid var(--clr-border);background:var(--clr-surface-raised)">↑↓ navigate &nbsp;·&nbsp; ↵ jump &nbsp;·&nbsp; ESC close</div>
  </div>
  <div id="aboutModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div onclick="closeAbout()" class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl w-full max-w-2xl" style="max-height:calc(100vh - 2rem);overflow-y:auto">
      <button onclick="closeAbout()" class="sticky top-3 float-right mr-4 z-10 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xl leading-none" aria-label="Close">&#x2715;</button>
      <div class="p-6 pt-5">
        <div class="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-5 items-start">
          <div class="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700">
            <img src="agents/images/team.png" alt="Agent team" class="w-full object-cover" onerror="this.closest('div').style.display='none'">
          </div>
          <div>
            <h2 class="text-2xl font-bold leading-tight" style="color:var(--clr-accent)">${esc(data.projectName)}</h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm mt-0.5">${esc(data.tagline)}</p>
            ${
              /^https?:\/\//.test(data.githubUrl || '')
                ? `<a href="${esc(data.githubUrl)}" target="_blank" rel="noopener noreferrer"
               class="inline-flex items-center gap-1.5 mt-3 px-4 py-1.5 text-sm font-semibold rounded-lg text-white"
               style="background:var(--clr-accent)">View on GitHub</a>`
                : ''
            }
            ${
              data.agents && Object.keys(data.agents).length > 0
                ? `
            <p class="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mt-4 mb-2">Agent Roster</p>
            <ul class="grid grid-cols-2 gap-x-4 gap-y-2">
              ${Object.entries(data.agents)
                .map(([name, cfg]) => {
                  const avatar = cfg.avatar || name.toLowerCase();
                  const icon = esc(cfg.icon || '🤖');
                  return `<li class="flex items-center gap-2">
                  <img src="agents/images/optimized/${esc(avatar)}-64.png" alt="${esc(name)}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" onerror="this.outerHTML='&lt;span class=&quot;text-lg flex-shrink-0&quot;&gt;${icon}&lt;/span&gt;'">
                  <span>
                    <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-none">${esc(name)}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">${esc(cfg.role || '')}</p>
                  </span>
                </li>`;
                })
                .join('')}
            </ul>`
                : ''
            }
            <p class="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mt-4 mb-1">Links</p>
            <div class="text-sm space-y-0.5 text-slate-500 dark:text-slate-400">
              ${/^https?:\/\//.test(data.githubUrl || '') ? `<div>Repo: <a href="${esc(data.githubUrl)}" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline">${esc(data.githubUrl)}</a></div>` : ''}
              <div>Plan: <a href="plan-status.html" class="text-blue-600 dark:text-blue-400 hover:underline">plan-status.html</a></div>
            </div>
          </div>
        </div>
        <div class="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">This Project</p>
            <div class="space-y-1 text-slate-500 dark:text-slate-400">
              <div>Name: <span class="font-mono text-slate-700 dark:text-slate-200">${esc(data.projectName)}</span></div>
              <div>Version: <span class="font-mono text-slate-700 dark:text-slate-200">v${esc(data.version)}</span></div>
              ${data.branch ? `<div>Branch: <span class="font-mono text-slate-700 dark:text-slate-200">${esc(data.branch)}</span></div>` : ''}
              <div>Build: <span class="font-mono text-slate-700 dark:text-slate-200">#${esc(data.buildNumber)} ${esc(data.commitSha)}</span></div>
            </div>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-2">Dashboard Tool</p>
            <div class="space-y-1 text-slate-500 dark:text-slate-400">
              <div>View: <span class="font-mono text-slate-700 dark:text-slate-200">Plan Status</span></div>
              ${data.appName ? `<div>Generated by: <span class="font-mono text-slate-700 dark:text-slate-200">${esc(data.appName)} v${esc(data.appVersion)}</span></div>` : ''}
              <div>Generated at: <span id="about-gen-time" data-iso="${data.generatedAt}" class="font-mono text-slate-700 dark:text-slate-200"></span></div>
            </div>
          </div>
        </div>
        <p class="mt-4 text-center text-xs text-slate-400">Implemented by Kamal Syed</p>
      </div>
    </div>
  </div>
  ${renderScripts(data, options)}
</body>
</html>`;
}

module.exports = { renderHtml, badge, BADGE_TONE, sparkline };
