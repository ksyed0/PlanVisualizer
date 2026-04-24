'use strict';

const { generateCssTokens } = require('./theme');
const { esc, sparkline, BADGE_TONE, badge } = require('./render-utils');
const {
  renderChrome,
  renderFilterBar,
  renderSidebar,
  renderCompletionBanner,
  renderMasthead,
  SHELL_CHROME_CSS,
} = require('./render-shell');
const {
  renderHierarchyTab,
  renderKanbanTab,
  renderTraceabilityTab,
  renderStatusTab,
  renderChartsTab,
  renderTrendsTab,
  renderCostsTab,
  renderBugsTab,
  renderLessonsTab,
  renderRecentActivity,
  renderStakeholderTab,
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

    /* === Chrome (sticky, frosted-glass neutral) — US-0136/US-0137 === */
    /* Shared between plan-status and agentic dashboards. CSS lives in SHELL_CHROME_CSS. */
    ${SHELL_CHROME_CSS}
    /* Legacy topbar classes kept for backward-compat with any external CSS references */
    .topbar-inner { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; }
    .topbar-project { flex: 1; min-width: 0; }
    .topbar-btn { background: oklch(100% 0 0 / 0.18); border: none; color: oklch(100% 0 0); border-radius: 20px; padding: 5px 14px; font-size: 13px; cursor: pointer; transition: background 0.2s; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
    .topbar-btn:hover { background: oklch(100% 0 0 / 0.30); color: oklch(100% 0 0); }
    .topbar-btn-group { margin-left: auto; display: inline-flex; gap: 6px; flex-shrink: 0; }
    /* Search pill — hide shortcut hint on mobile */
    @media (max-width: 640px) { #search-pill-shortcut { display: none; } }

    /* === Search modal === */
    .search-section-header { padding:6px 16px 4px; font-size:10px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--clr-text-muted); background:var(--clr-surface-raised); border-bottom:1px solid var(--clr-border); }
    .search-result { display:flex; align-items:center; gap:10px; padding:9px 16px; cursor:pointer; border-bottom:1px solid var(--clr-border); }
    .search-result:last-child { border-bottom:none; }
    .search-result:hover, .search-result.search-cursor { background:color-mix(in oklab, var(--clr-accent) 8%, transparent); }
    .search-result-icon { flex-shrink:0; font-size:13px; }
    .search-result-title { flex:1; font-size:13px; color:var(--clr-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .search-result-title strong { color:var(--clr-accent); font-weight:600; }
    .search-result-sub { font-size:11px; color:var(--clr-text-muted); white-space:nowrap; }
    .search-no-results { padding:20px; text-align:center; color:var(--clr-text-muted); font-size:13px; }
    .search-recent-header { display:flex; align-items:center; justify-content:space-between; padding:8px 16px 4px; }
    .search-recent-pills { display:flex; flex-wrap:wrap; gap:6px; padding:4px 16px 12px; }
    .search-recent-pill { background:var(--clr-surface-raised); border:1px solid var(--clr-border); border-radius:12px; padding:3px 10px; font-size:12px; color:var(--clr-text-secondary); cursor:pointer; }
    .search-recent-pill:hover { background:color-mix(in oklab, var(--clr-accent) 8%, transparent); }
    @keyframes search-fade { from { outline:2px solid color-mix(in oklab, var(--info) 70%, transparent); } to { outline:2px solid transparent; } }
    .search-highlight { animation:search-fade 1.5s ease-out forwards; border-radius:4px; }

    /* Glassmorphic stat tiles */
    .topbar-tiles { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .topbar-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 12px; border-radius: 8px; background: oklch(100% 0 0 / 0.12); border: 1px solid oklch(100% 0 0 / 0.20); min-width: 58px; }
    .tile-value { font-size: 15px; font-weight: 700; color: oklch(100% 0 0); line-height: 1.25; white-space: nowrap; }
    .tile-label { font-size: 10px; font-weight: 500; color: oklch(100% 0 0 / 0.68); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; white-space: nowrap; }
    .tile-danger { color: var(--risk) !important; }
    .tile-warn { color: var(--warn) !important; }

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
    .chart-supertitle { grid-column: 1 / -1; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--clr-text-muted); padding: 16px 0 6px; border-bottom: 1px solid var(--clr-border); margin-bottom: 4px; }
    .chart-header-rule { border-top: 1px solid var(--clr-border); padding-top: 10px; margin-bottom: 8px; }
    .chart-subtitle { display: block; font-size: 11px; color: var(--clr-text-muted); margin-top: 2px; font-weight: 400; }
    .chart-center-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }

    /* === App shell === */
    #app-shell { display: flex; min-height: calc(100vh - 52px); }

    /* === Sidebar === */
    #sidebar { width: 200px; flex-shrink: 0; position: sticky; top: 52px; height: calc(100vh - 52px); overflow-y: auto; background: var(--clr-sidebar-bg); border-right: 2px solid var(--clr-border); }
    #sidebar-nav { display: flex; flex-direction: column; padding: 8px 0; }
    .nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 16px; text-align: left; font-size: 13px; font-weight: 500; color: var(--clr-text-secondary); border: none; border-left: 3px solid transparent; border-bottom: 1px solid var(--clr-border); background: none; cursor: pointer; transition: color 150ms, background 150ms; }
    .nav-item:last-child { border-bottom: none; }
    .nav-item:hover { color: var(--clr-text-primary); background: color-mix(in oklab, var(--clr-accent) 8%, transparent); }
    .nav-item.nav-active { color: var(--clr-accent); background: color-mix(in oklab, var(--clr-accent) 12%, transparent); border-left-color: var(--clr-accent); font-weight: 600; }
    /* Active view-toggle button (column / card / compact) — all tabs */
    button.active-view { background: var(--clr-accent) !important; color: oklch(100% 0 0) !important; border-color: var(--clr-accent) !important; font-weight: 600 !important; }
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
      #topbar-fixed { position: relative; height: auto; min-height: 56px; padding: 8px 12px 6px; flex-wrap: wrap; align-items: flex-start; box-shadow: none; border-bottom: 1px solid var(--chrome-border, oklch(56% 0.22 264 / 0.4)); }
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

    /* US-0138: Mode badge — CSS now lives in SHELL_CHROME_CSS (render-shell.js) */
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
    /* US-0135: Density toggle */
    .pv-hero-toggle { position: absolute; top: 8px; right: 10px; display: flex; gap: 2px; }
    .pv-hero-density-btn { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;
      border: 1px solid var(--border); background: none; color: inherit; cursor: pointer; opacity: .6; }
    .pv-hero-density-btn.pv-hero-active { opacity: 1; background: var(--surface-2); }
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
    .chip.mute { color: var(--text-mute); border-color: var(--border); background: color-mix(in oklab, var(--text-mute) 8%, transparent); }
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
      background: linear-gradient(135deg, color-mix(in oklab, var(--plan-accent) 10%, var(--surface)) 0%, var(--surface) 60%);
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
        ${renderStatusTab(data)}
        ${renderHierarchyTab(data)}
        ${renderKanbanTab(data)}
        ${renderTraceabilityTab(data)}
        ${renderChartsTab(data)}
        ${renderTrendsTab(data, options)}
        ${renderCostsTab(data, options)}
        ${renderBugsTab(data)}
        ${renderLessonsTab(data)}
        ${renderStakeholderTab(data)}
      </div>
    </main>
  </div>
  ${renderRecentActivity(data)}
  <div id="search-backdrop" onclick="closeSearch()" style="display:none;position:fixed;inset:0;background:oklch(0% 0 0 / 0.6);backdrop-filter:blur(2px);z-index:200"></div>
  <div id="search-modal" role="dialog" aria-label="Search" aria-modal="true" style="display:none;position:fixed;top:20vh;left:50%;transform:translateX(-50%);width:min(560px,92vw);z-index:201;border-radius:12px;overflow:hidden;box-shadow:var(--shadow-modal,0 16px 48px oklch(0% 0 0 / 0.4));background:var(--clr-panel-bg);border:1px solid var(--clr-border);">
    <div style="position:relative">
      <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);opacity:.45;font-size:16px;pointer-events:none">🔍</span>
      <input id="search-input" type="search" placeholder="Search stories, bugs, lessons…" autocomplete="off" spellcheck="false"
        style="width:100%;padding:13px 16px 13px 42px;border:none;border-bottom:1px solid var(--clr-border);background:transparent;color:var(--clr-text-primary);font-size:15px;font-family:inherit;outline:none;box-sizing:border-box" />
    </div>
    <div id="search-body" style="max-height:360px;overflow-y:auto"></div>
    <div style="padding:7px 16px;font-size:11px;color:var(--clr-text-muted);text-align:center;border-top:1px solid var(--clr-border);background:var(--clr-surface-raised)">↑↓ navigate &nbsp;·&nbsp; ↵ jump &nbsp;·&nbsp; ESC close</div>
  </div>
  ${renderAboutModal({
    title: data.projectName,
    tagline: data.tagline,
    githubUrl: data.githubUrl || '',
    agents: data.agents || {},
    projectName: data.projectName,
    version: data.version,
    branch: data.branch,
    buildNumber: data.buildNumber,
    commitSha: data.commitSha,
    appName: data.appName,
    appVersion: data.appVersion,
    generatedAt: data.generatedAt,
    viewLabel: 'Plan Status',
    dashboardLink: 'plan-status.html',
    rosterCols: 2,
    author: 'Kamal Syed',
  })}
  ${renderScripts(data, options)}
