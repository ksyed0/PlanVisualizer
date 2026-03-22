'use strict';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

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
  return `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}">${text}</span>`;
}

function usd(n) {
  const num = Number(n);
  if (num >= 1000) return '$' + Math.round(num).toLocaleString('en-US');
  if (num > 0) return '$' + num.toFixed(2);
  return '$0.00';
}
function fmtNum(n) { return Number(n).toLocaleString(); }

function renderTopBar(data) {
  const storyProjected = data.stories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);
  const bugProjected = Object.entries(data.costs._bugs || {})
    .filter(([k]) => k !== '_totals')
    .reduce((s, [, v]) => s + (v.projectedUsd || 0), 0);
  const totalProjected = storyProjected + bugProjected;
  const bugAI = Object.entries(data.costs._bugs || {})
    .filter(([k, v]) => k !== '_totals' && v && !v.isEstimated)
    .reduce((s, [, v]) => s + (v.costUsd || 0), 0);
  const totalAI = (data.costs._totals.costUsd || 0) + bugAI;
  const done = data.stories.filter(s => s.status === 'Done').length;
  const inProgress = data.stories.filter(s => s.status === 'In Progress').length;
  const pct = data.stories.length ? Math.round((done / data.stories.length) * 100) : 0;
  const cov = data.coverage;
  const covLabel = (cov.available !== false) ? `${cov.overall.toFixed(1)}%` : 'N/A';
  const covClass = (cov.available !== false) ? (cov.meetsTarget ? 'text-green-400' : 'text-red-400') : 'text-slate-500';
  const branchSubtitle = (cov.available !== false) ? `Branches: ${Number(cov.branches).toFixed(1)}%` : 'N/A';
  const genAt = data.generatedAt;
  return `
  <div class="text-white px-6 py-5 shadow-xl" id="top-bar"
       style="background:linear-gradient(135deg,#003087 0%,#005EB8 55%,#0078C8 100%);backdrop-filter:blur(0px)">
    <div class="flex flex-wrap gap-4 items-start justify-between">
      <div class="min-w-0">
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-4xl font-black text-white tracking-tight topbar-title" style="text-shadow:0 2px 6px rgba(0,0,0,.4)">${esc(data.projectName)}</h1>
          <button onclick="openAbout()" class="text-xs text-blue-100 border border-white/30 rounded px-2 py-0.5 hover:bg-white/15 hover:text-white transition-colors flex-shrink-0 backdrop-blur-sm">About</button>
          <button onclick="toggleTheme()" id="theme-toggle" class="text-xs text-blue-100 border border-white/30 rounded px-2 py-0.5 hover:bg-white/15 hover:text-white transition-colors flex-shrink-0 backdrop-blur-sm" aria-label="Toggle dark/light mode"><span id="theme-icon">☀</span></button>
        </div>
        <p class="text-blue-100/80 text-sm mt-0.5 topbar-tagline">${esc(data.tagline)}&nbsp;·&nbsp;Updated <span id="gen-time" data-iso="${genAt}"></span>&nbsp;·&nbsp;<code class="text-blue-200/60 text-xs">${data.commitSha}</code></p>
        <div class="mt-2.5 flex items-center gap-2 topbar-progress">
          <div class="rounded-full h-2 w-40 overflow-hidden" style="background:rgba(255,255,255,0.2)">
            <div class="h-2 rounded-full" style="width:${pct}%;background:rgba(255,255,255,0.85)"></div>
          </div>
          <span class="text-xs text-blue-100/80">${done}/${data.stories.length} &middot; ${pct}%${inProgress ? ` &middot; ${inProgress} active` : ''}</span>
        </div>
      </div>
      <div class="flex gap-3 flex-wrap topbar-stats">
        <div class="rounded-xl px-4 py-3 text-center min-w-[80px] topbar-tile" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);backdrop-filter:blur(8px)">
          <div class="text-xl font-bold text-white topbar-tile-num">${usd(totalProjected)}</div>
          <div class="text-xs mt-0.5" style="color:rgba(255,255,255,0.65)">Projected</div>
        </div>
        <div class="rounded-xl px-4 py-3 text-center min-w-[80px] topbar-tile" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);backdrop-filter:blur(8px)">
          <div class="text-xl font-bold text-white topbar-tile-num">${usd(totalAI)}</div>
          <div class="text-xs mt-0.5" style="color:rgba(255,255,255,0.65)">AI Actual</div>
        </div>
        <div class="rounded-xl px-4 py-3 text-center min-w-[80px] topbar-tile" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.22);backdrop-filter:blur(8px)" aria-label="Coverage: ${covLabel} overall, ${branchSubtitle}">
          <div class="text-2xl font-bold topbar-tile-num" style="color:${(cov.available !== false) ? (cov.meetsTarget ? '#6EE7B7' : '#FCA5A5') : 'rgba(255,255,255,0.5)'}">${covLabel}</div>
          <div class="text-xs mt-0.5" style="color:rgba(255,255,255,0.65)">${branchSubtitle}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderFilterBar(data) {
  const epicOptions = data.epics.map(e =>
    `<option value="${esc(e.id)}">${esc(e.id)}: ${esc(e.title)}</option>`).join('');
  const sel = 'border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:bg-slate-700 dark:text-slate-100';
  return `
  <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-2 flex flex-wrap gap-2 items-center hidden" id="filter-bar">
    <span id="fgrp-story" class="hidden flex-wrap gap-2 flex">
      <select id="f-epic" onchange="applyFilters()" class="${sel}">
        <option value="">All Epics</option>${epicOptions}
      </select>
      <select id="f-status" onchange="applyFilters()" class="${sel}">
        <option value="">All Statuses</option>
        <option>In Progress</option><option>Planned</option><option>Done</option><option>Blocked</option>
      </select>
      <select id="f-priority" onchange="applyFilters()" class="${sel}">
        <option value="">All Priorities</option>
        <option>P0</option><option>P1</option><option>P2</option>
      </select>
    </span>
    <span id="fgrp-bug" class="hidden flex-wrap gap-2 flex">
      <select id="f-bug-status" onchange="applyFilters()" class="${sel}">
        <option value="">All Statuses</option>
        <option>Open</option><option>In Progress</option><option>Fixed</option>
      </select>
    </span>
    <input id="f-search" oninput="applyFilters()" type="text" placeholder="Search IDs, titles…"
      class="${sel} w-full sm:w-48 dark:placeholder-slate-400" />
    <button onclick="clearFilters()" class="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline">Clear</button>
  </div>`;
}

function renderTabs() {
  const tabs = ['Hierarchy','Kanban','Traceability','Charts','Costs','Bugs','Lessons'];
  return `
  <div class="border-b border-slate-700 bg-slate-800 px-4 py-2 flex gap-1 overflow-x-auto" id="tab-bar">
    ${tabs.map((t, i) => `
    <button onclick="showTab('${t.toLowerCase()}')" id="tab-btn-${t.toLowerCase()}"
      class="px-3 py-1.5 text-xs font-semibold rounded-md flex-shrink-0 transition-colors ${i===0 ? 'tab-active' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}">
      ${t}
    </button>`).join('')}
  </div>`;
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
        <div class="flex flex-wrap items-center gap-2 cursor-pointer" onclick="toggleACs('${story.id}')">
          <span class="font-mono text-xs text-slate-500 whitespace-nowrap">${story.id}</span>
          ${badge(story.status)} ${badge(story.priority)}
          <span class="text-sm font-medium">${esc(story.title)}</span>
          ${riskBadge}
          <span class="ml-auto text-xs text-slate-500">${story.estimate || '?'} · ${usd(data.costs[story.id] && data.costs[story.id].projectedUsd || 0)}</span>
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
        <div class="flex flex-wrap items-center gap-1 cursor-pointer" onclick="toggleCardACs('${story.id}')">
          ${badge(story.status)} ${badge(story.priority)}
          <span class="font-mono text-xs text-slate-500 ml-1">${story.id}</span>
        </div>
        <p class="text-sm font-medium dark:text-slate-100 leading-snug cursor-pointer" onclick="toggleCardACs('${story.id}')">${esc(story.title)}</p>
        <div class="flex items-center gap-2 mt-auto pt-1 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-600">
          <span>${story.estimate || '?'}</span>
          <span>${cost}</span>
          ${acTotal ? `<span class="cursor-pointer" onclick="toggleCardACs('${story.id}')">${acDone}/${acTotal} ACs ▾</span>` : ''}
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
      <div class="px-4 py-3 flex flex-wrap items-center gap-3 cursor-pointer" style="background:${accent.bg}" onclick="toggleEpic('${epic.id}')">
        <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epic.id}</span>
        ${badge(epic.status)}
        <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
        <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
        <span class="ml-auto text-sm text-slate-500">${usd(epicProjected)} projected</span>
      </div>
      <div id="epic-stories-${epic.id}">${storyRows || '<p class="text-slate-500 dark:text-slate-400 text-sm px-4 py-2">No stories yet.</p>'}</div>
    </div>`).join('');

  const cardView = epicBlocks.map(({ accent, storyCards, epicHeader }) => `
    <div class="mb-8">
      <div class="epic-block border border-slate-200 dark:border-slate-700 rounded-t-lg px-4 py-3 mb-0" style="border-left:4px solid ${accent.border};background:${accent.bg}">
        ${epicHeader}
      </div>
      <div class="border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-lg p-3">
        ${storyCards
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">${storyCards}</div>`
          : '<p class="text-slate-500 dark:text-slate-400 text-sm">No stories yet.</p>'}
      </div>
    </div>`).join('');

  return `
  <div id="tab-hierarchy" class="p-6">
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
  const colHtml = cols.map(col => {
    const items = data.stories.filter(s =>
      col === 'Planned' ? s.status === 'Planned' :
      col === 'To Do' ? s.status === 'To Do' : s.status === col
    );
    return `
    <div class="kanban-col flex flex-col flex-1 min-w-48">
      <h3 class="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 pb-1 border-b border-slate-200 dark:border-slate-600 flex-shrink-0">${col} <span class="font-normal opacity-60">(${items.length})</span></h3>
      <div class="kanban-col-body flex-1 overflow-y-auto">
        ${items.map(s => `
        <div class="story-row story-card-hover bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded p-3 mb-2"
             data-epic="${s.epicId}" data-status="${s.status}" data-priority="${s.priority}">
          <div class="flex gap-1 mb-1">${badge(s.priority)} <span class="text-xs text-slate-500">${s.id}</span></div>
          <p class="text-sm dark:text-slate-100">${esc(s.title)}</p>
          <p class="text-xs text-slate-500 mt-1">${s.epicId} · ${s.estimate || '?'}</p>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
  return `<div id="tab-kanban" class="p-6 hidden tab-fill"><div class="flex gap-4 min-h-0 flex-1 overflow-x-auto">${colHtml}</div></div>`;
}

function renderTraceabilityTab(data) {
  if (!data.testCases.length) {
    return `<div id="tab-traceability" class="p-6 hidden"><p class="text-slate-500">No test cases yet.</p></div>`;
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
    const epicTCs = epicStories.flatMap(s => data.testCases.filter(tc => tc.relatedStory === s.id));
    const hasFail = epicTCs.some(tc => tc.status === 'Fail');
    const hasNotRun = !hasFail && epicTCs.some(tc => tc.status === 'Not Run');
    const epicRowBg = hasFail ? 'bg-red-50 dark:bg-red-900/20' : hasNotRun ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-100 dark:bg-slate-700';
    const epicStatusBadge = hasFail
      ? ' <span class="ml-2 inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Fail</span>'
      : hasNotRun
      ? ' <span class="ml-2 inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Not Run</span>'
      : '';
    const epicHeader = `<tr class="${epicRowBg} cursor-pointer select-none"
      onclick="(function(){var rows=document.querySelectorAll('[data-trace-epic=\\'${epic.id}\\']');var arr=document.getElementById('${epicRowId}-arrow');var collapsed=arr.textContent==='\\u25b6';rows.forEach(function(r){r.classList.toggle('hidden',!collapsed);});arr.textContent=collapsed?'\\u25bc':'\\u25b6';})()" >
      <td colspan="${data.testCases.length + 1}" class="px-2 py-1 text-xs font-semibold" style="color:var(--clr-accent)">
        <span id="${epicRowId}-arrow" class="mr-1 text-slate-400">&#9654;</span>
        ${epic.id} \u2014 ${esc(epic.title)}${epicStatusBadge}
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
  <div id="tab-traceability" class="p-6 hidden tab-fill">
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
  const coveragePct = data.coverage.overall.toFixed(1);
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
  <div id="tab-charts" class="p-6 hidden">
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
              <div class="text-2xl font-bold text-slate-700 dark:text-slate-200">${coveragePct}%</div>
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
      data: { labels: ['Covered', 'Gap'], datasets: [{ data: [${coveragePct}, ${100 - parseFloat(coveragePct)}], backgroundColor: ['#22c55e','#cbd5e1'], borderWidth: 0 }] },
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

function renderCostsTab(data) {
  const t = data.costs._totals;
  const totalProjected = data.stories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);

  // ── Column view: stories table ──────────────────────────────────────────
  const epicBlocks = data.epics.map(epic => {
    const epicStories = data.stories.filter(s => s.epicId === epic.id);
    const epicProjected = epicStories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);
    const epicAI = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).costUsd || 0), 0);
    const epicIn = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).inputTokens || 0), 0);
    const epicOut = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).outputTokens || 0), 0);
    const storyRows = epicStories.map(story => {
      const projected = (data.costs[story.id] && data.costs[story.id].projectedUsd || 0);
      const ai = data.costs[story.id] || {};
      return `<tr class="border-t border-slate-100 dark:border-slate-700">
        <td class="px-3 py-2 pl-8 font-mono text-xs text-slate-500 whitespace-nowrap">${story.id}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(story.title)}</td>
        <td class="px-3 py-2 text-center">${badge(story.status)}</td>
        <td class="px-3 py-2 text-center text-sm dark:text-slate-200">${story.estimate || '?'}</td>
        <td class="px-3 py-2 text-right text-sm dark:text-slate-200">${usd(projected)}</td>
        <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${usd(ai.costUsd || 0)}</td>
        <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(ai.inputTokens || 0)} / ${fmtNum(ai.outputTokens || 0)}</td>
      </tr>`;
    }).join('');
    return `
    <tr class="bg-slate-50 dark:bg-slate-700 border-t-2 border-slate-300 dark:border-slate-600">
      <td colspan="4" class="px-3 py-2">
        <span class="font-mono text-xs font-bold text-blue-600">${epic.id}</span>
        <span class="text-sm font-semibold ml-2 text-slate-700 dark:text-slate-200">${esc(epic.title)}</span>
        <span class="ml-2">${badge(epic.status)}</span>
      </td>
      <td class="px-3 py-2 text-right text-sm font-medium dark:text-slate-200">${usd(epicProjected)}</td>
      <td class="px-3 py-2 text-right text-sm font-medium text-teal-700 dark:text-teal-400">${usd(epicAI)}</td>
      <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(epicIn)} / ${fmtNum(epicOut)}</td>
    </tr>
    ${storyRows}`;
  }).join('');

  // ── Bug cost helpers (shared by column + card) ──────────────────────────
  const allBugCosts = data.bugs.map(b => (data.costs._bugs && data.costs._bugs[b.id]) || { costUsd: 0, inputTokens: 0, outputTokens: 0 });
  const bugTotalAI        = allBugCosts.reduce((s, bc) => s + (bc.isEstimated ? 0 : (bc.costUsd || 0)), 0);
  const bugTotalProjected = allBugCosts.reduce((s, bc) => s + (bc.projectedUsd || 0), 0);
  const bugTotalIn        = allBugCosts.reduce((s, bc) => s + (bc.isEstimated ? 0 : (bc.inputTokens || 0)), 0);
  const bugTotalOut       = allBugCosts.reduce((s, bc) => s + (bc.isEstimated ? 0 : (bc.outputTokens || 0)), 0);

  // ── Column view: bug rows ────────────────────────────────────────────────
  const bugColRows = data.bugs.map(bug => {
    const bc = (data.costs._bugs && data.costs._bugs[bug.id]) || { costUsd: 0, inputTokens: 0, outputTokens: 0 };
    return `<tr class="border-t border-slate-100 dark:border-slate-700">
      <td class="px-3 py-2 font-mono text-xs text-slate-500 whitespace-nowrap">${esc(bug.id)}</td>
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
          <span class="ml-auto text-xs text-slate-400">${story.estimate || '?'}</span>
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
    return `<div class="mb-6">
      <div class="flex items-center gap-2 mb-3 flex-wrap">
        <span class="font-mono text-xs font-bold text-blue-600">${epic.id}</span>
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${esc(epic.title)}</span>
        ${badge(epic.status)}
        <span class="ml-auto text-xs text-slate-500">Proj ${usd(epicProjTotal)} · AI ${usd(epicAITotal)}</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${storyCards}</div>
    </div>`;
  }).join('');

  // ── Card view: bug cards ─────────────────────────────────────────────────
  const bugCards = data.bugs.map(bug => {
    const bc = (data.costs._bugs && data.costs._bugs[bug.id]) || {};
    return `<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-mono text-xs text-slate-500 whitespace-nowrap">${esc(bug.id)}</span>
        ${badge(bug.severity)} ${badge(bug.status)}
      </div>
      <p class="text-sm font-medium dark:text-slate-200">${esc(bug.title)}</p>
      <div class="text-xs text-slate-500">
        Story: <span class="font-mono">${esc(bug.relatedStory || '—')}</span>
      </div>
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
      <tbody>${bugColRows}</tbody>
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
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${bugCards}</div>` : '';

  return `
  <div id="tab-costs" class="p-6 hidden tab-fill">
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
            <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${usd(t.costUsd)}</td>
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
    return `<div id="tab-bugs" class="p-6 hidden"><p class="text-slate-500">No bugs logged yet.</p></div>`;
  }

  const lessonCell = (bug) => {
    if (!bug.lessonEncoded || !bug.lessonEncoded.startsWith('Yes')) return '○';
    const lm = bug.lessonEncoded.match(/L-\d{4}/);
    if (!lm) return '✓';
    return `<a href="#" onclick="showTab('lessons');setTimeout(function(){var el=document.getElementById('lesson-${lm[0]}');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},50);return false;" class="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs whitespace-nowrap" title="View lesson ${lm[0]}">✓ ${lm[0]} ↗</a>`;
  };

  const rows = data.bugs.map(bug => `
  <tr id="bug-row-${bug.id}" class="bug-row border-t border-slate-100 dark:border-slate-700" data-status="${bug.status}">
    <td class="px-3 py-2 font-mono text-xs whitespace-nowrap dark:text-slate-200">${bug.id}</td>
    <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(bug.title)}</td>
    <td class="px-3 py-2 text-center">${badge(bug.severity)}</td>
    <td class="px-3 py-2 text-center">${badge(bug.status)}</td>
    <td class="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">${esc(bug.relatedStory)}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.fixBranch || '—')}</td>
    <td class="px-3 py-2 text-center text-xs dark:text-slate-200">${lessonCell(bug)}</td>
  </tr>`).join('');

  const cards = data.bugs.map(bug => `
  <div id="bug-card-${bug.id}" class="bug-row bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col gap-2" data-status="${bug.status}">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="font-mono text-xs text-slate-500 whitespace-nowrap">${bug.id}</span>
      ${badge(bug.severity)} ${badge(bug.status)}
    </div>
    <p class="text-sm font-medium dark:text-slate-200">${esc(bug.title)}</p>
    <div class="text-xs text-slate-500 flex flex-col gap-0.5">
      <span>Story: <span class="font-mono">${esc(bug.relatedStory || '—')}</span></span>
      <span class="truncate" title="${esc(bug.fixBranch || '')}">Branch: <span class="font-mono">${esc(bug.fixBranch || '—')}</span></span>
    </div>
    <div class="flex items-center justify-between mt-1">
      <span class="text-xs text-slate-500">Lesson: <span class="dark:text-slate-200">${lessonCell(bug)}</span></span>
    </div>
  </div>`).join('');

  return `
  <div id="tab-bugs" class="p-6 hidden tab-fill">
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
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div id="bugs-card-view" class="hidden grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style="overflow-y:auto">
      ${cards}
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
    return `<div id="tab-lessons" class="p-6 hidden"><p class="text-slate-500">No lessons logged yet.</p></div>`;
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

  const colRows = lessons.map(l => `
  <tr id="lesson-${l.id}" class="border-t border-slate-100 dark:border-slate-700 align-top">
    <td class="px-3 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">${l.id}</td>
    <td class="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">${esc(l.rule)}</td>
    <td class="px-3 py-3 text-sm text-slate-500 dark:text-slate-400 italic">${esc(l.context)}</td>
    <td class="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">${l.date ? l.date.slice(0, 7) : '—'}</td>
    <td class="px-3 py-3 text-xs whitespace-nowrap">${bugRefLink(l.id)}</td>
  </tr>`).join('');

  const cards = lessons.map(l => `
  <div id="lesson-${l.id}" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col gap-2">
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
  </div>`).join('');

  return `
  <div id="tab-lessons" class="p-6 hidden tab-fill">
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
        <tbody>${colRows}</tbody>
      </table>
    </div>

    <div id="lessons-card-view" class="hidden grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      ${cards}
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

function renderScripts(data) {
  const allData = JSON.stringify({ epics: data.epics, stories: data.stories });
  return `
  <script>
  const ALL_DATA = ${allData};

  const VALID_TABS = ['hierarchy','kanban','traceability','charts','costs','bugs','lessons'];

  function updateFilterBar(name) {
    const bar = document.getElementById('filter-bar');
    const storyGrp = document.getElementById('fgrp-story');
    const bugGrp = document.getElementById('fgrp-bug');
    const typeGrp = document.getElementById('fgrp-type');
    const showStory = name === 'hierarchy' || name === 'kanban';
    const showBug = name === 'bugs';
    bar.classList.toggle('hidden', !showStory && !showBug);
    storyGrp.classList.toggle('hidden', !showStory);
    bugGrp.classList.toggle('hidden', !showBug);
    if (typeGrp) typeGrp.classList.toggle('hidden', name !== 'hierarchy');
  }

  function showTab(name) {
    VALID_TABS.forEach(t => {
      const el = document.getElementById('tab-' + t);
      const btn = document.getElementById('tab-btn-' + t);
      if (el) el.classList.toggle('hidden', t !== name);
      if (btn) {
        btn.classList.toggle('tab-active', t === name);
        btn.classList.toggle('text-slate-400', t !== name);
        btn.classList.toggle('hover:text-slate-200', t !== name);
        btn.classList.toggle('hover:bg-white\\/5', t !== name);
      }
    });
    updateFilterBar(name);
    setStickyTop();
    if (name === 'charts' && typeof initCharts === 'function') { initCharts(); initCharts = () => {}; }
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

  function toggleEpic(id) {
    const el = document.getElementById('epic-stories-' + id);
    if (el) el.classList.toggle('hidden');
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
    const epic = document.getElementById('f-epic').value;
    const status = document.getElementById('f-status').value;
    const priority = document.getElementById('f-priority').value;
    const bugStatus = document.getElementById('f-bug-status').value;
    const search = document.getElementById('f-search').value.toLowerCase();
    document.querySelectorAll('.story-row').forEach(row => {
      const hide =
        (epic && row.dataset.epic !== epic) ||
        (status && row.dataset.status !== status) ||
        (priority && row.dataset.priority !== priority) ||
        (search && !row.innerText.toLowerCase().includes(search));
      row.style.display = hide ? 'none' : '';
    });
    document.querySelectorAll('.bug-row').forEach(row => {
      const hide =
        (bugStatus && row.dataset.status !== bugStatus) ||
        (search && !row.innerText.toLowerCase().includes(search));
      row.style.display = hide ? 'none' : '';
    });
    localStorage.setItem('f-epic', epic);
    localStorage.setItem('f-status', status);
    localStorage.setItem('f-priority', priority);
    localStorage.setItem('f-bug-status', bugStatus);
    localStorage.setItem('f-search', document.getElementById('f-search').value);
  }

  function clearFilters() {
    ['f-epic','f-status','f-priority','f-bug-status'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-search').value = '';
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
    if (isCollapsed) {
      panel.style.width = '280px';
      document.body.style.paddingRight = '';
      expanded.classList.remove('hidden');
      list.classList.remove('hidden');
      collapsed.classList.add('hidden');
      collapsed.classList.remove('flex');
      localStorage.setItem('activityPanelCollapsed', 'false');
    } else {
      panel.style.width = '40px';
      document.body.style.paddingRight = '40px';
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

    // Restore filter state
    ['f-epic','f-status','f-priority','f-bug-status'].forEach(id => {
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
    var nav = document.getElementById('sticky-nav');
    if (nav) document.documentElement.style.setProperty('--sticky-top', nav.offsetHeight + 'px');
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
    --clr-body-bg:       #ffffff;
    --clr-panel-bg:      #ffffff;
    --clr-surface-raised:#e2e8f0;
    --clr-border:        #e2e8f0;
    --clr-border-mid:    #cbd5e1;
    --clr-text-primary:  #1e293b;
    --clr-text-secondary:#475569;
    --clr-text-muted:    #64748b;
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
  html.dark #top-bar { background: linear-gradient(135deg, #1a0533 0%, #2d0d52 55%, #3b1270 100%) !important; }
  html.dark #filter-bar { background-color: var(--clr-panel-bg) !important; border-color: var(--clr-border) !important; }
  html.dark #filter-bar select, html.dark #filter-bar input { background-color: var(--clr-input-bg) !important; border-color: var(--clr-input-border) !important; color: var(--clr-input-text) !important; }
  html.dark #filter-bar button { color: var(--clr-text-muted) !important; }
  html.dark #tab-bar { background-color: var(--clr-panel-bg) !important; border-color: var(--clr-border) !important; }
  html.dark #tab-bar button { color: var(--clr-text-muted) !important; }
  html.dark #tab-bar button.tab-active { background-color: var(--clr-accent) !important; color: #fff !important; }
  html.dark .epic-block { border-color: var(--clr-border) !important; }
  html.dark .story-row { color: var(--clr-text-primary); }
  html.dark .story-row p { color: var(--clr-text-primary) !important; }
  html.dark #activity-panel { background-color: var(--clr-panel-bg) !important; border-color: var(--clr-border) !important; color: var(--clr-text-primary) !important; }
  html.dark #activity-panel li { border-color: var(--clr-border) !important; }
  /* === Tab pill active state === */
  #tab-bar button.tab-active { background-color: var(--clr-accent); color: #fff; border-radius: 6px; }
  /* === Hover transforms === */
  .story-card-hover { transition: transform 150ms ease, box-shadow 150ms ease; }
  .story-card-hover:hover { transform: scale(1.02); box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
  .topbar-tile { transition: transform 150ms ease; }
  .topbar-tile:hover { transform: translateY(-2px); }
  /* Tabs that should fill the full viewport height */
  .tab-fill { display: flex; flex-direction: column; height: calc(100vh - var(--sticky-top, 120px)); box-sizing: border-box; }
  .tab-fill .scroll-table { flex: 1; min-height: 0; max-height: none; }
  .scroll-table { overflow: auto; max-height: calc(100vh - var(--sticky-top, 120px) - 3rem); }
  .scroll-table thead th { position: sticky; top: 0; z-index: 10; background-color: var(--clr-header-bg); color: var(--clr-header-text); }
  .scroll-kanban { overflow: auto; height: calc(100vh - var(--sticky-top, 120px) - 3rem); }
  .scroll-kanban .kanban-col-header { position: sticky; top: 0; z-index: 5; background: var(--clr-header-bg); color: var(--clr-header-text); padding-bottom: 6px; }
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
    #filter-bar, #tab-bar, .fixed, .activity-panel { display: none !important; }
    body { padding-right: 0 !important; }
    #tab-hierarchy, #tab-costs { display: block !important; }
    #tab-kanban, #tab-traceability, #tab-charts, #tab-bugs, #tab-lessons { display: none !important; }
    body { font-size: 11pt; }
    .bg-slate-900 { background: white !important; color: black !important; }
    .text-white, .text-blue-400, .text-slate-400 { color: black !important; }
  }
  </style>`;
}

function renderHtml(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(data.projectName)} — Plan Status</title>
  <script>window.tailwind={config:{darkMode:'class'}}</script>
  <script>(function(){var t=localStorage.getItem('theme');if(t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark');}})()</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={darkMode:'class'}</script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    code, .font-mono { font-family: 'JetBrains Mono', monospace; }
    @media (min-width: 768px) { body { padding-right: 280px; } }
    @media (max-width: 767px) {
      #top-bar { padding: 8px 12px !important; }
      .topbar-title { font-size: 1.35rem !important; line-height: 1.3 !important; }
      .topbar-tagline { font-size: 0.65rem !important; margin-top: 1px !important; line-height: 1.3 !important; }
      .topbar-progress { margin-top: 4px !important; }
      .topbar-stats { gap: 4px !important; flex-wrap: nowrap !important; overflow-x: auto !important; padding-bottom: 2px; }
      .topbar-tile { padding: 3px 6px !important; min-width: 50px !important; border-radius: 8px !important; }
      .topbar-tile-num { font-size: 0.8rem !important; line-height: 1.2 !important; }
      .topbar-tile .text-xs { font-size: 0.6rem !important; margin-top: 1px !important; }
      #filter-bar { padding: 4px 12px !important; gap: 4px !important; }
      #filter-bar select, #filter-bar input[type="text"] { padding: 2px 4px !important; font-size: 0.7rem !important; }
      #filter-bar button { font-size: 0.7rem !important; }
      #tab-bar button { padding: 5px 10px !important; font-size: 0.72rem !important; }
      .tokens-col { display: none !important; }
    }
  </style>
  ${renderPrintCSS()}
</head>
<body class="min-h-screen" style="background-color:var(--clr-body-bg);color:var(--clr-text-primary)">
  <div id="sticky-nav" class="sticky top-0 z-30">
    ${renderTopBar(data)}
    ${renderTabs()}
    ${renderFilterBar(data)}
  </div>
  <div id="tab-content">
    ${renderHierarchyTab(data)}
    ${renderKanbanTab(data)}
    ${renderTraceabilityTab(data)}
    ${renderChartsTab(data)}
    ${renderCostsTab(data)}
    ${renderBugsTab(data)}
    ${renderLessonsTab(data)}
  </div>
  ${renderRecentActivity(data)}
  ${renderScripts(data)}
  <div id="aboutModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div onclick="closeAbout()" class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
      <button onclick="closeAbout()" class="absolute top-3 right-4 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xl leading-none" aria-label="Close">&#x2715;</button>
      <h2 class="text-2xl font-bold mb-1" style="color:var(--clr-accent)">${esc(data.projectName)}</h2>
      <p class="text-slate-500 dark:text-slate-400 text-sm mb-4">${esc(data.tagline)}</p>
      <a href="${esc(data.githubUrl)}" target="_blank" rel="noopener noreferrer"
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
