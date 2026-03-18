'use strict';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function badge(text) {
  const colors = {
    'In Progress': 'bg-blue-100 text-blue-800',
    'Planned': 'bg-gray-100 text-gray-700',
    'Done': 'bg-green-100 text-green-800',
    'Blocked': 'bg-red-100 text-red-800',
    'To Do': 'bg-yellow-100 text-yellow-800',
    'P0': 'bg-red-100 text-red-700',
    'P1': 'bg-orange-100 text-orange-700',
    'P2': 'bg-gray-100 text-gray-600',
    'Pass': 'bg-green-100 text-green-800',
    'Fail': 'bg-red-100 text-red-800',
    'Not Run': 'bg-gray-100 text-gray-600',
    'Open': 'bg-red-100 text-red-700',
    'Fixed': 'bg-green-100 text-green-800',
    'Critical': 'bg-red-200 text-red-900',
    'High': 'bg-red-100 text-red-700',
    'Medium': 'bg-yellow-100 text-yellow-700',
    'Low': 'bg-gray-100 text-gray-600',
  };
  const cls = colors[text] || 'bg-gray-100 text-gray-600';
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
  const totalProjected = data.stories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);
  const totalAI = data.costs._totals.costUsd;
  const done = data.stories.filter(s => s.status === 'Done').length;
  const inProgress = data.stories.filter(s => s.status === 'In Progress').length;
  const pct = data.stories.length ? Math.round((done / data.stories.length) * 100) : 0;
  const cov = data.coverage;
  const covLabel = (cov.available !== false) ? `${cov.overall.toFixed(1)}%` : 'N/A';
  const covClass = (cov.available !== false) ? (cov.meetsTarget ? 'text-green-400' : 'text-red-400') : 'text-slate-500';
  const branchSubtitle = (cov.available !== false) ? `Branches: ${Number(cov.branches).toFixed(1)}%` : 'N/A';
  const genAt = data.generatedAt;
  const genDateStr = genAt.slice(0,10) + ' ' + genAt.slice(11,16) + ' UTC';
  return `
  <div class="text-white px-6 py-5 shadow-xl" id="top-bar"
       style="background:linear-gradient(135deg,#003087 0%,#005EB8 55%,#0078C8 100%);backdrop-filter:blur(0px)">
    <div class="flex flex-wrap gap-4 items-start justify-between">
      <div class="min-w-0">
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-3xl font-bold text-white tracking-tight topbar-title" style="text-shadow:0 1px 3px rgba(0,0,0,.3)">${esc(data.projectName)}</h1>
          <button onclick="openAbout()" class="text-xs text-blue-100 border border-white/30 rounded px-2 py-0.5 hover:bg-white/15 hover:text-white transition-colors flex-shrink-0 backdrop-blur-sm">About</button>
          <button onclick="toggleTheme()" id="theme-toggle" class="text-xs text-blue-100 border border-white/30 rounded px-2 py-0.5 hover:bg-white/15 hover:text-white transition-colors flex-shrink-0 backdrop-blur-sm" aria-label="Toggle dark/light mode"><span id="theme-icon">☀</span></button>
        </div>
        <p class="text-blue-100/80 text-sm mt-0.5 topbar-tagline">${esc(data.tagline)}&nbsp;·&nbsp;Updated ${genDateStr}&nbsp;·&nbsp;<code class="text-blue-200/60 text-xs">${data.commitSha}</code></p>
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
  return `
  <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex flex-wrap gap-3 items-center" id="filter-bar">
    <select id="f-epic" onchange="applyFilters()" class="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:bg-slate-700 dark:text-slate-100">
      <option value="">All Epics</option>${epicOptions}
    </select>
    <select id="f-status" onchange="applyFilters()" class="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:bg-slate-700 dark:text-slate-100">
      <option value="">All Statuses</option>
      <option>In Progress</option><option>Planned</option><option>Done</option><option>Blocked</option>
    </select>
    <select id="f-priority" onchange="applyFilters()" class="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:bg-slate-700 dark:text-slate-100">
      <option value="">All Priorities</option>
      <option>P0</option><option>P1</option><option>P2</option>
    </select>
    <select id="f-type" onchange="applyFilters()" class="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:bg-slate-700 dark:text-slate-100">
      <option value="">Stories + Bugs</option><option value="story">Stories only</option><option value="bug">Bugs only</option>
    </select>
    <input id="f-search" oninput="applyFilters()" type="text" placeholder="Search IDs, titles…"
      class="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm w-full sm:w-48 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400" />
    <button onclick="clearFilters()" class="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline">Clear</button>
  </div>`;
}

function renderTabs() {
  const tabs = ['Hierarchy','Kanban','Traceability','Charts','Costs','Bugs'];
  return `
  <div class="border-b border-slate-700 bg-slate-800 px-6 flex gap-1 overflow-x-auto" id="tab-bar">
    ${tabs.map((t, i) => `
    <button onclick="showTab('${t.toLowerCase()}')" id="tab-btn-${t.toLowerCase()}"
      class="px-4 py-2 text-sm font-medium border-b-2 flex-shrink-0 ${i===0 ? 'border-blue-400 text-blue-300' : 'border-transparent text-slate-400 hover:text-slate-200'}">
      ${t}
    </button>`).join('')}
  </div>`;
}

function renderHierarchyTab(data) {
  const epicBlocks = data.epics.map(epic => {
    const stories = data.stories.filter(s => s.epicId === epic.id);
    const epicProjected = stories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);
    const storyBlocks = stories.map(story => {
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
    return `
    <div class="epic-block mb-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div class="bg-slate-50 dark:bg-slate-800 px-4 py-3 flex flex-wrap items-center gap-3 cursor-pointer" onclick="toggleEpic('${epic.id}')">
        <span class="font-mono text-sm font-bold text-blue-600">${epic.id}</span>
        ${badge(epic.status)}
        <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
        <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
        <span class="ml-auto text-sm text-slate-500">${usd(epicProjected)} projected</span>
      </div>
      <div id="epic-stories-${epic.id}">${storyBlocks || '<p class="text-slate-500 dark:text-slate-400 text-sm px-4 py-2">No stories yet.</p>'}</div>
    </div>`;
  }).join('');
  return `<div id="tab-hierarchy" class="p-6">${epicBlocks}</div>`;
}

function renderKanbanTab(data) {
  const cols = ['To Do','Planned','In Progress','Blocked','Done'];
  const colHtml = cols.map(col => {
    const items = data.stories.filter(s =>
      col === 'Planned' ? s.status === 'Planned' :
      col === 'To Do' ? s.status === 'To Do' : s.status === col
    );
    return `
    <div class="flex-1 min-w-48">
      <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 pb-1 border-b border-slate-200 dark:border-slate-600">${col} <span class="text-slate-500 font-normal">(${items.length})</span></h3>
      ${items.map(s => `
      <div class="story-row bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded p-3 mb-2 shadow-sm"
           data-epic="${s.epicId}" data-status="${s.status}" data-priority="${s.priority}">
        <div class="flex gap-1 mb-1">${badge(s.priority)} <span class="text-xs text-slate-500">${s.id}</span></div>
        <p class="text-sm dark:text-slate-100">${esc(s.title)}</p>
        <p class="text-xs text-slate-500 mt-1">${s.epicId} · ${s.estimate || '?'}</p>
      </div>`).join('')}
    </div>`;
  }).join('');
  return `<div id="tab-kanban" class="p-6 hidden"><div class="flex gap-4 overflow-x-auto">${colHtml}</div></div>`;
}

function renderTraceabilityTab(data) {
  if (!data.testCases.length) {
    return `<div id="tab-traceability" class="p-6 hidden"><p class="text-slate-500">No test cases yet.</p></div>`;
  }
  const tcStatusColor = {
    'Pass': 'bg-green-100 text-green-800',
    'Fail': 'bg-red-100 text-red-800',
    'Not Run': 'bg-amber-50 text-amber-700',
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
      <td colspan="${data.testCases.length + 1}" class="px-2 py-1 text-xs font-semibold text-blue-700">
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
  <div id="tab-traceability" class="p-6 hidden">
    <div class="flex flex-wrap items-center gap-4 mb-3 text-xs">
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
    <div class="overflow-x-auto">
      <table class="border-collapse text-sm">
        <thead><tr><th class="p-2 border border-slate-200 dark:border-slate-600 text-xs dark:text-slate-300">Story</th>${headers}</tr></thead>
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
        <canvas id="chart-epic-progress" height="200"></canvas>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Cost Breakdown (Projected vs AI)</h3>
        <canvas id="chart-cost-breakdown" height="200"></canvas>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Test Coverage</h3>
        <div class="relative">
          <canvas id="chart-coverage" height="200"></canvas>
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="padding-bottom:2.5rem">
            <div class="text-center">
              <div class="text-2xl font-bold text-slate-700">${coveragePct}%</div>
              <div class="text-xs text-slate-500">overall</div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">AI Cost Timeline</h3>
        <canvas id="chart-ai-timeline" height="200"></canvas>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Story Status Distribution</h3>
        <canvas id="chart-burndown" height="200"></canvas>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Budget Burn Rate</h3>
        <canvas id="chart-burn-rate" height="200"></canvas>
      </div>

    </div>
  </div>
  <script>
  function initCharts() {
    new Chart(document.getElementById('chart-epic-progress'), {
      type: 'bar',
      data: { labels: ${epicLabels}, datasets: [
        { label: 'Done', data: ${epicDone}, backgroundColor: '#22c55e' },
        { label: 'In Progress', data: ${epicInProgress}, backgroundColor: '#3b82f6' },
        { label: 'Planned/To Do', data: ${epicPlanned}, backgroundColor: '#e2e8f0' },
      ]},
      options: { indexAxis: 'y', responsive: true, scales: { x: { stacked: true }, y: { stacked: true } } }
    });
    new Chart(document.getElementById('chart-cost-breakdown'), {
      type: 'bar',
      data: { labels: ${epicLabels}, datasets: [
        { label: 'Projected ($)', data: ${epicProjected}, backgroundColor: '#f59e0b', yAxisID: 'yProjected' },
        { label: 'AI Cost ($)', data: ${epicAI}, backgroundColor: '#0d9488', yAxisID: 'yAI' },
      ]},
      options: {
        responsive: true,
        scales: {
          yProjected: { type: 'linear', position: 'left', title: { display: true, text: 'Projected ($)' } },
          yAI: { type: 'linear', position: 'right', title: { display: true, text: 'AI Cost ($)' }, grid: { drawOnChartArea: false } }
        }
      }
    });
    new Chart(document.getElementById('chart-coverage'), {
      type: 'doughnut',
      data: { labels: ['Covered', 'Gap'], datasets: [{ data: [${coveragePct}, ${100 - parseFloat(coveragePct)}], backgroundColor: ['#22c55e','#e2e8f0'], borderWidth: 0 }] },
      options: { cutout: '70%', plugins: { legend: { display: true, position: 'bottom' } } }
    });
    new Chart(document.getElementById('chart-ai-timeline'), {
      type: 'line',
      data: { labels: ${sessionDates}, datasets: [{ label: 'Cumulative AI Cost ($)', data: ${sessionCosts}, borderColor: '#0d9488', tension: 0.3, fill: true, backgroundColor: 'rgba(13,148,136,0.1)' }] },
      options: { responsive: true }
    });
    new Chart(document.getElementById('chart-burndown'), {
      type: 'doughnut',
      data: { labels: ['Done','In Progress','Planned','To Do','Blocked'], datasets: [{ data: ${statusCounts}, backgroundColor: ['#22c55e','#3b82f6','#94a3b8','#f59e0b','#ef4444'], borderWidth: 1 }] },
      options: { plugins: { legend: { display: true, position: 'bottom' } } }
    });
    new Chart(document.getElementById('chart-burn-rate'), {
      type: 'bar',
      data: { labels: ${sessionDates}, datasets: [{ label: 'Session AI Spend ($)', data: ${sessionPerCosts}, backgroundColor: '#6366f1' }] },
      options: { responsive: true }
    });
  }
  </script>`;
}