</body>
</html>`;
}

/**
 * Renders the shared About modal used by both plan-status and agentic dashboards.
 * Returns a self-contained string: a <style> block + the modal HTML.
 * CSS uses pv-about-* class names; custom properties fall back across both
 * dashboard variable namespaces (--clr-* plan-status, --brand-* agentic).
 *
 * @param {object} aboutData
 * @param {string} aboutData.title          - Modal heading (h2)
 * @param {string} [aboutData.tagline]      - Subtitle line
 * @param {string} [aboutData.githubUrl]    - GitHub URL for button/link
 * @param {object} [aboutData.agents]       - Agent map: name → {avatar, icon, role}
 * @param {string} [aboutData.missionText]  - Optional mission paragraph
 * @param {string} [aboutData.projectName]  - Meta: project name
 * @param {string} [aboutData.version]      - Meta: version string
 * @param {string} [aboutData.branch]       - Meta: branch name
 * @param {string} [aboutData.buildNumber]  - Meta: build number
 * @param {string} [aboutData.commitSha]    - Meta: commit SHA
 * @param {string} [aboutData.appName]      - Meta: generator app name
 * @param {string} [aboutData.appVersion]   - Meta: generator app version
 * @param {string} [aboutData.generatedAt]  - Meta: ISO timestamp (formatted by JS in browser)
 * @param {string} [aboutData.viewLabel]    - Meta: "Plan Status" or "Agentic SDLC Dashboard"
 * @param {string} [aboutData.dashboardLink]- Meta: link href for this dashboard
 * @param {number} [aboutData.rosterCols]   - Columns in agent roster grid (default 3)
 * @param {string} [aboutData.author]       - Attribution line
 */
function renderAboutModal(aboutData) {
  const {
    title = '',
    tagline = '',
    githubUrl = '',
    agents = {},
    missionText = '',
    projectName = '',
    version = '',
    branch = '',
    buildNumber = '',
    commitSha = '',
    appName = '',
    appVersion = '',
    generatedAt = '',
    viewLabel = 'Plan Status',
    dashboardLink = 'plan-status.html',
    rosterCols = 3,
    author = '',
  } = aboutData;

  const rosterHtml = Object.entries(agents)
    .map(([name, cfg]) => {
      const avatar = cfg.avatar || name.toLowerCase();
      const icon = esc(cfg.icon || '🤖');
      return `<li style="display:flex;align-items:center;gap:8px;min-width:0">
        <img src="agents/images/optimized/${esc(avatar)}-64.png" alt="${esc(name)}"
          style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid var(--clr-border,var(--bg-card-border));background:var(--clr-surface-raised,var(--bg-card-inner))"
          onerror="this.outerHTML='&lt;span style=&quot;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;border:1px solid var(--clr-border)&quot;&gt;${icon}&lt;/span&gt;'">
        <span style="min-width:0;display:flex;flex-direction:column">
          <span style="font-weight:600;font-size:12px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--clr-text-primary,var(--text-primary))">${esc(name)}</span>
          <span style="font-size:10px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--clr-text-muted,var(--text-muted))">${esc(cfg.role || '')}</span>
        </span>
      </li>`;
    })
    .join('');

  const css = `<style id="pv-about-css">
