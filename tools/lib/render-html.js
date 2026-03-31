'use strict';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const jsEsc = s => String(s ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');

function badge(text) {
  const colors = {
    'In Progress': 'border border-[#1d4ed8] bg-[#0a1628] text-[#93c5fd]',
    'Planned':     'border border-[#475569] bg-[#0f1520] text-[#94a3b8]',
    'Done':        'border border-[#166534] bg-[#031a0e] text-[#4ade80]',
    'Blocked':     'border border-[#991b1b] bg-[#1a0505] text-[#fca5a5]',
    'To Do':       'border border-[#92400e] bg-[#150b03] text-[#fcd34d]',
    'P0':          'border border-[#991b1b] bg-[#1a0505] text-[#fca5a5]',
    'P1':          'border border-[#9a3412] bg-[#180803] text-[#fdba74]',
    'P2':          'border border-[#475569] bg-[#0f1520] text-[#94a3b8]',
    'Pass':        'border border-[#166534] bg-[#031a0e] text-[#4ade80]',
    'Fail':        'border border-[#991b1b] bg-[#1a0505] text-[#fca5a5]',
    'Not Run':     'border border-[#92400e] bg-[#150b03] text-[#fcd34d]',
    'Open':        'border border-[#991b1b] bg-[#1a0505] text-[#fca5a5]',
    'Fixed':       'border border-[#166534] bg-[#031a0e] text-[#4ade80]',
    'Critical':    'border border-[#7f1d1d] bg-[#2a0606] text-[#f87171]',
    'High':        'border border-[#991b1b] bg-[#1a0505] text-[#fca5a5]',
    'Medium':      'border border-[#92400e] bg-[#150b03] text-[#fcd34d]',
    'Low':         'border border-[#475569] bg-[#0f1520] text-[#94a3b8]',
  };
  const cls = colors[text] || 'border border-[#475569] bg-[#0f1520] text-[#94a3b8]';
  return `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}">${esc(text)}</span>`;
}

function usd(n) {
  const num = Number(n);
  if (num >= 1000) return '$' + Math.round(num).toLocaleString('en-US');
  if (num > 0) return '$' + num.toFixed(2);
  return '$0.00';
}
function fmtNum(n) { return Number(n).toLocaleString(); }

function renderTopBar(data) {
  const totalAI = data.costs._totals.costUsd || 0;
  const storyProjected = data.stories.reduce((s, st) => s + (data.costs[st.id] ? data.costs[st.id].projectedUsd || 0 : 0), 0);
  const bugProjected = Object.entries(data.costs._bugs || {}).filter(([k]) => k !== '_totals').reduce((s, [, v]) => s + (v ? v.projectedUsd || 0 : 0), 0);
  const projectedTotal = storyProjected + bugProjected;
  const activeStories = data.stories.filter(s => s.status !== 'Retired');
  const done = activeStories.filter(s => s.status === 'Done').length;
  const inProgress = activeStories.filter(s => s.status === 'In Progress').length;
  const cov = data.coverage;
  const covLabel = (cov.available !== false) ? `${cov.overall.toFixed(1)}%` : 'N/A';
  const openBugs = (data.bugs || []).filter(b => !/^(Fixed|Retired|Cancelled)/i.test(b.status));
  const critHighBugs = openBugs.filter(b => ['Critical', 'High'].includes(b.severity)).length;
  const bugValueCls = openBugs.length === 0 ? '' : critHighBugs > 0 ? ' tile-danger' : ' tile-warn';
  const covValueCls = (cov.available !== false && !cov.meetsTarget) ? ' tile-danger' : '';
  const genAt = data.generatedAt;

  const budget = data.budget || {};
  const hasBudget = budget.hasBudget;
  const pct = budget.percentUsed;
  let budgetTile = '';
  if (hasBudget && pct !== null) {
    let barColor = '#22c55e';
    let warnIcon = '';
    if (pct >= 90) { barColor = '#ef4444'; warnIcon = '&#9888;'; }
    else if (pct >= 75) { barColor = '#f97316'; warnIcon = '&#9888;'; }
    else if (pct >= 50) { barColor = '#eab308'; }
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
  <header id="topbar-fixed" class="${(data.budget && data.budget.crossedThresholds && data.budget.crossedThresholds.length > 0) ? 'has-alert' : ''}">
    <div class="topbar-inner">
      <div class="topbar-project">
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="topbar-title">${esc(data.projectName)}</h1>
          <button onclick="openAbout()" class="topbar-btn">About</button>
          <button onclick="toggleTheme()" id="theme-toggle" class="topbar-btn" aria-label="Toggle dark/light mode"><span id="theme-icon">&#9788;</span></button>
        </div>
        <p class="topbar-tagline">${esc(data.tagline)}&nbsp;·&nbsp;Updated <span id="gen-time" data-iso="${genAt}"></span>&nbsp;·&nbsp;<code class="font-mono" style="font-size:10px">${esc(data.commitSha)}</code></p>
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
          <span class="tile-value tile-bugs${bugValueCls}">&#128027; ${openBugs.length}</span>
          <span class="tile-label">Bugs Open</span>
        </div>
        <div class="topbar-tile tile-coverage">
          <span class="tile-value tile-cov${covValueCls}">${covLabel}</span>
          <span class="tile-label">Coverage</span>
        </div>
        <div class="topbar-tile tile-ai-cost">
          <span class="tile-value font-mono">${usd(totalAI)}</span>
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

function renderFilterBar(data) {
  const epicOptions = data.epics.map(e =>
    `<option value="${esc(e.id)}">${esc(e.id)}: ${esc(e.title)}</option>`).join('');
  const sel = 'border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:bg-slate-700 dark:text-slate-100';
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
      <select id="f-bug-status" onchange="applyFilters()" class="${sel}" aria-label="Filter bugs by status">
        <option value="">All Statuses</option>
        <option>Open</option><option>In Progress</option><option>Fixed</option>
      </select>
    </span>
    <input id="f-search" oninput="applyFilters()" type="text" placeholder="Search IDs, titles…"
      class="${sel} w-full sm:w-48 dark:placeholder-slate-400" aria-label="Search stories and bugs" />
    <button onclick="clearFilters()" class="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline">Clear</button>
  </div>`;
}

function svgIcon(path) {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${path}"/></svg>`;
}

function renderSidebar() {
  const items = [
    { id: 'hierarchy',    label: 'Hierarchy',
      path: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' },
    { id: 'kanban',       label: 'Kanban',
      path: 'M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z' },
    { id: 'traceability', label: 'Traceability',
      path: 'M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25' },
    { id: 'charts',       label: 'Charts',
      path: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
    { id: 'trends',       label: 'Trends',
      path: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941' },
    { id: 'costs',        label: 'Costs',
      path: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'bugs',         label: 'Bugs',
      path: 'M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44a23.916 23.916 0 001.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.778 3.778 0 01.4-2.25m0 0a3.75 3.75 0 016.958.464M12 5.25a3.75 3.75 0 00-6.958.464' },
    { id: 'lessons',      label: 'Lessons',
      path: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18' },
  ];
  return `
  <aside id="sidebar">
    <nav id="sidebar-nav" aria-label="Main navigation">
      ${items.map((item, i) => `
      <button onclick="showTab('${item.id}')" id="tab-btn-${item.id}"
        class="nav-item${i === 0 ? ' nav-active' : ''}"
        ${i === 0 ? 'aria-current="page"' : ''}>
        ${svgIcon(item.path)}
        <span class="nav-label">${item.label}</span>
      </button>`).join('')}
    </nav>
  </aside>`;
}

const EPIC_ACCENT_COLORS = [
  { border: '#8b5cf6', bg: 'rgba(139,92,246,0.07)' },  // violet
  { border: '#06b6d4', bg: 'rgba(6,182,212,0.07)'   },  // cyan
  { border: '#f59e0b', bg: 'rgba(245,158,11,0.07)'  },  // amber
  { border: '#10b981', bg: 'rgba(16,185,129,0.07)'  },  // emerald
  { border: '#f43f5e', bg: 'rgba(244,63,94,0.07)'   },  // rose
  { border: '#3b82f6', bg: 'rgba(59,130,246,0.07)'  },  // blue
  { border: '#a855f7', bg: 'rgba(168,85,247,0.07)'  },  // purple
  { border: '#14b8a6', bg: 'rgba(20,184,166,0.07)'  },  // teal
];

function renderHierarchyTab(data) {
  const epicBlocks = data.epics.map((epic, epicIdx) => {
    const accent = EPIC_ACCENT_COLORS[epicIdx % EPIC_ACCENT_COLORS.length];
    const stories = data.stories.filter(s => s.epicId === epic.id);
    const epicProjected = stories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);

    // ── column view: expandable story rows ──────────────────────────────────
    const storyRows = stories.map(story => {
      const risk = data.atRisk[story.id] || {};
      const riskBadge = risk.isAtRisk ? `<span class="at-risk text-orange-500 text-xs ml-1" title="${[
        risk.missingTCs && 'Missing TCs',
        risk.noBranch && 'No branch',
        risk.failedTCNoBug && 'Failed TC without bug'
      ].filter(Boolean).join('; ')}">⚠ At Risk</span>` : '';
      const tcs = data.testCases.filter(tc => tc.relatedStory === story.id);
      const acItems = story.acs.map(ac => {
        const linkedTC = tcs.find(tc => tc.relatedAC === ac.id);
        return `<li class="flex items-start gap-2 py-0.5">
          <span class="${ac.done ? 'text-green-500' : 'text-slate-500'}">${ac.done ? '✓' : '○'}</span>
          <span class="text-xs text-slate-500">${esc(ac.id)}</span>
          <span class="text-xs">${esc(ac.text)}</span>
          ${linkedTC ? `<span class="ml-2 text-xs text-slate-500">→ ${linkedTC.id} ${badge(linkedTC.status)}</span>` : ''}
        </li>`;
      }).join('');
      return `
      <div class="story-row ml-6 border-l-2 border-slate-200 dark:border-slate-600 pl-4 py-2"
           data-epic="${story.epicId}" data-status="${story.status}" data-priority="${story.priority}">
        <div class="flex flex-wrap items-center gap-2 cursor-pointer" onclick="toggleACs('${jsEsc(story.id)}')">
          <span class="font-mono text-xs text-slate-500 whitespace-nowrap">${story.id}</span>
          ${badge(story.status)} ${badge(story.priority)}
          <span class="text-sm font-medium">${esc(story.title)}</span>
          ${riskBadge}
          <span class="ml-auto text-xs text-slate-500">${esc(story.estimate || '?')} · ${usd(data.costs[story.id] && data.costs[story.id].projectedUsd || 0)}</span>
        </div>
        <ul id="acs-${story.id}" class="mt-2 hidden">${acItems || '<li class="text-xs text-slate-500 pl-4">No ACs yet</li>'}</ul>
      </div>`;
    }).join('');

    // ── card view: story cards in a grid ────────────────────────────────────
    const storyCards = stories.map(story => {
      const risk = data.atRisk[story.id] || {};
      const riskBadge = risk.isAtRisk ? `<span class="text-orange-500 text-xs">⚠ At Risk</span>` : '';
      const tcs = data.testCases.filter(tc => tc.relatedStory === story.id);
      const acDone = story.acs.filter(a => a.done).length;
      const acTotal = story.acs.length;
      const cost = usd(data.costs[story.id] && data.costs[story.id].projectedUsd || 0);
      const acItems = story.acs.map(ac => {
        const linkedTC = tcs.find(tc => tc.relatedAC === ac.id);
        return `<li class="flex items-start gap-2 py-0.5">
          <span class="${ac.done ? 'text-green-500' : 'text-slate-400'}">${ac.done ? '✓' : '○'}</span>
          <span class="text-xs text-slate-400">${esc(ac.id)}</span>
          <span class="text-xs dark:text-slate-300">${esc(ac.text)}</span>
          ${linkedTC ? `<span class="ml-auto shrink-0 text-xs text-slate-400">→ ${linkedTC.id} ${badge(linkedTC.status)}</span>` : ''}
        </li>`;
      }).join('');
      return `
      <div class="story-row story-card-hover bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-3 flex flex-col gap-1"
           data-epic="${story.epicId}" data-status="${story.status}" data-priority="${story.priority}">
        <div class="flex flex-wrap items-center gap-1 cursor-pointer" onclick="toggleCardACs('${jsEsc(story.id)}')">
          ${badge(story.status)} ${badge(story.priority)}
          <span class="font-mono text-xs text-slate-500 ml-1">${story.id}</span>
        </div>
        <p class="text-sm font-medium dark:text-slate-100 leading-snug cursor-pointer" onclick="toggleCardACs('${jsEsc(story.id)}')">${esc(story.title)}</p>
        <div class="flex items-center gap-2 mt-auto pt-1 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-600">
          <span>${esc(story.estimate || '?')}</span>
          <span>${cost}</span>
          ${acTotal ? `<span class="cursor-pointer" onclick="toggleCardACs('${jsEsc(story.id)}')">${acDone}/${acTotal} ACs ▾</span>` : ''}
          <span class="ml-auto">${riskBadge}</span>
        </div>
        ${acTotal ? `<ul id="card-acs-${story.id}" class="hidden mt-1 pt-1 border-t border-slate-100 dark:border-slate-600 space-y-0.5">${acItems || '<li class="text-xs text-slate-500 pl-4">No ACs yet</li>'}</ul>` : ''}
      </div>`;
    }).join('');

    const epicHeader = `
      <div class="flex flex-wrap items-center gap-3 mb-3">
        <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epic.id}</span>
        ${badge(epic.status)}
        <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
        <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
        <span class="ml-auto text-sm text-slate-500">${usd(epicProjected)} projected</span>
      </div>`;

    return { epic, accent, epicProjected, storyRows, storyCards, epicHeader };
  });

  const columnView = epicBlocks.map(({ epic, accent, epicProjected, storyRows }) => `
    <div class="epic-block mb-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" style="border-left:4px solid ${accent.border}">
      <div class="px-4 py-3 flex flex-wrap items-center gap-3 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('epic-stories-${jsEsc(epic.id)}','epic-arrow-${jsEsc(epic.id)}')">
        <span id="epic-arrow-${esc(epic.id)}" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
        <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epic.id}</span>
        ${badge(epic.status)}
        <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
        <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
        <span class="ml-auto text-sm text-slate-500">${usd(epicProjected)} projected</span>
      </div>
      <div id="epic-stories-${epic.id}" class="hidden">${storyRows || '<p class="text-slate-500 dark:text-slate-400 text-sm px-4 py-2">No stories yet.</p>'}</div>
    </div>`).join('');

  const cardView = epicBlocks.map(({ epic, accent, epicProjected, storyCards }) => `
    <div class="mb-8">
      <div class="epic-block border border-slate-200 dark:border-slate-700 rounded-t-lg px-4 py-3 mb-0 cursor-pointer select-none" style="border-left:4px solid ${accent.border};background:${accent.bg}" onclick="toggleSection('epic-cards-${jsEsc(epic.id)}','epic-card-arrow-${jsEsc(epic.id)}')">
        <div class="flex flex-wrap items-center gap-3">
          <span id="epic-card-arrow-${esc(epic.id)}" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
          <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epic.id}</span>
          ${badge(epic.status)}
          <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
          <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
          <span class="ml-auto text-sm text-slate-500">${usd(epicProjected)} projected</span>
        </div>
      </div>
      <div id="epic-cards-${epic.id}" class="border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-lg p-3 hidden">
        ${storyCards
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">${storyCards}</div>`
          : '<p class="text-slate-500 dark:text-slate-400 text-sm">No stories yet.</p>'}
      </div>
    </div>`).join('');

  return `
  <div id="tab-hierarchy" class="p-6" role="tabpanel" aria-labelledby="tab-btn-hierarchy">
    <div class="flex items-center justify-end mb-4 flex-shrink-0">
      <div class="flex gap-1">
        <button id="hier-col-btn" onclick="setHierarchyView('column')"
          class="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          ≡ Column
        </button>
        <button id="hier-card-btn" onclick="setHierarchyView('card')"
          class="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          ⊞ Card
        </button>
      </div>
    </div>
    <div id="hier-column-view">${columnView}</div>
    <div id="hier-card-view" class="hidden">${cardView}</div>
  </div>`;
}

function renderKanbanTab(data) {
  const cols = ['To Do','Planned','In Progress','Blocked','Done'];
  const epicOrder = [...new Set(data.stories.map(s => s.epicId).filter(Boolean))];
  const hasUngrouped = data.stories.some(s => !s.epicId);
  const SWIM_COLORS = ['#7c3aed','#0369a1','#b45309','#166534','#9f1239','#6b21a8','#0e7490','#92400e'];

  const renderCard = s => `
    <div class="story-row story-card-hover bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded p-3 mb-2"
         data-epic="${esc(s.epicId)}" data-status="${esc(s.status)}" data-priority="${esc(s.priority)}">
      <div class="flex gap-1 mb-1">${badge(s.priority)} <span class="text-xs text-slate-500 font-mono">${esc(s.id)}</span></div>
      <p class="text-sm dark:text-slate-100">${esc(s.title)}</p>
      <p class="text-xs text-slate-500 mt-1 font-mono">${esc(s.estimate || '?')}</p>
    </div>`;

  // Column header row
  const headerRow = `<div class="ksw-header-row">
    <div class="ksw-label-cell"></div>
    ${cols.map(col => {
      const count = data.stories.filter(s => s.status === col).length;
      return `<div class="ksw-status-cell">
        <span class="text-xs font-semibold uppercase tracking-widest">${col}</span>
        <span class="text-xs font-normal opacity-60 ml-1">(${count})</span>
      </div>`;
    }).join('')}
  </div>`;

  // Epic swimlane rows
  const swimlaneRows = epicOrder.map((epicId, i) => {
    const color = SWIM_COLORS[i % SWIM_COLORS.length];
    const epicTitle = (data.epics || []).find(e => e.id === epicId);
    const epicLabel = epicTitle ? `${esc(epicId)}: ${esc(epicTitle.title)}` : esc(epicId);
    const epicCount = data.stories.filter(s => s.epicId === epicId).length;
    const sid = `ksw-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return `
    <div class="ksw-swimlane" style="border-left:3px solid ${color}">
      <div class="ksw-swim-hdr" onclick="toggleKsw('${sid}')" style="border-left-color:${color}">
        <span id="${sid}-arrow" class="ksw-arrow">&#9654;</span>
        <span class="ksw-epic-title" style="color:${color}">${epicLabel}</span>
        <span class="ksw-epic-count">${epicCount}</span>
      </div>
      <div id="${sid}-body" class="ksw-swim-body hidden">
        <div class="ksw-label-cell"></div>
        ${cols.map(col => {
          const items = data.stories.filter(s => s.epicId === epicId && s.status === col);
          return `<div class="ksw-cards-cell">${items.map(renderCard).join('')}</div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  // Ungrouped row
  const ungroupedRow = hasUngrouped ? (() => {
    const sid = 'ksw-ungrouped';
    const items = data.stories.filter(s => !s.epicId);
    return `
    <div class="ksw-swimlane" style="border-left:3px solid #64748b">
      <div class="ksw-swim-hdr" onclick="toggleKsw('${sid}')" style="border-left-color:#64748b">
        <span id="${sid}-arrow" class="ksw-arrow">&#9654;</span>
        <span class="ksw-epic-title" style="color:#64748b">No Epic</span>
        <span class="ksw-epic-count">${items.length}</span>
      </div>
      <div id="${sid}-body" class="ksw-swim-body hidden">
        <div class="ksw-label-cell"></div>
        ${cols.map(col => {
          const ci = items.filter(s => s.status === col);
          return `<div class="ksw-cards-cell">${ci.map(renderCard).join('')}</div>`;
        }).join('')}
      </div>
    </div>`;
  })() : '';

  return `<div id="tab-kanban" class="hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-kanban">
    <div class="ksw-outer">
      <div class="ksw-board">${headerRow}${swimlaneRows}${ungroupedRow}</div>
    </div>
  </div>`;
}

function renderTraceabilityTab(data) {
  if (!data.testCases.length) {
    return `<div id="tab-traceability" class="p-6 hidden" role="tabpanel" aria-labelledby="tab-btn-traceability"><p class="text-slate-500">No test cases yet.</p></div>`;
  }
  const tcStatusColor = {
    'Pass':    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    'Fail':    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    'Not Run': 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  };
  const passed = data.testCases.filter(tc => tc.status === 'Pass').length;
  const failed = data.testCases.filter(tc => tc.status === 'Fail').length;
  const notRun = data.testCases.filter(tc => tc.status === 'Not Run').length;
  const headers = data.testCases.map(tc => `<th class="text-xs font-mono p-2 border border-slate-200 dark:border-slate-600">${tc.id}</th>`).join('');
  const rows = data.epics.map(epic => {
    const epicStories = data.stories.filter(s => s.epicId === epic.id);
    if (!epicStories.length) return '';
    const epicRowId = `trace-epic-${epic.id}`;
    const accent = EPIC_ACCENT_COLORS[data.epics.indexOf(epic) % EPIC_ACCENT_COLORS.length];
    const epicTCs = epicStories.flatMap(s => data.testCases.filter(tc => tc.relatedStory === s.id));
    const hasFail = epicTCs.some(tc => tc.status === 'Fail');
    const hasNotRun = !hasFail && epicTCs.some(tc => tc.status === 'Not Run');
    const epicStatusBadge = hasFail
      ? '<span class="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Fail</span>'
      : hasNotRun
      ? '<span class="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Not Run</span>'
      : '';
    const epicHeader = `<tr class="cursor-pointer select-none" style="background:${accent.bg}"
      onclick="toggleTraceEpic('${jsEsc(epic.id)}')" >
      <td colspan="${data.testCases.length + 1}" class="px-3 py-2" style="border-left:4px solid ${accent.border}">
        <div class="flex items-center gap-2 flex-wrap">
          <span id="${epicRowId}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
          <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epic.id}</span>
          ${badge(epic.status)}
          <span class="font-semibold text-sm dark:text-slate-100">${esc(epic.title)}</span>
          ${epicStatusBadge}
        </div>
      </td>
    </tr>`;
    const storyRows = epicStories.map(story => {
      const cells = data.testCases.map(tc => {
        const linked = tc.relatedStory === story.id;
        const cls = linked ? (tcStatusColor[tc.status] || 'bg-amber-50 text-amber-700') : 'bg-white dark:bg-slate-800';
        return `<td class="p-2 border border-slate-200 dark:border-slate-600 text-center text-xs font-medium ${cls}">${linked ? tc.status.slice(0,1) : ''}</td>`;
      }).join('');
      return `<tr class="hidden" data-trace-epic="${epic.id}">
        <td class="text-xs font-mono px-2 py-1 border border-slate-200 dark:border-slate-600 whitespace-nowrap pl-6 dark:text-slate-200">${story.id}</td>
        ${cells}
      </tr>`;
    }).join('');
    return epicHeader + storyRows;
  }).join('');
  return `
  <div id="tab-traceability" class="p-6 hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-traceability">
    <div class="flex flex-wrap items-center gap-4 mb-3 text-xs flex-shrink-0">
      <span class="flex items-center gap-1">
        <span class="w-7 h-5 rounded bg-green-100 text-green-800 flex items-center justify-center font-medium">P</span> Pass
      </span>
      <span class="flex items-center gap-1">
        <span class="w-7 h-5 rounded bg-red-100 text-red-800 flex items-center justify-center font-medium">F</span> Fail
      </span>
      <span class="flex items-center gap-1">
        <span class="w-7 h-5 rounded bg-amber-50 text-amber-700 flex items-center justify-center font-medium">N</span> Not Run
      </span>
      <span class="flex items-center gap-1">
        <span class="w-7 h-5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 inline-block"></span> Not linked
      </span>
      <span class="text-slate-500 ml-2">${passed} Pass &middot; ${failed} Fail &middot; ${notRun} Not Run &middot; ${data.testCases.length} Total</span>
    </div>
    <div class="scroll-table">
      <table class="border-collapse text-sm">
        <thead><tr><th class="p-2 border border-slate-200 dark:border-slate-600 text-xs">Story</th>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function renderTrendsTab(data, options = {}) {
  const trends = options.trends || null;
  const hasData = trends && trends.dates && trends.dates.length >= 2;

  const datesJson = trends ? JSON.stringify(trends.dates.map(d => d.replace('T', ' ').slice(0, 16))) : '[]';
  const doneJson = trends ? JSON.stringify(trends.doneCounts) : '[]';
  const totalJson = trends ? JSON.stringify(trends.totalStories) : '[]';
  const costJson = trends ? JSON.stringify(trends.aiCosts.map(c => c.toFixed(2))) : '[]';
  const coverageJson = trends ? JSON.stringify(trends.coverage.map(c => c !== null ? c.toFixed(1) : null)) : '[]';
  const velocityJson = trends ? JSON.stringify(trends.velocity.map(v => v.toFixed(1))) : '[]';
  const bugsJson = trends ? JSON.stringify(trends.openBugs) : '[]';
  const riskJson = trends ? JSON.stringify(trends.atRisk) : '[]';
  const inputTokensJson = trends ? JSON.stringify(trends.inputTokens) : '[]';
  const outputTokensJson = trends ? JSON.stringify(trends.outputTokens) : '[]';

  const placeholder = `
    <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <svg class="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
      <p class="text-slate-500 dark:text-slate-400 text-lg font-medium">Generate the dashboard at least twice to see trends</p>
      <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">Each generation creates a snapshot in .history/</p>
    </div>`;

  return `
  <div id="tab-trends" class="p-6 hidden" role="tabpanel" aria-labelledby="tab-btn-trends">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      ${!hasData ? placeholder : ''}
      ${hasData ? `
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Done Stories Over Time</h3>
        <div style="height:250px;position:relative"><canvas id="chart-trends-progress"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">AI Cost Over Time</h3>
        <div style="height:250px;position:relative"><canvas id="chart-trends-cost"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Coverage Over Time</h3>
        <div style="height:250px;position:relative"><canvas id="chart-trends-coverage"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Velocity (Story Points)</h3>
        <div style="height:250px;position:relative"><canvas id="chart-trends-velocity"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Open Bugs Over Time</h3>
        <div style="height:250px;position:relative"><canvas id="chart-trends-bugs"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">At-Risk Stories Over Time</h3>
        <div style="height:250px;position:relative"><canvas id="chart-trends-risk"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 col-span-full">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Token Usage Over Time</h3>
        <div style="height:250px;position:relative"><canvas id="chart-trends-tokens"></canvas></div>
      </div>
      ` : ''}
    </div>
  </div>
  <script>
  function initTrendsCharts() {
    var tc = chartTextColor();
    var labels = ${datesJson};
    var hasEnough = labels.length >= 2;

    if (hasEnough && document.getElementById('chart-trends-progress')) {
      _charts.trendsProgress = new Chart(document.getElementById('chart-trends-progress'), {
        type: 'line',
        data: { labels: labels, datasets: [
          { label: 'Done', data: ${doneJson}, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.3 },
          { label: 'Total', data: ${totalJson}, borderColor: '#64748b', backgroundColor: 'transparent', borderDash: [5,5], tension: 0.3 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc }}}, scales: { x: { ticks: { color: tc }, grid: { color: '#e2e8f0' }}, y: { ticks: { color: tc }, grid: { color: '#e2e8f0' }, beginAtZero: true }}}
      });
    }

    if (hasEnough && document.getElementById('chart-trends-cost')) {
      _charts.trendsCost = new Chart(document.getElementById('chart-trends-cost'), {
        type: 'line',
        data: { labels: labels, datasets: [
          { label: 'Total Cost ($)', data: ${costJson}, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.3 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc }}}, scales: { x: { ticks: { color: tc }, grid: { color: '#e2e8f0' }}, y: { ticks: { color: tc }, grid: { color: '#e2e8f0' }, beginAtZero: true }}}
      });
    }

    if (hasEnough && document.getElementById('chart-trends-coverage')) {
      _charts.trendsCoverage = new Chart(document.getElementById('chart-trends-coverage'), {
        type: 'line',
        data: { labels: labels, datasets: [
          { label: 'Coverage %', data: ${coverageJson}, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.3 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc }}}, scales: { x: { ticks: { color: tc }, grid: { color: '#e2e8f0' }}, y: { min: 0, max: 100, ticks: { color: tc }, grid: { color: '#e2e8f0' }}}}
      });
    }

    if (hasEnough && document.getElementById('chart-trends-velocity')) {
      _charts.trendsVelocity = new Chart(document.getElementById('chart-trends-velocity'), {
        type: 'bar',
        data: { labels: labels, datasets: [
          { label: 'Story Points', data: ${velocityJson}, backgroundColor: '#3b82f6' }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc }}}, scales: { x: { ticks: { color: tc }, grid: { color: '#e2e8f0' }}, y: { ticks: { color: tc }, grid: { color: '#e2e8f0' }, beginAtZero: true }}}
      });
    }

    if (hasEnough && document.getElementById('chart-trends-bugs')) {
      _charts.trendsBugs = new Chart(document.getElementById('chart-trends-bugs'), {
        type: 'line',
        data: { labels: labels, datasets: [
          { label: 'Open Bugs', data: ${bugsJson}, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc }}}, scales: { x: { ticks: { color: tc }, grid: { color: '#e2e8f0' }}, y: { ticks: { color: tc }, grid: { color: '#e2e8f0' }, beginAtZero: true }}}
      });
    }

    if (hasEnough && document.getElementById('chart-trends-risk')) {
      _charts.trendsRisk = new Chart(document.getElementById('chart-trends-risk'), {
        type: 'line',
        data: { labels: labels, datasets: [
          { label: 'At-Risk Stories', data: ${riskJson}, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', fill: true, tension: 0.3 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc }}}, scales: { x: { ticks: { color: tc }, grid: { color: '#e2e8f0' }}, y: { ticks: { color: tc }, grid: { color: '#e2e8f0' }, beginAtZero: true }}}
      });
    }

    if (hasEnough && document.getElementById('chart-trends-tokens')) {
      _charts.trendsTokens = new Chart(document.getElementById('chart-trends-tokens'), {
        type: 'line',
        data: { labels: labels, datasets: [
          { label: 'Input', data: ${inputTokensJson}, borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.2)', fill: true },
          { label: 'Output', data: ${outputTokensJson}, borderColor: '#ec4899', backgroundColor: 'rgba(236,72,153,0.2)', fill: true }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc }}}, scales: { x: { ticks: { color: tc }, grid: { color: '#e2e8f0' }}, y: { ticks: { color: tc }, grid: { color: '#e2e8f0' }, beginAtZero: true }}}
      });
    }
  }
  </script>`;
}

function renderChartsTab(data) {
  const epicLabels = JSON.stringify(data.epics.map(e => e.id));
  const epicDone = JSON.stringify(data.epics.map(e => data.stories.filter(s => s.epicId === e.id && s.status === 'Done').length));
  const epicInProgress = JSON.stringify(data.epics.map(e => data.stories.filter(s => s.epicId === e.id && s.status === 'In Progress').length));
  const epicPlanned = JSON.stringify(data.epics.map(e => data.stories.filter(s => s.epicId === e.id && ['Planned','To Do'].includes(s.status)).length));
  const epicProjected = JSON.stringify(data.epics.map(e => data.stories.filter(s => s.epicId === e.id).reduce((sum, s) => sum + (data.costs[s.id] && data.costs[s.id].projectedUsd || 0), 0)));
  const epicAI = JSON.stringify(data.epics.map(e => {
    const branchStories = data.stories.filter(s => s.epicId === e.id);
    return branchStories.reduce((sum, s) => sum + (data.costs[s.id] ? data.costs[s.id].costUsd || 0 : 0), 0);
  }));
  const coveragePct = data.coverage.available !== false ? data.coverage.overall.toFixed(1) : null;
  const coveragePctNum = coveragePct !== null ? parseFloat(coveragePct) : 0;
  const coverageGap = coveragePct !== null ? (100 - coveragePctNum).toFixed(1) : '100';
  const timeline = data.sessionTimeline || [];
  const sessionDates = JSON.stringify(timeline.map(s => s.date));
  const sessionCosts = JSON.stringify(timeline.map(s => s.cumCost.toFixed(2)));
  const sessionPerCosts = JSON.stringify(timeline.map((s, i) =>
    (i === 0 ? s.cumCost : s.cumCost - timeline[i - 1].cumCost).toFixed(2)
  ));
  const statusCounts = JSON.stringify(
    ['Done','In Progress','Planned','To Do','Blocked'].map(st => data.stories.filter(s => s.status === st).length)
  );

  return `
  <div id="tab-charts" class="p-6 hidden" role="tabpanel" aria-labelledby="tab-btn-charts">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Epic Progress</h3>
        <div style="height:300px;position:relative"><canvas id="chart-epic-progress"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Cost Breakdown (Projected vs AI)</h3>
        <div style="height:300px;position:relative"><canvas id="chart-cost-breakdown"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Test Coverage</h3>
        <div style="height:300px;position:relative">
          <canvas id="chart-coverage"></canvas>
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="padding-bottom:3rem">
            <div class="text-center">
              <div class="text-2xl font-bold text-slate-700 dark:text-slate-200">${coveragePct !== null ? coveragePct + '%' : 'N/A'}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">overall</div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">AI Cost Timeline</h3>
        <div style="height:300px;position:relative"><canvas id="chart-ai-timeline"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Story Status Distribution</h3>
        <div style="height:300px;position:relative"><canvas id="chart-burndown"></canvas></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Budget Burn Rate</h3>
        <div style="height:300px;position:relative"><canvas id="chart-burn-rate"></canvas></div>
      </div>

    </div>
  </div>
  <script>
  var _charts = {};
  function chartTextColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--clr-chart-text').trim() || '#475569';
  }
  function initCharts() {
    var tc = chartTextColor();
    _charts.epicProgress = new Chart(document.getElementById('chart-epic-progress'), {
      type: 'bar',
      data: { labels: ${epicLabels}, datasets: [
        { label: 'Done', data: ${epicDone}, backgroundColor: '#22c55e' },
        { label: 'In Progress', data: ${epicInProgress}, backgroundColor: '#3b82f6' },
        { label: 'Planned/To Do', data: ${epicPlanned}, backgroundColor: '#cbd5e1' },
      ]},
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tc } } },
        scales: { x: { stacked: true, ticks: { color: tc } }, y: { stacked: true, ticks: { color: tc } } } }
    });
    _charts.costBreakdown = new Chart(document.getElementById('chart-cost-breakdown'), {
      type: 'bar',
      data: { labels: ${epicLabels}, datasets: [
        { label: 'Projected ($)', data: ${epicProjected}, backgroundColor: '#f59e0b', yAxisID: 'yProjected' },
        { label: 'AI Cost ($)', data: ${epicAI}, backgroundColor: '#0d9488', yAxisID: 'yAI' },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tc } } },
        scales: {
          x: { ticks: { color: tc } },
          yProjected: { type: 'linear', position: 'left', ticks: { color: tc }, title: { display: true, text: 'Projected ($)', color: tc } },
          yAI: { type: 'linear', position: 'right', ticks: { color: tc }, title: { display: true, text: 'AI Cost ($)', color: tc }, grid: { drawOnChartArea: false } }
        }
      }
    });
    _charts.coverage = new Chart(document.getElementById('chart-coverage'), {
      type: 'doughnut',
      data: { labels: ['Covered', 'Gap'], datasets: [{ data: [${coveragePctNum}, ${coverageGap}], backgroundColor: ['${coveragePct !== null ? '#22c55e' : '#94a3b8'}','#cbd5e1'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: true, position: 'bottom', labels: { color: tc } } } }
    });
    _charts.aiTimeline = new Chart(document.getElementById('chart-ai-timeline'), {
      type: 'line',
      data: { labels: ${sessionDates}, datasets: [{ label: 'Cumulative AI Cost ($)', data: ${sessionCosts}, borderColor: '#0d9488', tension: 0.3, fill: true, backgroundColor: 'rgba(13,148,136,0.1)' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc } } }, scales: { x: { ticks: { color: tc } }, y: { ticks: { color: tc } } } }
    });
    _charts.burndown = new Chart(document.getElementById('chart-burndown'), {
      type: 'doughnut',
      data: { labels: ['Done','In Progress','Planned','To Do','Blocked'], datasets: [{ data: ${statusCounts}, backgroundColor: ['#22c55e','#3b82f6','#94a3b8','#f59e0b','#ef4444'], borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: tc } } } }
    });
    _charts.burnRate = new Chart(document.getElementById('chart-burn-rate'), {
      type: 'bar',
      data: { labels: ${sessionDates}, datasets: [{ label: 'Session AI Spend ($)', data: ${sessionPerCosts}, backgroundColor: '#6366f1' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc } } }, scales: { x: { ticks: { color: tc } }, y: { ticks: { color: tc } } } }
    });
  }
  function updateChartTheme() {
    var tc = chartTextColor();
    Object.values(_charts).forEach(function(c) {
      if (!c) return;
      if (c.options.plugins && c.options.plugins.legend && c.options.plugins.legend.labels) {
        c.options.plugins.legend.labels.color = tc;
      }
      if (c.options.scales) {
        Object.values(c.options.scales).forEach(function(s) {
          if (s.ticks) s.ticks.color = tc;
          if (s.title) s.title.color = tc;
        });
      }
      c.update();
    });
  }
  </script>`;
}

function renderCostsTab(data, options = {}) {
  const t = data.costs._totals;
  const totalProjected = data.stories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);

  const budget = data.budget || {};
  const hasBudget = budget.hasBudget;

  let budgetSection = '';
  if (hasBudget) {
    const br = budget.burnRate;
    const days = budget.daysRemaining;
    const brDisplay = br > 0 ? `Burn Rate: $${br.toFixed(2)}/day` : 'No recent spend data';
    const exDisplay = days !== null ? `Exhaustion: ${days} days remaining` : (br > 0 ? 'Budget unlimited' : '');

    const epicRows = budget.epicBudgets.map((eb, i) => {
      const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
      const barPct = eb.percentUsed !== null ? Math.min(100, eb.percentUsed) : 0;
      let barColor = '#22c55e';
      if (eb.percentUsed !== null) {
        if (eb.percentUsed >= 90) barColor = '#ef4444';
        else if (eb.percentUsed >= 75) barColor = '#f97316';
        else if (eb.percentUsed >= 50) barColor = '#eab308';
      }
      return `<tr class="border-t border-slate-100 dark:border-slate-700">
        <td class="px-3 py-2"><span class="font-mono text-xs font-bold" style="color:${accent.border}">${eb.id}</span></td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${eb.budget !== null ? usd(eb.budget) : '—'}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${usd(eb.spent)}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${eb.remaining !== null ? usd(eb.remaining) : '—'}</td>
        <td class="px-3 py-2">
          ${eb.percentUsed !== null ? `<div class="flex items-center gap-2"><div style="width:60px;height:6px;background:#334155;border-radius:3px;overflow:hidden"><div style="width:${barPct}%;height:100%;background:${barColor}"></div></div><span class="text-xs" style="color:${barColor}">${eb.percentUsed}%</span></div>` : '—'}
        </td>
      </tr>`;
    }).join('');

    const csvDownload = options.budgetCSV ? `onclick="downloadBudgetCSV()"` : '';
    budgetSection = `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-4">
      <div class="flex flex-wrap items-center gap-6 mb-4">
        <div>
          <span class="text-xs text-slate-500 uppercase">${brDisplay}</span>
        </div>
        <div>
          <span class="text-xs text-slate-500 uppercase">${exDisplay}</span>
        </div>
        <div>
          <span class="text-xs text-slate-500 uppercase">Total Budget: ${usd(budget.totalBudget)}</span>
        </div>
        <div>
          <span class="text-xs text-slate-500 uppercase">Spent: ${usd(budget.totalSpent)}</span>
        </div>
      </div>
      <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Per-Epic Budget</h3>
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase bg-slate-50 dark:bg-slate-700">
          <tr>
            <th class="px-3 py-2">Epic</th>
            <th class="px-3 py-2">Budget</th>
            <th class="px-3 py-2">Spent</th>
            <th class="px-3 py-2">Remaining</th>
            <th class="px-3 py-2">% Used</th>
          </tr>
        </thead>
        <tbody>${epicRows}</tbody>
      </table>
      <div class="mt-4">
        <button ${csvDownload} class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium">Export Budget CSV</button>
      </div>
    </div>`;
  }

  // ── Column view: stories table ──────────────────────────────────────────
  const epicBlocks = data.epics.map((epic, epicIdx) => {
    const accent = EPIC_ACCENT_COLORS[epicIdx % EPIC_ACCENT_COLORS.length];
    const epicStories = data.stories.filter(s => s.epicId === epic.id);
    const epicProjected = epicStories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);
    const epicAI = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).costUsd || 0), 0);
    const epicIn = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).inputTokens || 0), 0);
    const epicOut = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).outputTokens || 0), 0);
    const ceid = `costs-ep-${jsEsc(epic.id)}`;
    const storyRows = epicStories.map(story => {
      const projected = (data.costs[story.id] && data.costs[story.id].projectedUsd || 0);
      const ai = data.costs[story.id] || {};
      return `<tr class="border-t border-slate-100 dark:border-slate-700">
        <td class="px-3 py-2 pl-8 font-mono text-xs text-slate-500 whitespace-nowrap">${story.id}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(story.title)}</td>
        <td class="px-3 py-2 text-center">${badge(story.status)}</td>
        <td class="px-3 py-2 text-center text-sm dark:text-slate-200">${esc(story.estimate || '?')}</td>
        <td class="px-3 py-2 text-right text-sm dark:text-slate-200">${usd(projected)}</td>
        <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${usd(ai.costUsd || 0)}</td>
        <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(ai.inputTokens || 0)} / ${fmtNum(ai.outputTokens || 0)}</td>
      </tr>`;
    }).join('');
    return `<tbody>
    <tr class="border-t-2 border-slate-300 dark:border-slate-600 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('${ceid}','${ceid}-arrow')">
      <td colspan="4" class="px-3 py-2">
        <span id="${ceid}-arrow" class="text-slate-400 text-xs mr-2">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${epic.id}</span>
        <span class="text-sm font-semibold ml-2 text-slate-700 dark:text-slate-200">${esc(epic.title)}</span>
        <span class="ml-2">${badge(epic.status)}</span>
      </td>
      <td class="px-3 py-2 text-right text-sm font-medium dark:text-slate-200">${usd(epicProjected)}</td>
      <td class="px-3 py-2 text-right text-sm font-medium text-teal-700 dark:text-teal-400">${usd(epicAI)}</td>
      <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(epicIn)} / ${fmtNum(epicOut)}</td>
    </tr>
    </tbody><tbody id="${ceid}" class="hidden">${storyRows}</tbody>`;
  }).join('');

  // ── Bug cost helpers (shared by column + card) ──────────────────────────
  const allBugCosts = data.bugs.map(b => (data.costs._bugs && data.costs._bugs[b.id]) || { costUsd: 0, inputTokens: 0, outputTokens: 0 });
  const bugTotalAI        = allBugCosts.reduce((s, bc) => s + (bc.isEstimated ? 0 : (bc.costUsd || 0)), 0);
  const bugTotalProjected = allBugCosts.reduce((s, bc) => s + (bc.projectedUsd || 0), 0);
  const bugTotalIn        = allBugCosts.reduce((s, bc) => s + (bc.isEstimated ? 0 : (bc.inputTokens || 0)), 0);
  const bugTotalOut       = allBugCosts.reduce((s, bc) => s + (bc.isEstimated ? 0 : (bc.outputTokens || 0)), 0);

  // ── Bug cost epic grouping ───────────────────────────────────────────────
  const bugCostStoryEpicMap = {};
  data.stories.forEach(s => { bugCostStoryEpicMap[s.id] = s.epicId; });
  const bugCostEpicGroupIds = [];
  const bugsByCostEpic = {};
  data.bugs.forEach(bug => {
    const epicId = bugCostStoryEpicMap[bug.relatedStory] || '_ungrouped';
    if (!bugsByCostEpic[epicId]) { bugsByCostEpic[epicId] = []; bugCostEpicGroupIds.push(epicId); }
    bugsByCostEpic[epicId].push(bug);
  });
  const bugCostEpicOrder = [...new Set(bugCostEpicGroupIds)].sort((a, b) => {
    if (a === '_ungrouped') return 1;
    if (b === '_ungrouped') return -1;
    return a.localeCompare(b);
  });

  // ── Column view: bug rows grouped by epic ────────────────────────────────
  const bugColGroups = bugCostEpicOrder.map((epicId, i) => {
    const bugs = bugsByCostEpic[epicId];
    const epic = data.epics.find(e => e.id === epicId);
    const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
    const label = epic ? `${epicId}: ${esc(epic.title)}` : (epicId === '_ungrouped' ? 'No Epic' : epicId);
    const bceid = `bug-costs-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const epicProjected = bugs.reduce((s, b) => s + ((data.costs._bugs && data.costs._bugs[b.id] && data.costs._bugs[b.id].projectedUsd) || 0), 0);
    const epicAI       = bugs.reduce((s, b) => s + (data.costs._bugs && data.costs._bugs[b.id] && !data.costs._bugs[b.id].isEstimated ? (data.costs._bugs[b.id].costUsd || 0) : 0), 0);
    const epicIn       = bugs.reduce((s, b) => s + (data.costs._bugs && data.costs._bugs[b.id] && !data.costs._bugs[b.id].isEstimated ? (data.costs._bugs[b.id].inputTokens || 0) : 0), 0);
    const epicOut      = bugs.reduce((s, b) => s + (data.costs._bugs && data.costs._bugs[b.id] && !data.costs._bugs[b.id].isEstimated ? (data.costs._bugs[b.id].outputTokens || 0) : 0), 0);
    const bugRows = bugs.map(bug => {
      const bc = (data.costs._bugs && data.costs._bugs[bug.id]) || { costUsd: 0, inputTokens: 0, outputTokens: 0 };
      return `<tr class="border-t border-slate-100 dark:border-slate-700">
        <td class="px-3 py-2 pl-8 font-mono text-xs text-slate-500 whitespace-nowrap">${esc(bug.id)}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(bug.title)}</td>
        <td class="px-3 py-2 text-center">${badge(bug.severity)}</td>
        <td class="px-3 py-2 text-center">${badge(bug.status)}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.relatedStory || '—')}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.fixBranch || '—')}</td>
        <td class="px-3 py-2 text-right text-sm dark:text-slate-200">${bc.projectedUsd > 0 ? usd(bc.projectedUsd) : '—'}</td>
        <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${bc.isEstimated ? '—' : usd(bc.costUsd)}</td>
        <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${bc.isEstimated ? '—' : `${fmtNum(bc.inputTokens)} / ${fmtNum(bc.outputTokens)}`}</td>
      </tr>`;
    }).join('');
    return `<tbody>
    <tr class="border-t-2 border-slate-300 dark:border-slate-600 cursor-pointer select-none bug-epic-header" data-epic="${epicId}" style="background:${accent.bg}" onclick="toggleSection('${bceid}','${bceid}-arrow')">
      <td colspan="6" class="px-3 py-2">
        <span id="${bceid}-arrow" class="text-slate-400 text-xs mr-2">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-2 text-xs text-slate-500 bug-count">(${bugs.length})</span>
      </td>
      <td class="px-3 py-2 text-right text-sm font-medium dark:text-slate-200">${epicProjected > 0 ? usd(epicProjected) : '—'}</td>
      <td class="px-3 py-2 text-right text-sm font-medium text-teal-700 dark:text-teal-400">${usd(epicAI)}</td>
      <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(epicIn)} / ${fmtNum(epicOut)}</td>
    </tr>
    </tbody><tbody id="${bceid}" class="hidden">${bugRows}</tbody>`;
  }).join('');

  // ── Card view: story cards grouped by epic ──────────────────────────────
  const epicCardBlocks = data.epics.map(epic => {
    const epicStories = data.stories.filter(s => s.epicId === epic.id);
    if (!epicStories.length) return '';
    const storyCards = epicStories.map(story => {
      const ai = data.costs[story.id] || {};
      const projected = ai.projectedUsd || 0;
      return `<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono text-xs text-slate-500 whitespace-nowrap">${story.id}</span>
          ${badge(story.status)}
          <span class="ml-auto text-xs text-slate-400">${esc(story.estimate || '?')}</span>
        </div>
        <p class="text-sm font-medium dark:text-slate-200">${esc(story.title)}</p>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
          <div>
            <span class="text-slate-500 block">Projected</span>
            <span class="font-mono dark:text-slate-200">${usd(projected)}</span>
          </div>
          <div>
            <span class="text-slate-500 block">AI Actual</span>
            <span class="font-mono text-teal-700 dark:text-teal-400">${usd(ai.costUsd || 0)}</span>
          </div>
          <div class="tokens-col col-span-2">
            <span class="text-slate-500 block">Tokens (in / out)</span>
            <span class="font-mono text-slate-500">${fmtNum(ai.inputTokens || 0)} / ${fmtNum(ai.outputTokens || 0)}</span>
          </div>
        </div>
      </div>`;
    }).join('');
    const epicProjTotal = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).projectedUsd || 0), 0);
    const epicAITotal   = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).costUsd || 0), 0);
    const cceid = `costs-card-ep-${jsEsc(epic.id)}`;
    const accent2 = EPIC_ACCENT_COLORS[data.epics.indexOf(epic) % EPIC_ACCENT_COLORS.length];
    return `<div class="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" style="border-left:4px solid ${accent2.border}">
      <div class="flex items-center gap-2 px-4 py-3 flex-wrap cursor-pointer select-none" style="background:${accent2.bg}" onclick="toggleSection('${cceid}','${cceid}-arrow')">
        <span id="${cceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent2.border}">${epic.id}</span>
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${esc(epic.title)}</span>
        ${badge(epic.status)}
        <span class="ml-auto text-xs text-slate-500">Proj ${usd(epicProjTotal)} · AI ${usd(epicAITotal)}</span>
      </div>
      <div id="${cceid}" class="p-3 hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${storyCards}</div>
      </div>
    </div>`;
  }).join('');

  // ── Card view: bug cards grouped by epic ────────────────────────────────
  const bugCardEpicBlocks = bugCostEpicOrder.map((epicId, i) => {
    const bugs = bugsByCostEpic[epicId];
    const epic = data.epics.find(e => e.id === epicId);
    const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
    const label = epic ? `${epicId}: ${esc(epic.title)}` : (epicId === '_ungrouped' ? 'No Epic' : epicId);
    const bcceid = `bug-costs-card-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const epicBugProjected = bugs.reduce((s, b) => s + ((data.costs._bugs && data.costs._bugs[b.id] && data.costs._bugs[b.id].projectedUsd) || 0), 0);
    const epicBugAI        = bugs.reduce((s, b) => s + (data.costs._bugs && data.costs._bugs[b.id] && !data.costs._bugs[b.id].isEstimated ? (data.costs._bugs[b.id].costUsd || 0) : 0), 0);
    const bugCardItems = bugs.map(bug => {
      const bc = (data.costs._bugs && data.costs._bugs[bug.id]) || {};
      return `<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono text-xs text-slate-500 whitespace-nowrap">${esc(bug.id)}</span>
          ${badge(bug.severity)} ${badge(bug.status)}
        </div>
        <p class="text-sm font-medium dark:text-slate-200">${esc(bug.title)}</p>
        <div class="text-xs text-slate-500">Story: <span class="font-mono">${esc(bug.relatedStory || '—')}</span></div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
          <div>
            <span class="text-slate-500 block">Projected</span>
            <span class="font-mono dark:text-slate-200">${bc.projectedUsd > 0 ? usd(bc.projectedUsd) : '—'}</span>
          </div>
          <div>
            <span class="text-slate-500 block">AI Actual</span>
            <span class="font-mono text-teal-700 dark:text-teal-400">${bc.isEstimated ? '—' : usd(bc.costUsd || 0)}</span>
          </div>
        </div>
      </div>`;
    }).join('');
    return `<div class="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bug-epic-card" data-epic="${epicId}" style="border-left:4px solid ${accent.border}">
      <div class="flex items-center gap-2 px-4 py-3 flex-wrap cursor-pointer select-none bug-epic-header" data-epic="${epicId}" style="background:${accent.bg}" onclick="toggleSection('${bcceid}','${bcceid}-arrow')">
        <span id="${bcceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-2 text-xs text-slate-500 bug-count">(${bugs.length})</span>
        <span class="ml-auto text-xs text-slate-500">Proj ${usd(epicBugProjected)} · AI ${usd(epicBugAI)}</span>
      </div>
      <div id="${bcceid}" class="p-3 hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${bugCardItems}</div>
      </div>
    </div>`;
  }).join('');

  const bugFixColumnSection = data.bugs.length ? `
    <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4 mb-2 flex-shrink-0">Bug Fix Costs</h3>
    <div class="scroll-table">
    <table class="w-full text-left text-sm border-collapse">
      <thead class="text-xs uppercase">
        <tr>
          <th class="px-3 py-2">Bug</th><th class="px-3 py-2">Title</th><th class="px-3 py-2 text-center">Severity</th>
          <th class="px-3 py-2 text-center">Status</th><th class="px-3 py-2">Story</th>
          <th class="px-3 py-2">Fix Branch</th><th class="px-3 py-2 text-right">Projected</th>
          <th class="px-3 py-2 text-right">AI Cost</th>
          <th class="px-3 py-2 text-right tokens-col">Tokens (in/out)</th>
        </tr>
      </thead>
      ${bugColGroups}
      <tfoot class="bg-slate-50 dark:bg-slate-700 font-semibold border-t-2 border-slate-300 dark:border-slate-600">
        <tr>
          <td colspan="6" class="px-3 py-2 text-right text-sm dark:text-slate-200">Totals</td>
          <td class="px-3 py-2 text-right text-sm dark:text-slate-200">${usd(bugTotalProjected)}</td>
          <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${usd(bugTotalAI)}</td>
          <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(bugTotalIn)} / ${fmtNum(bugTotalOut)}</td>
        </tr>
      </tfoot>
    </table>
    </div>` : '';

  const bugFixCardSection = data.bugs.length ? `
    <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-6 mb-3">Bug Fix Costs</h3>
    ${bugCardEpicBlocks}` : '';

  return `
  <div id="tab-costs" class="p-6 hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-costs">
    ${budgetSection}
    <div class="flex items-center justify-between mb-4 flex-shrink-0">
      <span class="text-sm text-slate-500 dark:text-slate-400">${data.stories.length} stories · ${data.bugs.length} bugs</span>
      <div class="flex gap-1">
        <button id="costs-col-btn" onclick="setCostsView('column')"
          class="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          ≡ Column
        </button>
        <button id="costs-card-btn" onclick="setCostsView('card')"
          class="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          ⊞ Card
        </button>
      </div>
    </div>

    <div id="costs-column-view" class="flex flex-col" style="flex:1;min-height:0;overflow-y:auto">
      <div class="scroll-table">
      <table class="w-full text-left text-sm border-collapse">
        <thead class="text-xs uppercase">
          <tr>
            <th class="px-3 py-2">Story</th><th class="px-3 py-2">Title</th><th class="px-3 py-2 text-center">Status</th>
            <th class="px-3 py-2 text-center">Size</th><th class="px-3 py-2 text-right">Projected</th>
            <th class="px-3 py-2 text-right">AI Cost</th><th class="px-3 py-2 text-right tokens-col">Tokens (in/out)</th>
          </tr>
        </thead>
        <tbody>${epicBlocks}</tbody>
        <tfoot class="bg-slate-50 dark:bg-slate-700 font-semibold border-t-2 border-slate-300 dark:border-slate-600">
          <tr>
            <td colspan="4" class="px-3 py-2 text-right text-sm dark:text-slate-200">Totals</td>
            <td class="px-3 py-2 text-right text-sm dark:text-slate-200">${usd(totalProjected)}</td>
            <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${usd(t.costUsd + bugTotalAI)}</td>
            <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(t.inputTokens)} / ${fmtNum(t.outputTokens)}</td>
          </tr>
        </tfoot>
      </table>
      </div>
      ${bugFixColumnSection}
    </div>

    <div id="costs-card-view" class="hidden" style="flex:1;min-height:0;overflow-y:auto">
      ${epicCardBlocks}
      ${bugFixCardSection}
    </div>
  </div>
  <script>
  function setCostsView(v) {
    var col = document.getElementById('costs-column-view');
    var card = document.getElementById('costs-card-view');
    var colBtn = document.getElementById('costs-col-btn');
    var cardBtn = document.getElementById('costs-card-btn');
    if (!col) return;
    col.classList.toggle('hidden', v !== 'column');
    card.classList.toggle('hidden', v !== 'card');
    colBtn.style.fontWeight = v === 'column' ? '700' : '';
    colBtn.style.background = v === 'column' ? 'rgba(59,130,246,0.1)' : '';
    cardBtn.style.fontWeight = v === 'card' ? '700' : '';
    cardBtn.style.background = v === 'card' ? 'rgba(59,130,246,0.1)' : '';
    localStorage.setItem('costsView', v);
  }
  (function() { setCostsView(localStorage.getItem('costsView') || 'column'); })();
  </script>`;
}

function renderBugsTab(data) {
  if (!data.bugs.length) {
    return `<div id="tab-bugs" class="p-6 hidden" role="tabpanel" aria-labelledby="tab-btn-bugs"><p class="text-slate-500">No bugs logged yet.</p></div>`;
  }

  const lessonCell = (bug) => {
    if (!bug.lessonEncoded || !bug.lessonEncoded.startsWith('Yes')) return '○';
    const lm = bug.lessonEncoded.match(/L-\d{4}/);
    if (!lm) return '✓';
    return `<a href="#" onclick="showTab('lessons');setTimeout(function(){var colView=document.getElementById('lessons-column-view');var prefix=colView&&!colView.classList.contains('hidden')?'lesson-col-':'lesson-card-';var el=document.getElementById(prefix+'${lm[0]}');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},50);return false;" class="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs whitespace-nowrap" title="View lesson ${lm[0]}">&#10003; ${lm[0]} &#8599;</a>`;
  };

  // Build story→epic map
  const storyEpicMap = {};
  data.stories.forEach(s => { storyEpicMap[s.id] = s.epicId; });

  // Group bugs by epic
  const bugEpicIds = [];
  const bugsByEpic = {};
  data.bugs.forEach(bug => {
    const epicId = storyEpicMap[bug.relatedStory] || '_ungrouped';
    if (!bugsByEpic[epicId]) { bugsByEpic[epicId] = []; bugEpicIds.push(epicId); }
    bugsByEpic[epicId].push(bug);
  });
  const bugEpicOrder = [...new Set(bugEpicIds)].sort((a, b) => {
    if (a === '_ungrouped') return 1;
    if (b === '_ungrouped') return -1;
    return a.localeCompare(b);
  });

  const renderBugRow = bug => {
    const epicId = storyEpicMap[bug.relatedStory] || '_ungrouped';
    return `
    <tr id="bug-row-${bug.id}" class="bug-row border-t border-slate-100 dark:border-slate-700" data-status="${bug.status}" data-epic="${epicId}">
      <td class="px-3 py-2 font-mono text-xs whitespace-nowrap dark:text-slate-200">${bug.id}</td>
      <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(bug.title)}</td>
      <td class="px-3 py-2 text-center">${badge(bug.severity)}</td>
      <td class="px-3 py-2 text-center">${badge(bug.status)}</td>
      <td class="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">${esc(bug.relatedStory)}</td>
      <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.fixBranch || '—')}</td>
      <td class="px-3 py-2 text-center text-xs dark:text-slate-200">${lessonCell(bug)}</td>
    </tr>`;
  };

  const renderBugCard = bug => {
    const epicId = storyEpicMap[bug.relatedStory] || '_ungrouped';
    return `
    <div id="bug-card-${bug.id}" class="bug-row bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col gap-2" data-status="${bug.status}" data-epic="${epicId}">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-mono text-xs text-slate-500 whitespace-nowrap">${bug.id}</span>
        ${badge(bug.severity)} ${badge(bug.status)}
      </div>
      <p class="text-sm font-medium dark:text-slate-200">${esc(bug.title)}</p>
      <div class="text-xs text-slate-500 flex flex-col gap-0.5">
        <span>Story: <span class="font-mono">${esc(bug.relatedStory || '—')}</span></span>
        <span class="truncate" title="${esc(bug.fixBranch || '')}">Branch: <span class="font-mono">${esc(bug.fixBranch || '—')}</span></span>
      </span>
    </div>
    <div class="flex items-center justify-between mt-1">
      <span class="text-xs text-slate-500">Lesson: <span class="dark:text-slate-200">${lessonCell(bug)}</span></span>
    </div>
  </div>`;
  };

  const bugColGroups = bugEpicOrder.map((epicId, i) => {
    const bugs = bugsByEpic[epicId];
    const epic = data.epics.find(e => e.id === epicId);
    const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
    const label = epic ? `${epicId}: ${esc(epic.title)}` : (epicId === '_ungrouped' ? 'No Epic' : epicId);
    const beid = `bugs-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return `<tbody>
    <tr class="border-t-2 border-slate-300 dark:border-slate-600 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('${beid}','${beid}-arrow')">
      <td colspan="7" class="px-3 py-2">
        <span id="${beid}-arrow" class="text-slate-400 text-xs mr-2">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-2 text-xs text-slate-500">(${bugs.length})</span>
      </td>
    </tr>
    </tbody><tbody id="${beid}" class="hidden">${bugs.map(renderBugRow).join('')}</tbody>`;
  }).join('');

  const bugCardGroups = bugEpicOrder.map((epicId, i) => {
    const bugs = bugsByEpic[epicId];
    const epic = data.epics.find(e => e.id === epicId);
    const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
    const label = epic ? `${epicId}: ${esc(epic.title)}` : (epicId === '_ungrouped' ? 'No Epic' : epicId);
    const bceid = `bugs-card-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return `<div class="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" style="border-left:4px solid ${accent.border}">
      <div class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('${bceid}','${bceid}-arrow')">
        <span id="${bceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-1 text-xs text-slate-500">(${bugs.length})</span>
      </div>
      <div id="${bceid}" class="p-3 hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${bugs.map(renderBugCard).join('')}</div>
      </div>
    </div>`;
  }).join('');

  return `
  <div id="tab-bugs" class="p-6 hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-bugs">
    <div class="flex items-center justify-between mb-4 flex-shrink-0">
      <span class="text-sm text-slate-500 dark:text-slate-400">${data.bugs.length} bug${data.bugs.length !== 1 ? 's' : ''}</span>
      <div class="flex gap-1">
        <button id="bugs-col-btn" onclick="setBugsView('column')"
          class="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          ≡ Column
        </button>
        <button id="bugs-card-btn" onclick="setBugsView('card')"
          class="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          ⊞ Card
        </button>
      </div>
    </div>

    <div id="bugs-column-view" class="scroll-table">
      <table class="w-full text-left text-sm border-collapse">
        <thead class="text-xs uppercase">
          <tr>
            <th class="px-3 py-2">ID</th><th class="px-3 py-2">Title</th><th class="px-3 py-2 text-center">Severity</th>
            <th class="px-3 py-2 text-center">Status</th><th class="px-3 py-2">Story</th>
            <th class="px-3 py-2">Branch</th><th class="px-3 py-2 text-center whitespace-nowrap" style="min-width:8rem">Lesson</th>
          </tr>
        </thead>
        ${bugColGroups}
      </table>
    </div>

    <div id="bugs-card-view" class="hidden" style="overflow-y:auto">
      ${bugCardGroups}
    </div>
  </div>
  <script>
  function setBugsView(v) {
    var col = document.getElementById('bugs-column-view');
    var card = document.getElementById('bugs-card-view');
    var colBtn = document.getElementById('bugs-col-btn');
    var cardBtn = document.getElementById('bugs-card-btn');
    if (!col) return;
    col.classList.toggle('hidden', v !== 'column');
    card.classList.toggle('hidden', v !== 'card');
    colBtn.style.fontWeight = v === 'column' ? '700' : '';
    colBtn.style.background = v === 'column' ? 'rgba(59,130,246,0.1)' : '';
    cardBtn.style.fontWeight = v === 'card' ? '700' : '';
    cardBtn.style.background = v === 'card' ? 'rgba(59,130,246,0.1)' : '';
    localStorage.setItem('bugsView', v);
  }
  (function() { setBugsView(localStorage.getItem('bugsView') || 'column'); })();
  </script>`;
}

function renderLessonsTab(data) {
  const lessons = data.lessons || [];
  if (!lessons.length) {
    return `<div id="tab-lessons" class="p-6 hidden" role="tabpanel" aria-labelledby="tab-btn-lessons"><p class="text-slate-500">No lessons logged yet.</p></div>`;
  }

  // Build reverse map: lessonId → first bugId that references it
  const lessonBugMap = {};
  for (const bug of data.bugs) {
    const m = bug.lessonEncoded && bug.lessonEncoded.match(/L-\d{4}/);
    if (m && !lessonBugMap[m[0]]) lessonBugMap[m[0]] = bug.id;
  }

  const bugRefLink = (lessonId) => {
    const bugId = lessonBugMap[lessonId];
    if (!bugId) return '—';
    return `<a href="#" onclick="showTab('bugs');setTimeout(function(){var el=document.getElementById('bug-row-${bugId}');if(el)el.scrollIntoView({behavior:'smooth',block:'center'});},50);return false;" class="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs">${bugId} ↗</a>`;
  };

  // Build lesson→epic grouping via lesson→bug→story→epic
  const lessonStoryMap = {};
  for (const bug of data.bugs) {
    const m = bug.lessonEncoded && bug.lessonEncoded.match(/L-\d{4}/);
    if (m) lessonStoryMap[m[0]] = bug.relatedStory;
  }
  const lessonStoryEpicMap = {};
  data.stories.forEach(s => { lessonStoryEpicMap[s.id] = s.epicId; });

  const lessonEpicIds = [];
  const lessonsByEpic = {};
  lessons.forEach(l => {
    const storyId = lessonStoryMap[l.id];
    const epicId = (storyId && lessonStoryEpicMap[storyId]) || '_ungrouped';
    if (!lessonsByEpic[epicId]) { lessonsByEpic[epicId] = []; lessonEpicIds.push(epicId); }
    lessonsByEpic[epicId].push(l);
  });
  const lessonEpicOrder = [...new Set(lessonEpicIds)];

  const renderLessonRow = l => `
  <tr id="lesson-col-${l.id}" class="border-t border-slate-100 dark:border-slate-700 align-top">
    <td class="px-3 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">${l.id}</td>
    <td class="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">${esc(l.rule)}</td>
    <td class="px-3 py-3 text-sm text-slate-500 dark:text-slate-400 italic">${esc(l.context)}</td>
    <td class="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">${l.date ? l.date.slice(0, 7) : '—'}</td>
    <td class="px-3 py-3 text-xs whitespace-nowrap">${bugRefLink(l.id)}</td>
  </tr>`;

  const renderLessonCard = l => `
  <div id="lesson-card-${l.id}" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap flex-shrink-0">${l.id}</span>
      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${esc(l.title)}</span>
    </div>
    <hr class="border-slate-100 dark:border-slate-700">
    <div>
      <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Rule</span>
      <p class="text-sm text-slate-700 dark:text-slate-200 mt-0.5">${esc(l.rule)}</p>
    </div>
    <div>
      <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Context</span>
      <p class="text-sm text-slate-500 dark:text-slate-400 italic mt-0.5">${esc(l.context)}</p>
    </div>
    <div class="flex items-center justify-between mt-1">
      <span class="text-xs text-slate-400">${l.date ? l.date.slice(0, 7) : '—'}</span>
      <span class="text-xs text-slate-500">Bug ref: ${bugRefLink(l.id)}</span>
    </div>
  </div>`;

  const lessonColGroups = lessonEpicOrder.map((epicId, i) => {
    const ls = lessonsByEpic[epicId];
    const epic = data.epics.find(e => e.id === epicId);
    const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
    const label = epic ? `${epicId}: ${esc(epic.title)}` : (epicId === '_ungrouped' ? 'No Epic' : epicId);
    const leid = `lessons-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return `<tbody>
    <tr class="border-t-2 border-slate-300 dark:border-slate-600 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('${leid}','${leid}-arrow')">
      <td colspan="5" class="px-3 py-2">
        <span id="${leid}-arrow" class="text-slate-400 text-xs mr-2">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-2 text-xs text-slate-500">(${ls.length})</span>
      </td>
    </tr>
    </tbody><tbody id="${leid}" class="hidden">${ls.map(renderLessonRow).join('')}</tbody>`;
  }).join('');

  const lessonCardGroups = lessonEpicOrder.map((epicId, i) => {
    const ls = lessonsByEpic[epicId];
    const epic = data.epics.find(e => e.id === epicId);
    const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
    const label = epic ? `${epicId}: ${esc(epic.title)}` : (epicId === '_ungrouped' ? 'No Epic' : epicId);
    const lceid = `lessons-card-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return `<div class="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" style="border-left:4px solid ${accent.border}">
      <div class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('${lceid}','${lceid}-arrow')">
        <span id="${lceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-1 text-xs text-slate-500">(${ls.length})</span>
      </div>
      <div id="${lceid}" class="p-3 hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${ls.map(renderLessonCard).join('')}</div>
      </div>
    </div>`;
  }).join('');

  return `
  <div id="tab-lessons" class="p-6 hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-lessons">
    <div class="flex items-center justify-between mb-4 flex-shrink-0">
      <span class="text-sm text-slate-500 dark:text-slate-400">${lessons.length} lesson${lessons.length !== 1 ? 's' : ''}</span>
      <div class="flex gap-1">
        <button id="lessons-col-btn" onclick="setLessonsView('column')"
          class="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          ≡ Column
        </button>
        <button id="lessons-card-btn" onclick="setLessonsView('card')"
          class="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          ⊞ Card
        </button>
      </div>
    </div>

    <div id="lessons-column-view" class="scroll-table">
      <table class="w-full text-left text-sm border-collapse">
        <thead class="text-xs uppercase">
          <tr>
            <th class="px-3 py-2 whitespace-nowrap">ID</th>
            <th class="px-3 py-2">Rule</th>
            <th class="px-3 py-2">Context</th>
            <th class="px-3 py-2 whitespace-nowrap">Date</th>
            <th class="px-3 py-2 whitespace-nowrap">Bug Ref</th>
          </tr>
        </thead>
        ${lessonColGroups}
      </table>
    </div>

    <div id="lessons-card-view" class="hidden" style="overflow-y:auto">
      ${lessonCardGroups}
    </div>
  </div>
  <script>
  function setLessonsView(v) {
    var col = document.getElementById('lessons-column-view');
    var card = document.getElementById('lessons-card-view');
    var colBtn = document.getElementById('lessons-col-btn');
    var cardBtn = document.getElementById('lessons-card-btn');
    if (!col) return;
    col.classList.toggle('hidden', v !== 'column');
    card.classList.toggle('hidden', v !== 'card');
    colBtn.style.fontWeight = v === 'column' ? '700' : '';
    colBtn.style.background = v === 'column' ? 'rgba(59,130,246,0.1)' : '';
    cardBtn.style.fontWeight = v === 'card' ? '700' : '';
    cardBtn.style.background = v === 'card' ? 'rgba(59,130,246,0.1)' : '';
    localStorage.setItem('lessonsView', v);
  }
  (function() {
    var saved = localStorage.getItem('lessonsView') || 'column';
    setLessonsView(saved);
  })();
  </script>`;
}