function renderCostsTab(data) {
  const epicBlocks = data.epics.map(epic => {
    const epicStories = data.stories.filter(s => s.epicId === epic.id);
    const epicProjected = epicStories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);
    const epicAI = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).costUsd || 0), 0);
    const epicIn = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).inputTokens || 0), 0);
    const epicOut = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).outputTokens || 0), 0);
    const storyRows = epicStories.map(story => {
      const projected = (data.costs[story.id] && data.costs[story.id].projectedUsd || 0);
      const ai = data.costs[story.id] || {};
      const aiCost = ai.costUsd || 0;
      return `<tr class="border-t border-slate-100 dark:border-slate-700">
        <td class="px-3 py-2 pl-8 font-mono text-xs text-slate-500 whitespace-nowrap">${story.id}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(story.title)}</td>
        <td class="px-3 py-2 text-center">${badge(story.status)}</td>
        <td class="px-3 py-2 text-center text-sm dark:text-slate-200">${story.estimate || '?'}</td>
        <td class="px-3 py-2 text-right text-sm dark:text-slate-200">${usd(projected)}</td>
        <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${usd(aiCost)}</td>
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
  const t = data.costs._totals;
  const totalProjected = data.stories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);
  const bugCostsSection = data.bugs.length ? (() => {
    const bugRows = data.bugs.map(bug => {
      const bc = (data.costs._bugs && data.costs._bugs[bug.id]) || { costUsd: 0, inputTokens: 0, outputTokens: 0 };
      return `<tr class="border-t border-slate-100 dark:border-slate-700">
        <td class="px-3 py-2 font-mono text-xs text-slate-500 whitespace-nowrap">${esc(bug.id)}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(bug.title)}</td>
        <td class="px-3 py-2 text-center">${badge(bug.severity)}</td>
        <td class="px-3 py-2 text-center">${badge(bug.status)}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.relatedStory || '—')}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.fixBranch || '—')}</td>
        <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${bc.isEstimated ? `<span class="text-slate-400 italic" title="Estimated — predates cost logging">${usd(bc.costUsd)} est.</span>` : usd(bc.costUsd)}</td>
        <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${bc.isEstimated ? '—' : `${fmtNum(bc.inputTokens)} / ${fmtNum(bc.outputTokens)}`}</td>
      </tr>`;
    }).join('');
    return `
    <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-6 mb-2">Bug Fix Costs</h3>
    <table class="w-full text-left text-sm border-collapse">
      <thead class="bg-slate-800 text-slate-200 text-xs uppercase">
        <tr>
          <th class="px-3 py-2">Bug</th><th class="px-3 py-2">Title</th><th class="px-3 py-2 text-center">Severity</th>
          <th class="px-3 py-2 text-center">Status</th><th class="px-3 py-2">Story</th>
          <th class="px-3 py-2">Fix Branch</th><th class="px-3 py-2 text-right">AI Cost</th>
          <th class="px-3 py-2 text-right tokens-col">Tokens (in/out)</th>
        </tr>
      </thead>
      <tbody>${bugRows}</tbody>
    </table>`;
  })() : '';
  return `
  <div id="tab-costs" class="p-6 hidden overflow-x-auto">
    <table class="w-full text-left text-sm border-collapse">
      <thead class="bg-slate-800 text-slate-200 text-xs uppercase">
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
    ${bugCostsSection}
  </div>`;
}

function renderBugsTab(data) {
  if (!data.bugs.length) {
    return `<div id="tab-bugs" class="p-6 hidden"><p class="text-slate-500">No bugs logged yet.</p></div>`;
  }
  const rows = data.bugs.map(bug => `
  <tr class="bug-row border-t border-slate-100 dark:border-slate-700">
    <td class="px-3 py-2 font-mono text-xs whitespace-nowrap dark:text-slate-200">${bug.id}</td>
    <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(bug.title)}</td>
    <td class="px-3 py-2 text-center">${badge(bug.severity)}</td>
    <td class="px-3 py-2 text-center">${badge(bug.status)}</td>
    <td class="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">${esc(bug.relatedStory)}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.fixBranch || '—')}</td>
    <td class="px-3 py-2 text-center text-xs dark:text-slate-200">${bug.lessonEncoded && bug.lessonEncoded.startsWith('Yes') ? '✓' : '○'}</td>
  </tr>`).join('');
  return `
  <div id="tab-bugs" class="p-6 hidden overflow-x-auto">
    <table class="w-full text-left text-sm border-collapse">
      <thead class="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs uppercase">
        <tr>
          <th class="px-3 py-2">ID</th><th class="px-3 py-2">Title</th><th class="px-3 py-2 text-center">Severity</th>
          <th class="px-3 py-2 text-center">Status</th><th class="px-3 py-2">Story</th>
          <th class="px-3 py-2">Branch</th><th class="px-3 py-2 text-center">Lesson</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderRecentActivity(data) {
  if (!data.recentActivity.length) return '';
  const items = data.recentActivity.map(a =>
    `<li class="py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span class="text-xs text-slate-500 block">${a.date}</span>
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

  const VALID_TABS = ['hierarchy','kanban','traceability','charts','costs','bugs'];

  function showTab(name) {
    VALID_TABS.forEach(t => {
      const el = document.getElementById('tab-' + t);
      const btn = document.getElementById('tab-btn-' + t);
      if (el) el.classList.toggle('hidden', t !== name);
      if (btn) {
        btn.classList.toggle('border-blue-400', t === name);
        btn.classList.toggle('text-blue-300', t === name);
        btn.classList.toggle('border-transparent', t !== name);
        btn.classList.toggle('text-slate-400', t !== name);
      }
    });
    if (name === 'charts' && typeof initCharts === 'function') { initCharts(); initCharts = () => {}; }
    localStorage.setItem('activeTab', name);
    history.replaceState(null, '', '#' + name);
  }

  function toggleEpic(id) {
    const el = document.getElementById('epic-stories-' + id);
    if (el) el.classList.toggle('hidden');
  }
  function toggleACs(id) {
    const el = document.getElementById('acs-' + id);
    if (el) el.classList.toggle('hidden');
  }

  function applyFilters() {
    const epic = document.getElementById('f-epic').value;
    const status = document.getElementById('f-status').value;
    const priority = document.getElementById('f-priority').value;
    const type = document.getElementById('f-type').value;
    const search = document.getElementById('f-search').value.toLowerCase();
    document.querySelectorAll('.story-row').forEach(row => {
      const hide = (type === 'bug') ||
        (epic && row.dataset.epic !== epic) ||
        (status && row.dataset.status !== status) ||
        (priority && row.dataset.priority !== priority) ||
        (search && !row.innerText.toLowerCase().includes(search));
      row.style.display = hide ? 'none' : '';
    });
    document.querySelectorAll('.bug-row').forEach(row => {
      row.style.display = (type === 'story') ? 'none' : '';
    });
    localStorage.setItem('f-epic', epic);
    localStorage.setItem('f-status', status);
    localStorage.setItem('f-priority', priority);
    localStorage.setItem('f-type', type);
    localStorage.setItem('f-search', document.getElementById('f-search').value);
  }

  function clearFilters() {
    ['f-epic','f-status','f-priority','f-type'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-search').value = '';
    ['f-epic','f-status','f-priority','f-type','f-search'].forEach(k => localStorage.removeItem(k));
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

    // Restore filter state
    ['f-epic','f-status','f-priority','f-type'].forEach(id => {
      const val = localStorage.getItem(id);
      if (val) document.getElementById(id).value = val;
    });
    const savedSearch = localStorage.getItem('f-search');
    if (savedSearch) document.getElementById('f-search').value = savedSearch;
    applyFilters();

  });

  function toggleTheme() {
    var html = document.documentElement;
    var isDark = html.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    var icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = isDark ? '\u2600' : '\u263e';
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
  /* === Dark mode fallbacks (guaranteed via .dark class regardless of Tailwind CDN recompile) === */
  html.dark body { background-color: #0f172a; color: #f1f5f9; }
  html.dark #top-bar { background: linear-gradient(135deg, #001a4d 0%, #002d6e 55%, #003d8c 100%) !important; }
  html.dark #filter-bar { background-color: #1e293b !important; border-color: #334155 !important; }
  html.dark #filter-bar select, html.dark #filter-bar input { background-color: #334155 !important; border-color: #475569 !important; color: #f1f5f9 !important; }
  html.dark #filter-bar button { color: #94a3b8 !important; }
  html.dark #tab-bar { background-color: #1e293b !important; border-color: #334155 !important; }
  html.dark #tab-bar button { color: #94a3b8 !important; }
  html.dark #tab-bar button.active { color: #f1f5f9 !important; border-color: #3b82f6 !important; }
  html.dark .epic-block { border-color: #334155 !important; }
  html.dark .epic-block > div:first-child { background-color: #1e293b !important; }
  html.dark .epic-block > div:first-child span { color: #f1f5f9 !important; }
  html.dark .story-row { color: #e2e8f0; }
  html.dark .story-row p { color: #f1f5f9 !important; }
  html.dark #activity-panel { background-color: #1e293b !important; border-color: #334155 !important; color: #f1f5f9 !important; }
  html.dark #activity-panel li { border-color: #334155 !important; }
  html.dark table thead { background-color: #1e293b !important; color: #cbd5e1 !important; }
  html.dark table tbody tr { border-color: #334155 !important; }
  html.dark table tbody td { color: #e2e8f0; }
  html.dark .bg-white { background-color: #1e293b !important; }
  html.dark .border-slate-200 { border-color: #334155 !important; }
  html.dark .text-slate-700, html.dark .text-slate-600 { color: #cbd5e1 !important; }
  html.dark .text-slate-500 { color: #94a3b8 !important; }
  html.dark h3 { color: #e2e8f0 !important; }
  @media print {
    #filter-bar, #tab-bar, .fixed, .activity-panel { display: none !important; }
    body { padding-right: 0 !important; }
    #tab-hierarchy, #tab-costs { display: block !important; }
    #tab-kanban, #tab-traceability, #tab-charts, #tab-bugs { display: none !important; }
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
      .topbar-title { font-size: 1.1rem !important; line-height: 1.4 !important; }
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
<body class="bg-slate-50 dark:bg-slate-900 min-h-screen">
  <div class="sticky top-0 z-30">
    ${renderTopBar(data)}
    ${renderFilterBar(data)}
    ${renderTabs()}
  </div>
  <div id="tab-content">
    ${renderHierarchyTab(data)}
    ${renderKanbanTab(data)}
    ${renderTraceabilityTab(data)}
    ${renderChartsTab(data)}
    ${renderCostsTab(data)}
    ${renderBugsTab(data)}
  </div>
  ${renderRecentActivity(data)}
  ${renderScripts(data)}
  <div id="aboutModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div onclick="closeAbout()" class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
      <button onclick="closeAbout()" class="absolute top-3 right-4 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xl leading-none" aria-label="Close">&#x2715;</button>
      <h2 class="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">${esc(data.projectName)}</h2>
      <p class="text-slate-500 dark:text-slate-400 text-sm mb-4">${esc(data.tagline)}</p>
      <a href="${esc(data.githubUrl)}" target="_blank" rel="noopener noreferrer"
         class="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm underline underline-offset-2 mb-5">
        GitHub Repository
      </a>
      <div class="border-t border-slate-200 dark:border-slate-700 pt-4 text-slate-500 text-xs space-y-1.5">
        <p>Version <span class="text-slate-700 dark:text-slate-300 font-mono">v${esc(data.version)}</span></p>
        <p>Build <span class="text-slate-700 dark:text-slate-300 font-mono">#${esc(data.buildNumber)}</span>&nbsp;<code class="text-slate-500 dark:text-slate-600">${esc(data.commitSha)}</code></p>
        <p>Updated <span class="text-slate-700 dark:text-slate-300">${data.generatedAt.slice(0,10)}</span></p>
      </div>
      <p class="mt-5 text-slate-500 text-xs">Implemented by Kamal Syed, 2026</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderHtml };
