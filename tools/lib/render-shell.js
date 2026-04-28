'use strict';

const { esc, jsEsc, usd, normalizeStoryRef } = require('./render-utils');
// SHELL_CHROME_CSS: all CSS needed by renderChrome(). Exported so generate-dashboard.js
// can inject it when using the shared chrome on the agentic dashboard.
const SHELL_CHROME_CSS = `
.pv-chrome{position:sticky;top:0;z-index:60;display:flex;align-items:center;gap:14px;padding:8px 18px;min-height:52px;max-height:52px;border-bottom:1px solid var(--border);background:color-mix(in oklab,var(--bg) 80%,transparent);backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2);}
.pv-chrome-brand{display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-size:17px;letter-spacing:-0.01em;color:var(--text);}
.pv-chrome-dot{width:9px;height:9px;border-radius:2px;background:linear-gradient(135deg,var(--plan-accent),var(--live-accent));flex-shrink:0;}
.pv-chrome-spacer{flex:1;}
.pv-chrome-segs,.pv-theme-segs{display:flex;gap:2px;padding:3px;border:1px solid var(--border);border-radius:8px;background:var(--surface);}
.pv-seg{padding:5px 11px;font-size:12.5px;font-weight:500;border-radius:6px;color:var(--text-dim);cursor:pointer;background:none;border:0;font-family:var(--font-sans);text-decoration:none;display:inline-flex;align-items:center;}
.pv-seg:hover{color:var(--text);background:var(--surface-2);}
.pv-seg-active,.pv-seg[aria-pressed='true']{background:var(--surface-2);color:var(--text);box-shadow:inset 0 0 0 1px var(--border-soft);}
.pv-iconbtn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text-dim);font-size:12px;font-weight:500;cursor:pointer;font-family:var(--font-sans);}
.pv-iconbtn:hover{color:var(--text);background:var(--surface-2);}
.mode-badge{display:inline-flex;align-items:center;gap:8px;padding:5px 10px 5px 8px;border-radius:999px;font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;border:1px solid var(--border);background:var(--surface);color:var(--text);}
.mode-badge .pip{width:6px;height:6px;border-radius:999px;display:inline-block;}
.mode-report .pip{background:var(--plan-accent);box-shadow:0 0 0 3px var(--plan-accent-soft);}
.mode-live .pip{background:var(--live-accent);box-shadow:0 0 0 3px var(--live-accent-soft);animation:pv-pulse 1.6s ease-in-out infinite;}
@keyframes pv-pulse{0%,100%{opacity:1}50%{opacity:0.35}}
`.trim();
// Keep re-exporting CHROME_CSS from render-chrome.js for backward-compat with existing tests.
const { CHROME_CSS } = require('./render-chrome');

// US-0138: Mode badge — REPORT (static pip) or LIVE (pulsing pip).
// Plan-Status always renders REPORT. Agentic renders LIVE in generate-dashboard.js.
function renderModeBadge(mode = 'report') {
  const isLive = mode === 'live';
  const label = isLive ? 'LIVE' : 'REPORT';
  const cls = isLive ? 'mode-live' : 'mode-report';
  return `<span class="mode-badge ${cls}" aria-label="Mode: ${isLive ? 'Live' : 'Report'}" tabindex="0">
    <span class="pip" aria-hidden="true"></span>${label}
  </span>`;
}

// US-0136: Per-tab masthead — editorial header with project identity and inline stats.
// Replaces the stat tiles previously embedded in the topbar.
function renderMasthead(data) {
  const activeStories = data.stories.filter((s) => s.status !== 'Retired');
  const done = activeStories.filter((s) => s.status === 'Done').length;
  const cov = data.coverage;
  const covLabel = cov && cov.available !== false ? `${cov.overall.toFixed(1)}%` : 'N/A';
  const totalAI = (data.costs && data.costs._totals && data.costs._totals.costUsd) || 0;
  const openBugs = (data.bugs || []).filter((b) => !/^(Fixed|Retired|Cancelled|Rejected)/i.test(b.status)).length;
  /* BUG-0195: add projected budget total */
  const totalProjected = activeStories.reduce(
    (sum, st) => sum + ((data.costs && data.costs[st.id] && data.costs[st.id].projectedUsd) || 0),
    0,
  );

  return `
  <div class="pv-masthead">
    <div class="pv-masthead-head">
      <span class="pv-eyebrow">${esc(data.projectName || '')}&thinsp;&middot;&thinsp;${esc(data.release || '')}</span>
      <h1 class="pv-masthead-title">Status <em>report</em></h1>
    </div>
    <div class="pv-masthead-meta">
      <div class="pv-meta-item">
        <span class="pv-meta-lbl">Stories</span>
        <span class="pv-meta-val tnum">${done}/${activeStories.length}</span>
      </div>
      <div class="pv-meta-item">
        <span class="pv-meta-lbl">Coverage</span>
        <span class="pv-meta-val tnum">${covLabel}</span>
      </div>
      <div class="pv-meta-item">
        <span class="pv-meta-lbl">Open bugs</span>
        <span class="pv-meta-val tnum">${openBugs}</span>
      </div>
      <div class="pv-meta-item pv-meta-item--hide-sm">
        <span class="pv-meta-lbl">Est. budget</span>
        <span class="pv-meta-val tnum">${usd(totalProjected)}</span>
      </div>
      <div class="pv-meta-item pv-meta-item--hide-sm">
        <span class="pv-meta-lbl">AI spend</span>
        <span class="pv-meta-val tnum">${usd(totalAI)}</span>
      </div>
    </div>
  </div>`;
}

function renderFilterBar(data) {
  const epicOptions = data.epics
    .map((e) => `<option value="${esc(e.id)}">${esc(e.id)}: ${esc(e.title)}</option>`)
    .join('');
  const sel = 'filter-select';
  return `
  <div class="filter-bar hidden" id="filter-bar">
    <span id="fgrp-story" class="fgrp hidden">
      <select id="f-epic" onchange="applyFilters()" class="${sel}" aria-label="Filter by epic">
        <option value="">All Epics</option>${epicOptions}
      </select>
      <select id="f-status" onchange="applyFilters()" class="${sel}" aria-label="Filter by status">
        <option value="">All Statuses</option>
        <option>In Progress</option><option>Planned</option><option>To Do</option><option>Done</option><option>Blocked</option>
      </select>
      <select id="f-priority" onchange="applyFilters()" class="${sel}" aria-label="Filter by priority">
        <option value="">All Priorities</option>
        <option>P0</option><option>P1</option><option>P2</option>
      </select>
    </span>
    <span id="fgrp-bug" class="fgrp hidden">
      <select id="f-bug-epic" onchange="applyFilters()" class="${sel}" aria-label="Filter bugs by epic">
        <option value="">All Epics</option>${epicOptions}
      </select>
      <select id="f-bug-status" onchange="applyFilters()" class="${sel}" aria-label="Filter bugs by status">
        <option value="">All Statuses</option>
        <option>Open</option><option>In Progress</option><option>Fixed</option>
      </select>
      <select id="f-bug-severity" onchange="applyFilters()" class="${sel}" aria-label="Filter bugs by severity">
        <option value="">All Severities</option>
        <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
      </select>
    </span>
    <input id="f-search" oninput="applyFilters()" type="text" placeholder="Search IDs, titles…"
      class="${sel} filter-search" aria-label="Search" />
    <button onclick="clearFilters()" class="filter-clear">Clear</button>
  </div>`;
}

function svgIcon(path) {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"/></svg>`;
}

function renderSidebar() {
  const items = [
    {
      id: 'status',
      label: 'Status',
      path: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    },
    {
      id: 'hierarchy',
      label: 'Hierarchy',
      path: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
    },
    {
      id: 'kanban',
      label: 'Kanban',
      path: 'M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z',
    },
    {
      id: 'traceability',
      label: 'Traceability',
      path: 'M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25',
    },
    {
      id: 'charts',
      label: 'Charts',
      path: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    },
    {
      id: 'trends',
      label: 'Trends',
      path: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
    },
    {
      id: 'costs',
      label: 'Costs',
      path: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      id: 'bugs',
      label: 'Bugs',
      path: 'M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44a23.916 23.916 0 001.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.778 3.778 0 01.4-2.25m0 0a3.75 3.75 0 016.958.464M12 5.25a3.75 3.75 0 00-6.958.464',
    },
    {
      id: 'lessons',
      label: 'Lessons',
      path: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
    },
    {
      id: 'stakeholder',
      label: 'Stakeholder',
      path: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
    },
  ];
  return `
  <aside id="sidebar">
    <nav id="sidebar-nav" aria-label="Main navigation">
      ${items
        .map(
          (item, i) => `
      <button onclick="showTab('${jsEsc(item.id)}')" id="tab-btn-${esc(item.id)}"
        class="nav-item${i === 0 ? ' nav-active' : ''}"
        ${i === 0 ? 'aria-current="page"' : ''}>
        ${svgIcon(item.path)}
        <span class="nav-label">${item.label}</span>
      </button>`,
        )
        .join('')}
    </nav>
  </aside>`;
}