function renderRecentActivity(data) {
  if (!data.recentActivity.length) return '';
  const items = data.recentActivity.map(a =>
    `<li class="py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span class="text-xs text-slate-500 block">Session ${a.sessionNum} &middot; ${a.date}</span>
      <span class="text-sm text-slate-700 dark:text-slate-200">${esc(a.summary)}</span>
    </li>`
  ).join('');
  return `
  <button id="activity-toggle" class="fixed top-4 right-4 z-50 block md:hidden bg-white dark:bg-slate-800 shadow rounded px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200" onclick="var p=document.getElementById('activity-panel'); p.classList.toggle('hidden');">&#8801; Activity</button>
  <div id="activity-panel" class="activity-panel fixed top-0 right-0 h-screen bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-lg flex flex-col hidden md:flex" style="width:280px;z-index:50;transition:width 0.25s ease">
    <div id="activity-expanded" class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
      <h4 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Recent Activity</h4>
      <div class="flex items-center gap-2">
        <button onclick="document.getElementById('activity-panel').classList.add('hidden')" class="md:hidden text-slate-400 hover:text-slate-700 leading-none px-1 text-base" title="Close" aria-label="Close activity panel">&times;</button>
        <button onclick="toggleActivityPanel()" class="hidden md:block text-slate-400 hover:text-slate-700 leading-none px-1" title="Collapse" aria-label="Collapse activity panel">&#9664;</button>
      </div>
    </div>
    <ul id="activity-list" class="flex-1 overflow-y-auto px-4 py-2">${items}</ul>
    <div id="activity-collapsed" class="hidden flex-col items-center pt-3 pb-4 gap-3">
      <button onclick="toggleActivityPanel()" class="text-slate-400 hover:text-slate-700 leading-none px-1" title="Expand" aria-label="Expand activity panel">&#9654;</button>
      <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide select-none" style="writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap">Recent Activity</span>
    </div>
  </div>`;
}

function renderScripts(data, options = {}) {
  const allData = JSON.stringify({ epics: data.epics, stories: data.stories });
  return `
  <script>
  const ALL_DATA = ${allData};

  const VALID_TABS = ['hierarchy','kanban','traceability','charts','trends','costs','bugs','lessons'];

  function downloadBudgetCSV() {
    const csv = ${JSON.stringify(options.budgetCSV || '')};
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget-report-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function updateFilterBar(name) {
    const bar = document.getElementById('filter-bar');
    const storyGrp = document.getElementById('fgrp-story');
    const bugGrp = document.getElementById('fgrp-bug');
    const showStory = name === 'hierarchy' || name === 'kanban';
    const showBug = name === 'bugs';
    bar.classList.toggle('hidden', !showStory && !showBug);
    storyGrp.classList.toggle('hidden', !showStory);
    bugGrp.classList.toggle('hidden', !showBug);
  }

  function showTab(name) {
    VALID_TABS.forEach(t => {
      const el = document.getElementById('tab-' + t);
      const btn = document.getElementById('tab-btn-' + t);
      if (el) el.classList.toggle('hidden', t !== name);
      if (btn) {
        btn.classList.toggle('nav-active', t === name);
        if (t === name) {
          btn.setAttribute('aria-current', 'page');
        } else {
          btn.removeAttribute('aria-current');
        }
      }
    });
    updateFilterBar(name);
    setStickyTop();
    if (name === 'charts' && typeof initCharts === 'function') { initCharts(); initCharts = () => {}; }
    if (name === 'trends' && typeof initTrendsCharts === 'function') { initTrendsCharts(); initTrendsCharts = () => {}; }
    localStorage.setItem('activeTab', name);
    history.replaceState(null, '', '#' + name);
  }

  function setHierarchyView(v) {
    document.getElementById('hier-column-view').classList.toggle('hidden', v !== 'column');
    document.getElementById('hier-card-view').classList.toggle('hidden', v !== 'card');
    document.getElementById('hier-col-btn').classList.toggle('active-view', v === 'column');
    document.getElementById('hier-card-btn').classList.toggle('active-view', v === 'card');
    localStorage.setItem('hierarchyView', v);
  }

  function toggleSection(contentId, arrowId) {
    var el = document.getElementById(contentId);
    var arr = document.getElementById(arrowId);
    if (!el) return;
    var hidden = el.classList.toggle('hidden');
    if (arr) arr.innerHTML = hidden ? '&#9654;' : '&#9660;';
  }
  function toggleEpic(id) { toggleSection('epic-stories-' + id, 'epic-arrow-' + id); }
  function toggleTraceEpic(epicId) {
    var rows = document.querySelectorAll('[data-trace-epic="' + epicId + '"]');
    var arrow = document.getElementById('trace-epic-' + epicId + '-arrow');
    if (!arrow) return;
    var collapsed = arrow.textContent === '\u25b6';
    rows.forEach(function(r) { r.classList.toggle('hidden', !collapsed); });
    arrow.textContent = collapsed ? '\u25bc' : '\u25b6';
  }
  function toggleKsw(id) {
    var body = document.getElementById(id + '-body');
    var arrow = document.getElementById(id + '-arrow');
    if (!body) return;
    var isCollapsed = body.classList.contains('hidden');
    body.classList.toggle('hidden', !isCollapsed);
    if (arrow) arrow.innerHTML = isCollapsed ? '&#9660;' : '&#9654;';
  }
  function toggleACs(id) {
    const el = document.getElementById('acs-' + id);
    if (el) el.classList.toggle('hidden');
  }
  function toggleCardACs(id) {
    const el = document.getElementById('card-acs-' + id);
    if (el) el.classList.toggle('hidden');
  }

  function applyFilters() {
    const epicEl = document.getElementById('f-epic');
    const statusEl = document.getElementById('f-status');
    const priorityEl = document.getElementById('f-priority');
    const bugStatusEl = document.getElementById('f-bug-status');
    const searchEl = document.getElementById('f-search');
    if (!epicEl || !statusEl || !priorityEl || !bugStatusEl || !searchEl) return;
    const epic = epicEl.value;
    const status = statusEl.value;
    const priority = priorityEl.value;
    const bugStatus = bugStatusEl.value;
    const search = searchEl.value.toLowerCase();
    document.querySelectorAll('.story-row').forEach(row => {
      const hide =
        (epic && row.dataset.epic !== epic) ||
        (status && row.dataset.status !== status) ||
        (priority && row.dataset.priority !== priority) ||
        (search && !row.innerText.toLowerCase().includes(search));
      row.style.display = hide ? 'none' : '';
    });
    document.querySelectorAll('.bug-row').forEach(row => {
      const rowEpic = row.dataset.epic || '_ungrouped';
      const hide =
        (epic && rowEpic !== epic) ||
        (bugStatus && row.dataset.status !== bugStatus) ||
        (search && !row.innerText.toLowerCase().includes(search));
      row.style.display = hide ? 'none' : '';
    });
    document.querySelectorAll('.epic-block').forEach(block => {
      const visibleChildren = block.querySelectorAll('.story-row:not([style*="display: none"])');
      const header = block.querySelector('div[onclick*="toggleSection"]');
      if (header) header.style.display = visibleChildren.length > 0 ? '' : 'none';
      block.style.display = visibleChildren.length > 0 ? '' : 'none';
      const wrapper = block.closest('.mb-8');
      if (wrapper) wrapper.style.display = visibleChildren.length > 0 ? '' : 'none';
    });
    document.querySelectorAll('.ksw-swimlane').forEach(swimlane => {
      const visibleChildren = swimlane.querySelectorAll('.story-row:not([style*="display: none"])');
      const header = swimlane.querySelector('.ksw-swim-hdr');
      if (header) header.style.display = visibleChildren.length > 0 ? '' : 'none';
    });
    document.querySelectorAll('.bug-epic-header').forEach(header => {
      const headerEpic = header.dataset.epic || '_ungrouped';
      const container = header.closest('tbody') || header.closest('.bug-epic-card');
      const visibleChildren = container ? container.querySelectorAll('.bug-row:not([style*="display: none"])') : [];
      header.style.display = visibleChildren.length > 0 ? '' : 'none';
      const countSpan = header.querySelector('.bug-count');
      if (countSpan) {
        countSpan.textContent = '(' + visibleChildren.length + ')';
      }
      if (container && container.tagName !== 'TR') {
        container.style.display = visibleChildren.length > 0 ? '' : 'none';
      }
    });
    localStorage.setItem('f-epic', epic);
    localStorage.setItem('f-status', status);
    localStorage.setItem('f-priority', priority);
    localStorage.setItem('f-bug-status', bugStatus);
    localStorage.setItem('f-search', searchEl.value);
  }

  function clearFilters() {
    ['f-epic','f-status','f-priority','f-bug-status'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const searchEl2 = document.getElementById('f-search');
    if (searchEl2) searchEl2.value = '';
    ['f-epic','f-status','f-priority','f-bug-status','f-search'].forEach(k => localStorage.removeItem(k));
    applyFilters();
  }

  function toggleActivityPanel() {
    const panel = document.getElementById('activity-panel');
    if (!panel || window.innerWidth < 768) return;
    const isCollapsed = panel.style.width === '40px';
    const expanded = document.getElementById('activity-expanded');
    const list = document.getElementById('activity-list');
    const collapsed = document.getElementById('activity-collapsed');
    const topbar = document.getElementById('topbar-fixed');
    if (isCollapsed) {
      panel.style.width = '280px';
      document.body.style.paddingRight = '';
      if (topbar) topbar.style.paddingRight = '';
      expanded.classList.remove('hidden');
      list.classList.remove('hidden');
      collapsed.classList.add('hidden');
      collapsed.classList.remove('flex');
      localStorage.setItem('activityPanelCollapsed', 'false');
    } else {
      panel.style.width = '40px';
      document.body.style.paddingRight = '40px';
      if (topbar) topbar.style.paddingRight = '40px';
      expanded.classList.add('hidden');
      list.classList.add('hidden');
      collapsed.classList.remove('hidden');
      collapsed.classList.add('flex');
      localStorage.setItem('activityPanelCollapsed', 'true');
    }
  }

  function initActivityPanel() {
    const panel = document.getElementById('activity-panel');
    if (!panel) return;
    document.body.style.transition = 'padding-right 0.25s ease';
    if (window.innerWidth >= 768 && localStorage.getItem('activityPanelCollapsed') === 'true') {
      panel.style.width = '40px';
      document.body.style.paddingRight = '40px';
      var topbarEl = document.getElementById('topbar-fixed');
      if (topbarEl) topbarEl.style.paddingRight = '40px';
      document.getElementById('activity-expanded').classList.add('hidden');
      document.getElementById('activity-list').classList.add('hidden');
      const collapsed = document.getElementById('activity-collapsed');
      collapsed.classList.remove('hidden');
      collapsed.classList.add('flex');
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    var icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = document.documentElement.classList.contains('dark') ? '\u2600' : '\u263e';

    initActivityPanel();

    // Restore active tab from URL hash or localStorage
    const hash = window.location.hash.replace('#', '');
    const savedTab = VALID_TABS.includes(hash) ? hash : (VALID_TABS.includes(localStorage.getItem('activeTab')) ? localStorage.getItem('activeTab') : 'hierarchy');
    showTab(savedTab);

    // Restore hierarchy view preference
    setHierarchyView(localStorage.getItem('hierarchyView') || 'column');

    // Restore filter state (bug status intentionally not restored — bug status changes between sessions)
    ['f-epic','f-status','f-priority'].forEach(id => {
      const el = document.getElementById(id);
      const val = localStorage.getItem(id);
      if (el && val) el.value = val;
    });
    const savedSearch = localStorage.getItem('f-search');
    if (savedSearch) document.getElementById('f-search').value = savedSearch;
    applyFilters();

    // Format generation timestamps in local timezone
    ['gen-time', 'about-gen-time'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var d = new Date(el.dataset.iso);
      el.textContent = d.toLocaleString(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });
    });

  });

  function setStickyTop() {
    var topbar = document.getElementById('topbar-fixed');
    var topbarFixed = topbar && getComputedStyle(topbar).position === 'fixed';
    var topbarH = topbarFixed ? (topbar.offsetHeight || 72) : 0;
    var filterBar = document.getElementById('filter-bar');
    var filterH = (filterBar && !filterBar.classList.contains('hidden')) ? filterBar.offsetHeight : 0;
    document.documentElement.style.setProperty('--sticky-top', (topbarH + filterH) + 'px');
  }
  document.addEventListener('DOMContentLoaded', setStickyTop);
  window.addEventListener('resize', setStickyTop);

  function toggleTheme() {
    var html = document.documentElement;
    var isDark = html.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    var icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = isDark ? '\u2600' : '\u263e';
    updateChartTheme();
  }

  function openAbout() {
    document.getElementById('aboutModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeAbout() {
    document.getElementById('aboutModal').classList.add('hidden');
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeAbout(); });
  </script>`;
}