.pv-about-overlay{display:none;position:fixed;inset:0;background:oklch(0% 0 0 / 60%);z-index:1000;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.pv-about-overlay.open{display:flex}
.pv-about-modal{background:var(--clr-panel-bg,var(--bg-card));border:1px solid var(--clr-border,var(--bg-card-border));border-radius:16px;padding:28px;max-width:720px;width:92%;max-height:88vh;overflow-y:auto;text-align:left;position:relative;box-shadow:0 20px 60px oklch(0% 0 0 / 30%)}
.pv-about-close{position:absolute;top:12px;right:16px;background:none;border:none;color:var(--clr-text-muted,var(--text-muted));font-size:22px;cursor:pointer;line-height:1;padding:4px 8px;border-radius:6px;transition:background .2s}
.pv-about-close:hover{background:var(--clr-surface-raised,var(--bg-card-inner));color:var(--clr-text-primary,var(--text-primary))}
.pv-about-layout{display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:start}
.pv-about-playbill{border:2px solid var(--clr-border,var(--bg-card-border));border-radius:8px;overflow:hidden;background:var(--clr-surface-raised,var(--bg-card-inner))}
.pv-about-playbill img{width:100%;display:block}
.pv-about-right{min-width:0}
.pv-about-h2{font-size:20px;font-weight:700;margin:0 0 4px;color:var(--clr-accent,var(--brand-primary))}
.pv-about-tagline{font-size:14px;color:var(--clr-text-muted,var(--text-muted));margin:0 0 6px}
.pv-about-mission{font-size:13px;color:var(--clr-text-muted,var(--text-muted));margin-bottom:14px;line-height:1.45}
.pv-about-repo-link{display:inline-block;margin:10px 0 14px;background:var(--clr-accent,var(--brand-primary));color:oklch(100% 0 0);padding:7px 16px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;transition:background .2s}
.pv-about-repo-link:hover{filter:brightness(.85)}
.pv-about-supertitle{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.12em;color:var(--clr-text-muted,var(--text-muted));margin:0 0 6px}
.pv-about-roster{display:grid;grid-template-columns:repeat(${rosterCols},1fr);gap:6px 10px;margin-bottom:14px;list-style:none;padding:0;font-size:12px}
.pv-about-links{font-size:12px;color:var(--clr-text-muted,var(--text-muted));margin-bottom:14px}
.pv-about-links a{color:var(--clr-accent,var(--brand-primary));text-decoration:none;word-break:break-all}
.pv-about-links a:hover{text-decoration:underline}
.pv-about-links-row{margin-bottom:2px}
.pv-about-divider{border-top:1px solid var(--clr-border,var(--bg-card-border));padding-top:14px;margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:12px}
.pv-about-meta-row{padding-left:8px;margin-bottom:3px;color:var(--clr-text-muted,var(--text-muted))}
.pv-about-meta-label{color:var(--clr-text-muted,var(--text-muted))}
.pv-about-meta-value{color:var(--clr-text-primary,var(--text-primary));font-family:monospace;font-size:11px}
.pv-about-attribution{margin-top:14px;font-size:11px;color:var(--clr-text-muted,var(--text-muted));text-align:center}
@media(max-width:640px){.pv-about-layout{grid-template-columns:1fr;gap:14px}.pv-about-playbill{max-width:240px;margin:0 auto}.pv-about-roster{grid-template-columns:1fr}}
</style>`;

  const html = `<div id="about-modal" class="pv-about-overlay" onclick="if(event.target===this)closeAbout()">
  <div class="pv-about-modal">
    <button class="pv-about-close" onclick="closeAbout()" aria-label="Close">&#xD7;</button>
    <div class="pv-about-layout">
      <div class="pv-about-playbill">
        <img src="agents/images/team.png" alt="Agent team" onerror="this.closest('.pv-about-playbill').style.display='none'">
      </div>
      <div class="pv-about-right">
        <h2 class="pv-about-h2">${esc(title)}</h2>
        ${tagline ? `<p class="pv-about-tagline">${esc(tagline)}</p>` : ''}
        ${missionText ? `<p class="pv-about-mission">${esc(missionText)}</p>` : ''}
        ${/^https?:\/\//.test(githubUrl) ? `<a class="pv-about-repo-link" href="${esc(githubUrl)}" target="_blank" rel="noopener noreferrer">View on GitHub</a>` : ''}
        ${
          Object.keys(agents).length > 0
            ? `<p class="pv-about-supertitle" style="margin-top:16px">Agent Roster</p>
        <ul class="pv-about-roster">${rosterHtml}</ul>`
            : ''
        }
        <p class="pv-about-supertitle">Links</p>
        <div class="pv-about-links">
          ${/^https?:\/\//.test(githubUrl) ? `<div class="pv-about-links-row"><span class="pv-about-meta-label">Repo: </span><a href="${esc(githubUrl)}" target="_blank" rel="noopener">${esc(githubUrl)}</a></div>` : ''}
          <div class="pv-about-links-row"><span class="pv-about-meta-label">Dashboard: </span><a href="${esc(dashboardLink)}">${esc(dashboardLink)}</a></div>
        </div>
        <div class="pv-about-divider">
          <div>
            <p class="pv-about-supertitle">This Project</p>
            <div class="pv-about-meta-row"><span class="pv-about-meta-label">Name: </span><span class="pv-about-meta-value">${esc(projectName)}</span></div>
            <div class="pv-about-meta-row"><span class="pv-about-meta-label">Version: </span><span class="pv-about-meta-value">v${esc(version)}</span></div>
            ${branch ? `<div class="pv-about-meta-row"><span class="pv-about-meta-label">Branch: </span><span class="pv-about-meta-value">${esc(branch)}</span></div>` : ''}
            <div class="pv-about-meta-row"><span class="pv-about-meta-label">Build: </span><span class="pv-about-meta-value">r${esc(buildNumber)} ${esc(commitSha)}</span></div>
          </div>
          <div>
            <p class="pv-about-supertitle">Dashboard Tool</p>
            <div class="pv-about-meta-row"><span class="pv-about-meta-label">View: </span><span class="pv-about-meta-value">${esc(viewLabel)}</span></div>
            ${appName ? `<div class="pv-about-meta-row"><span class="pv-about-meta-label">Generated by: </span><span class="pv-about-meta-value">${esc(appName)} v${esc(appVersion)}</span></div>` : ''}
            <div class="pv-about-meta-row"><span class="pv-about-meta-label">Generated at: </span><span id="about-gen-time" data-iso="${esc(generatedAt)}" class="pv-about-meta-value"></span></div>
          </div>
        </div>
        ${author ? `<p class="pv-about-attribution">Implemented by ${esc(author)}</p>` : ''}
      </div>
    </div>
  </div>
</div>`;

  return `${css}\n${html}`;
}

module.exports = { renderHtml, renderAboutModal, badge, BADGE_TONE, sparkline };