// US-0136/US-0137: Frosted-glass neutral chrome shared by both dashboards.
// mode='report' → Plan-Status active, REPORT badge, ⌘K search.
// mode='live'   → Pipeline active, LIVE badge, no ⌘K (agentic dashboard).
function renderChrome(data, mode = 'report') {
  const projectName = esc((data && data.projectName) || 'Plan Visualizer');
  const genIso = esc((data && data.generatedAt) || '');
  const isLive = mode === 'live';
  const themeSet = isLive ? 'pvSetTheme' : 'setTheme';
  return `
  <header class="pv-chrome" id="pv-chrome" data-mode="${mode}">
    <div class="pv-chrome-brand">
      <span class="pv-chrome-dot" aria-hidden="true"></span>
      <span class="pv-chrome-name">${projectName}</span>
    </div>
    <div class="pv-chrome-segs" role="tablist" aria-label="Dashboard">
      ${
        isLive
          ? `<a href="plan-status.html" class="pv-seg" aria-pressed="false">Plan-Status</a>
      <button class="pv-seg pv-seg-active" aria-pressed="true">Pipeline</button>`
          : `<button class="pv-seg pv-seg-active" aria-pressed="true">Plan-Status</button>
      <a href="dashboard.html" class="pv-seg" aria-pressed="false">Pipeline</a>`
      }
    </div>
    <div class="pv-chrome-spacer"></div>
    <span id="gen-time" data-iso="${genIso}" style="font-size:11px;color:var(--text-mute);white-space:nowrap"></span>
    ${renderModeBadge(mode)}
    ${!isLive ? `<button class="pv-iconbtn" onclick="openSearch && openSearch()" aria-label="Search (\u2318K)" id="search-btn" style="gap:5px"><span aria-hidden="true" style="font-size:13px">\u2318K</span></button>` : ''}
    <button class="pv-iconbtn" onclick="openAbout && openAbout()" aria-label="About">
      <span aria-hidden="true">\u24d8</span> About
    </button>
    <div class="pv-theme-segs" role="group" aria-label="Theme">
      <button onclick="${themeSet}('light')" id="theme-btn-light" class="pv-seg" aria-pressed="false">\u2600 Light</button>
      <button onclick="${themeSet}('dark')"  id="theme-btn-dark"  class="pv-seg" aria-pressed="false">\u263e Dark</button>
    </div>
  </header>`;
}

function renderCompletionBanner(data) {
  if (!data.completion) return '';
  const { likelyDate, rangeStart, rangeEnd, velocityWeeks } = data.completion;
  return `
  <div id="completion-banner" style="background:var(--bg-sunk,oklch(10% 0.008 95));border-bottom:1px solid var(--border,oklch(28% 0.018 95));padding:6px 24px;display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap">
    <span style="color:var(--text-muted,var(--text-dim))">Estimated completion:</span>
    <span style="color:var(--warn);font-weight:600">${esc(likelyDate)} (likely)</span>
    <span style="color:var(--text-muted,var(--text-dim))">·</span>
    <span style="color:var(--info)">${esc(rangeStart)} – ${esc(rangeEnd)} range</span>
    <span style="color:var(--text-muted,var(--text-dim));font-size:11px;margin-left:auto">based on ${esc(String(velocityWeeks))}-wk velocity</span>
  </div>`;
}

module.exports = {
  renderChrome,
  renderFilterBar,
  renderSidebar,
  renderCompletionBanner,
  renderModeBadge,
  renderMasthead,
  CHROME_CSS,
  SHELL_CHROME_CSS,
};