function renderPrintCSS() {
  return `
  <style>
  /* === Theme tokens — all colours flow from here === */
  :root {
    --clr-body-bg:       #f1f5f9;
    --clr-topbar-bg:     #ffffff;
    --clr-sidebar-bg:    #f8fafc;
    --clr-panel-bg:      #ffffff;
    --clr-surface-raised:#e2e8f0;
    --clr-border:        #e2e8f0;
    --clr-border-mid:    #cbd5e1;
    --clr-text-primary:  #0f172a;
    --clr-text-secondary:#475569;
    --clr-text-muted:    #94a3b8;
    --clr-header-bg:     #e2e8f0;
    --clr-header-text:   #374151;
    --clr-input-bg:      #ffffff;
    --clr-input-border:  #d1d5db;
    --clr-input-text:    #1e293b;
    --clr-chart-text:    #475569;
    --clr-accent:        #7c3aed;
  }
  html.dark {
    --clr-body-bg:       #0b0d12;
    --clr-topbar-bg:     #0b0d12;
    --clr-sidebar-bg:    #111318;
    --clr-panel-bg:      #111318;
    --clr-surface-raised:#1a1d24;
    --clr-border:        #252831;
    --clr-border-mid:    #32363f;
    --clr-text-primary:  #dde1ea;
    --clr-text-secondary:#a0a8b8;
    --clr-text-muted:    #6b7385;
    --clr-header-bg:     #1a1d24;
    --clr-header-text:   #dde1ea;
    --clr-input-bg:      #1a1d24;
    --clr-input-border:  #32363f;
    --clr-input-text:    #dde1ea;
    --clr-chart-text:    #a0a8b8;
    --clr-accent:        #8b5cf6;
  }
  /* === Dark mode fallbacks === */
  html.dark body {
    background-color: var(--clr-body-bg);
    color: var(--clr-text-primary);
    background-image: radial-gradient(rgba(255,255,255,0.028) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  html.dark #topbar-fixed { border-color: rgba(0,80,179,0.5) !important; }
  html.dark #sidebar { border-color: var(--clr-border) !important; }
  html.dark #filter-bar { background-color: var(--clr-panel-bg) !important; border-color: var(--clr-border) !important; }
  html.dark #filter-bar select, html.dark #filter-bar input { background-color: var(--clr-input-bg) !important; border-color: var(--clr-input-border) !important; color: var(--clr-input-text) !important; }
  html.dark #filter-bar button { color: var(--clr-text-muted) !important; }
  html.dark .epic-block { border-color: var(--clr-border) !important; }
  html.dark .story-row { color: var(--clr-text-primary); }
  html.dark .story-row p { color: var(--clr-text-primary) !important; }
  html.dark #activity-panel { background-color: var(--clr-panel-bg) !important; border-color: var(--clr-border) !important; color: var(--clr-text-primary) !important; }
  html.dark #activity-panel li { border-color: var(--clr-border) !important; }
  /* === Hover transforms === */
  .story-card-hover { transition: transform 150ms ease, box-shadow 150ms ease; }
  .story-card-hover:hover { transform: scale(1.02); box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
  /* Tabs that should fill the full viewport height */
  .tab-fill { display: flex; flex-direction: column; height: calc(100vh - var(--sticky-top, 100px)); box-sizing: border-box; }
  .tab-fill .scroll-table { flex: 1; min-height: 0; max-height: none; }
  .scroll-table { overflow: auto; max-height: calc(100vh - var(--sticky-top, 100px) - 3rem); }
  .scroll-table thead th { position: sticky; top: 0; z-index: 10; background-color: var(--clr-header-bg); color: var(--clr-header-text); }
  /* Kanban: Epic swimlane grid */
  .ksw-outer { overflow: auto; height: calc(100vh - var(--sticky-top, 100px) - 1rem); padding: 16px; }
  .ksw-board { min-width: calc(160px + 5 * 200px); }
  .ksw-header-row, .ksw-swim-body { display: grid; grid-template-columns: 160px repeat(5, minmax(200px, 1fr)); }
  .ksw-status-cell { padding: 8px 10px; background: var(--clr-header-bg); color: var(--clr-header-text); border-bottom: 2px solid var(--clr-border); position: sticky; top: 0; z-index: 6; }
  .ksw-label-cell { padding: 8px 10px; }
  .ksw-header-row .ksw-label-cell { background: var(--clr-header-bg); border-bottom: 2px solid var(--clr-border); position: sticky; top: 0; z-index: 6; }
  .ksw-swimlane { border-left: 3px solid transparent; margin-bottom: 4px; }
  .ksw-swim-hdr { display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; background: var(--clr-surface); border-bottom: 1px solid var(--clr-border); user-select: none; }
  .ksw-swim-hdr:hover { filter: brightness(1.05); }
  .ksw-arrow { font-size: 10px; color: var(--clr-text-muted); flex-shrink: 0; }
  .ksw-epic-title { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ksw-epic-count { font-size: 11px; color: var(--clr-text-muted); flex-shrink: 0; }
  .ksw-cards-cell { padding: 8px 6px; border-right: 1px solid var(--clr-border); min-height: 40px; }
  html.dark .scroll-table table thead { background-color: transparent; }
  html.dark table tbody tr { border-color: var(--clr-border) !important; }
  html.dark .bg-white { background-color: var(--clr-panel-bg) !important; }
  html.dark .dark\\:bg-slate-800 { background-color: var(--clr-panel-bg) !important; }
  html.dark .dark\\:bg-slate-700 { background-color: var(--clr-surface-raised) !important; }
  html.dark .border-slate-200, html.dark .dark\\:border-slate-700, html.dark .dark\\:border-slate-600 { border-color: var(--clr-border) !important; }
  html.dark .text-slate-700, html.dark .text-slate-600 { color: var(--clr-text-primary) !important; }
  html.dark .text-slate-500 { color: var(--clr-text-muted) !important; }
  html.dark h3 { color: var(--clr-text-primary) !important; }
  @media print {
    #filter-bar, #sidebar, #topbar-fixed, .fixed, .activity-panel { display: none !important; }
    body { padding: 0 !important; }
    #app-shell { display: block !important; }
    #main-content { display: block !important; }
    #tab-hierarchy, #tab-costs { display: block !important; }
    #tab-kanban, #tab-traceability, #tab-charts, #tab-bugs, #tab-lessons { display: none !important; }
    body { font-size: 11pt; }
    .bg-slate-900 { background: white !important; color: black !important; }
    .text-white, .text-blue-400, .text-slate-400 { color: black !important; }
  }
  </style>`;
}

function renderHtml(data, options = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(data.projectName)} — Plan Status</title>
  <script>(function(){var t=localStorage.getItem('theme');if(t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark');}})()</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={darkMode:'class'}</script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    /* === Base === */
    body { font-family: 'Inter', sans-serif; padding-top: 72px; background-color: var(--clr-body-bg); color: var(--clr-text-primary); }
    body.has-alert { padding-top: 100px; }
    #topbar-fixed.has-alert { top: 28px; }
    #sidebar.has-alert { top: 100px; height: calc(100vh - 100px); }
    code, .font-mono { font-family: 'JetBrains Mono', monospace; }

    /* === Topbar (fixed, gradient) === */
    #topbar-fixed {
      position: fixed; top: 0; left: 0; right: 0; height: 72px; z-index: 40;
      background: linear-gradient(135deg, #003087 0%, #0050b3 50%, #0066cc 100%);
      border-bottom: 1px solid rgba(0,80,179,0.4);
      box-shadow: 0 2px 8px rgba(0,0,80,0.25); display: flex; align-items: center; padding: 0 16px;
    }
    .topbar-inner { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; }
    .topbar-project { flex: 1; min-width: 0; }
    .topbar-title { font-size: 1rem; font-weight: 700; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .topbar-tagline { font-size: 11px; color: rgba(255,255,255,0.72); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
    .topbar-btn { background: none; border: 1px solid rgba(255,255,255,0.35); color: rgba(255,255,255,0.8); border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; transition: color 150ms, border-color 150ms; }
    .topbar-btn:hover { color: #ffffff; border-color: rgba(255,255,255,0.65); }

    /* Glassmorphic stat tiles */
    .topbar-tiles { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .topbar-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 12px; border-radius: 8px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); min-width: 58px; }
    .tile-value { font-size: 15px; font-weight: 700; color: #ffffff; line-height: 1.25; white-space: nowrap; }
    .tile-label { font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.68); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; white-space: nowrap; }
    .tile-danger { color: #fca5a5 !important; }
    .tile-warn { color: #fde68a !important; }

    /* === App shell === */
    #app-shell { display: flex; min-height: calc(100vh - 72px); }

    /* === Sidebar === */
    #sidebar { width: 200px; flex-shrink: 0; position: sticky; top: 72px; height: calc(100vh - 72px); overflow-y: auto; background: var(--clr-sidebar-bg); border-right: 2px solid var(--clr-border); }
    #sidebar-nav { display: flex; flex-direction: column; padding: 8px 0; }
    .nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 16px; text-align: left; font-size: 13px; font-weight: 500; color: var(--clr-text-secondary); border: none; border-left: 3px solid transparent; border-bottom: 1px solid var(--clr-border); background: none; cursor: pointer; transition: color 150ms, background 150ms; }
    .nav-item:last-child { border-bottom: none; }
    .nav-item:hover { color: var(--clr-text-primary); background: rgba(139,92,246,0.08); }
    .nav-item.nav-active { color: var(--clr-accent); background: rgba(139,92,246,0.12); border-left-color: var(--clr-accent); font-weight: 600; }
    .nav-item svg { flex-shrink: 0; }
    .nav-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* === Main content === */
    #main-content { flex: 1; min-width: 0; }
    #filter-sticky { position: sticky; top: 72px; z-index: 20; }

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
  </style>
  ${renderPrintCSS()}
</head>
<body class="min-h-screen ${(data.budget && data.budget.crossedThresholds && data.budget.crossedThresholds.length > 0) ? 'has-alert' : ''}">
  ${(data.budget && data.budget.crossedThresholds && data.budget.crossedThresholds.length > 0) ? `
  <div id="budget-alert" class="fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-between ${data.budget.percentUsed >= 90 ? 'bg-red-600' : data.budget.percentUsed >= 75 ? 'bg-orange-500' : 'bg-amber-500'} text-white">
    <span class="font-medium">
      ${data.budget.percentUsed >= 90 ? '⛔' : '⚠️'} Budget Alert: ${data.budget.percentUsed}% of budget consumed
    </span>
    <button onclick="dismissBudgetAlert()" class="text-white hover:text-gray-200 text-sm font-bold px-2">✕</button>
  </div>
  <script>function dismissBudgetAlert(){document.getElementById('budget-alert').style.display='none';document.body.classList.remove('has-alert');localStorage.setItem('budgetAlertDismissed','${data.generatedAt}');}</script>
  ` : ''}
  ${renderTopBar(data)}
  <div id="app-shell">
    ${renderSidebar()}
    <main id="main-content" role="main">
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
  ${renderScripts(data, options)}
  <div id="aboutModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div onclick="closeAbout()" class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
      <button onclick="closeAbout()" class="absolute top-3 right-4 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xl leading-none" aria-label="Close">&#x2715;</button>
      <h2 class="text-2xl font-bold mb-1" style="color:var(--clr-accent)">${esc(data.projectName)}</h2>
      <p class="text-slate-500 dark:text-slate-400 text-sm mb-4">${esc(data.tagline)}</p>
      <a href="${/^https?:\/\//.test(data.githubUrl || '') ? esc(data.githubUrl) : ''}" target="_blank" rel="noopener noreferrer"
         class="inline-flex items-center gap-1.5 text-sm underline underline-offset-2 mb-5" style="color:var(--clr-accent)">
        GitHub Repository
      </a>
      <div class="border-t border-slate-200 dark:border-slate-700 pt-4 text-slate-500 text-xs space-y-1.5">
        <p>Version <span class="text-slate-700 dark:text-slate-300 font-mono">v${esc(data.version)}</span></p>
        <p>Build <span class="text-slate-700 dark:text-slate-300 font-mono">#${esc(data.buildNumber)}</span>&nbsp;<code class="text-slate-500 dark:text-slate-600">${esc(data.commitSha)}</code></p>
        <p>Updated <span id="about-gen-time" data-iso="${data.generatedAt}" class="text-slate-700 dark:text-slate-300"></span></p>
      </div>
      <p class="mt-5 text-slate-500 text-xs">Implemented by Kamal Syed, 2026</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderHtml };
