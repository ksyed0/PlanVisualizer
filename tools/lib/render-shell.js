'use strict';

const { esc, jsEsc, usd } = require('./render-utils');

function renderTopBar(data) {
  const totalAI = data.costs._totals.costUsd || 0;
  const storyProjected = data.stories.reduce(
    (s, st) => s + (data.costs[st.id] ? data.costs[st.id].projectedUsd || 0 : 0),
    0,
  );
  const bugProjected = Object.entries(data.costs._bugs || {})
    .filter(([k]) => k !== '_totals')
    .reduce((s, [, v]) => s + (v ? v.projectedUsd || 0 : 0), 0);
  const projectedTotal = storyProjected + bugProjected;
  const activeStories = data.stories.filter((s) => s.status !== 'Retired');
  const done = activeStories.filter((s) => s.status === 'Done').length;
  const inProgress = activeStories.filter((s) => s.status === 'In Progress').length;
  const cov = data.coverage;
  const covLabel = cov.available !== false ? `${cov.overall.toFixed(1)}%` : 'N/A';
  const openBugs = (data.bugs || []).filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status));
  const critHighBugs = openBugs.filter((b) => ['Critical', 'High'].includes(b.severity)).length;
  const bugValueCls = openBugs.length === 0 ? '' : critHighBugs > 0 ? ' tile-danger' : ' tile-warn';
  const covValueCls = cov.available !== false && !cov.meetsTarget ? ' tile-danger' : '';
  const genAt = data.generatedAt;

  const budget = data.budget || {};
  const hasBudget = budget.hasBudget;
  const pct = budget.percentUsed;
  let budgetTile = '';
  if (hasBudget && pct !== null) {
    let barColor = '#22c55e';
    let warnIcon = '';
    if (pct >= 90) {
      barColor = '#ef4444';
      warnIcon = '&#9888;';
    } else if (pct >= 75) {
      barColor = '#f97316';
      warnIcon = '&#9888;';
    } else if (pct >= 50) {
      barColor = '#eab308';
    }
    const clampedPct = Math.min(100, pct);
    budgetTile = `
        <div class="topbar-tile" style="min-width:90px">
          <span class="tile-value font-mono">${warnIcon} ${pct}%</span>
          <span class="tile-label">${usd(budget.totalSpent)} / ${usd(budget.totalBudget)}</span>
          <div style="width:100%;height:3px;background:#334155;margin-top:4px;border-radius:2px;overflow:hidden">
            <div style="width:${clampedPct}%;height:100%;background:${barColor};transition:width 0.3s"></div>
          </div>
        </div>`;
  }

  return `
  <header id="topbar-fixed" class="${data.budget && data.budget.crossedThresholds && data.budget.crossedThresholds.length > 0 ? 'has-alert' : ''}">
    <div class="topbar-inner">
      <div class="topbar-project">
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="topbar-title">${esc(data.projectName)}</h1>
          <span class="topbar-btn-group">
            <button onclick="openSearch()" id="search-pill" class="topbar-btn" aria-label="Open search (⌘K)">🔍 <span id="search-pill-shortcut">⌘K</span></button>
            <button onclick="openAbout()" class="topbar-btn">ℹ️ About</button>
            <a href="dashboard.html" class="topbar-btn">&#8592; Agentic Dashboard</a>
            <button onclick="toggleTheme()" id="theme-toggle" class="topbar-btn" aria-label="Toggle dark/light mode">☀️ Light</button>
          </span>
        </div>
        <p class="topbar-tagline">${esc(data.tagline)}&nbsp;·&nbsp;Generated <span id="gen-time" data-iso="${genAt}"></span>${data.branch ? `&nbsp;·&nbsp;from <code class="font-mono" style="font-size:10px" title="Project branch">${esc(data.branch)}</code>&nbsp;<code class="font-mono" style="font-size:10px" title="Project commit">${esc(data.commitSha)}</code>` : `&nbsp;·&nbsp;<code class="font-mono" style="font-size:10px">${esc(data.commitSha)}</code>`}</p>
      </div>
      <div class="topbar-tiles">
        ${budgetTile}
        <div class="topbar-tile">
          <span class="tile-value">&#128203; ${done}/${activeStories.length}</span>
          <span class="tile-label">Stories</span>
        </div>
        <div class="topbar-tile">
          <span class="tile-value">&#9889; ${inProgress}</span>
          <span class="tile-label">In Progress</span>
        </div>
        <div class="topbar-tile">
          <span class="tile-value hero-num hero-num-sm tile-bugs${bugValueCls}">&#128027; ${openBugs.length}</span>
          <span class="tile-label">Bugs Open</span>
        </div>
        <div class="topbar-tile tile-coverage">
          <span class="tile-value hero-num hero-num-sm tile-cov${covValueCls}">${covLabel}</span>
          <span class="tile-label">Coverage</span>
        </div>
        <div class="topbar-tile tile-ai-cost">
          <span class="tile-value hero-num hero-num-sm">${usd(totalAI)}</span>
          <span class="tile-label">AI Cost</span>
        </div>
        <div class="topbar-tile tile-projected">
          <span class="tile-value font-mono">${usd(projectedTotal)}</span>
          <span class="tile-label">Estimated</span>
        </div>
      </div>
    </div>
  </header>`;
}

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
  const openBugs = (data.bugs || []).filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status)).length;

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
  const sel =
    'border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:bg-slate-700 dark:text-slate-100';
  return `
  <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-2 flex flex-wrap gap-2 items-center hidden" id="filter-bar">
    <span id="fgrp-story" class="hidden flex-wrap gap-2 flex">
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
    <span id="fgrp-bug" class="hidden flex-wrap gap-2 flex">
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
      class="${sel} w-full sm:w-48 dark:placeholder-slate-400" aria-label="Search" />
    <button onclick="clearFilters()" class="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline">Clear</button>
  </div>`;
}

function svgIcon(path) {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"/></svg>`;
}

function renderSidebar() {
  const items = [
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

function renderCompletionBanner(data) {
  if (!data.completion) return '';
  const { likelyDate, rangeStart, rangeEnd, velocityWeeks } = data.completion;
  return `
  <div id="completion-banner" style="background:#0f172a;border-bottom:1px solid #1e293b;padding:6px 24px;display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap">
    <span style="color:#94a3b8">Estimated completion:</span>
    <span style="color:#fbbf24;font-weight:600">${esc(likelyDate)} (likely)</span>
    <span style="color:#475569">·</span>
    <span style="color:#c4b5fd">${esc(rangeStart)} – ${esc(rangeEnd)} range</span>
    <span style="color:#475569;font-size:11px;margin-left:auto">based on ${esc(String(velocityWeeks))}-wk velocity</span>
  </div>`;
}

module.exports = {
  renderTopBar,
  renderFilterBar,
  renderSidebar,
  renderCompletionBanner,
  renderModeBadge,
  renderMasthead,
};
