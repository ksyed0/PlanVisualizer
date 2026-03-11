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
  return (num > 0 && num < 1) ? '$' + num.toFixed(2) : '$' + Math.round(num).toLocaleString('en-US');
}
function fmtNum(n) { return Number(n).toLocaleString(); }

function renderTopBar(data) {
  const totalProjected = data.stories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);
  const totalAI = data.costs._totals.costUsd;
  const done = data.stories.filter(s => s.status === 'Done').length;
  const inProgress = data.stories.filter(s => s.status === 'In Progress').length;
  const pct = data.stories.length ? Math.round((done / data.stories.length) * 100) : 0;
  const cov = data.coverage;
  const linesCovLabel = (cov.available !== false) ? `${cov.overall.toFixed(1)}%` : 'N/A';
  const linesCovClass = (cov.available !== false) ? (cov.meetsTarget ? 'text-green-400' : 'text-red-400') : 'text-slate-500';
  const branchCov = cov.branches;
  const branchLabel = (cov.available !== false) ? `${Number(branchCov).toFixed(1)}%` : 'N/A';
  const branchClass = (cov.available !== false) ? (branchCov >= 80 ? 'text-green-400' : 'text-red-400') : 'text-slate-500';
  return `
  <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 shadow-lg">
    <div class="flex flex-wrap gap-4 items-start justify-between">
      <div class="min-w-0">
        <h1 class="text-3xl font-bold text-blue-400 tracking-tight">${esc(data.projectName)}</h1>
        <p class="text-slate-400 text-sm mt-0.5">${esc(data.tagline)}&nbsp;·&nbsp;Updated ${data.generatedAt.slice(0,10)}&nbsp;·&nbsp;<code class="text-slate-500 text-xs">${data.commitSha}</code></p>
        <div class="mt-2.5 flex items-center gap-2">
          <div class="bg-slate-700 rounded-full h-2 w-40 overflow-hidden">
            <div class="bg-blue-500 h-2 rounded-full" style="width:${pct}%"></div>
          </div>
          <span class="text-xs text-slate-400">${done}/${data.stories.length} stories done</span>
        </div>
      </div>
      <div class="flex gap-3 flex-wrap">
        <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center min-w-[70px]">
          <div class="text-2xl font-bold text-blue-300">${data.stories.length}</div>
          <div class="text-xs text-slate-400 mt-0.5">Stories</div>
        </div>
        <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center min-w-[90px]">
          <div class="text-2xl font-bold text-green-400">${pct}%</div>
          <div class="text-xs text-slate-400 mt-0.5">${done} done · ${inProgress} active</div>
        </div>
        <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center min-w-[80px]">
          <div class="text-xl font-bold text-yellow-400">${usd(totalProjected)}</div>
          <div class="text-xs text-slate-400 mt-0.5">Projected</div>
        </div>
        <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center min-w-[80px]">
          <div class="text-xl font-bold text-teal-400">${usd(totalAI)}</div>
          <div class="text-xs text-slate-400 mt-0.5">AI Actual</div>
        </div>
        <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center min-w-[70px]">
          <div class="text-2xl font-bold ${linesCovClass}">${linesCovLabel}</div>
          <div class="text-xs text-slate-400 mt-0.5">Lines Cov</div>
        </div>
        <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center min-w-[70px]">
          <div class="text-2xl font-bold ${branchClass}">${branchLabel}</div>
          <div class="text-xs text-slate-400 mt-0.5">Branch Cov</div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderFilterBar(data) {
  const epicOptions = data.epics.map(e =>
    `<option value="${esc(e.id)}">${esc(e.id)}: ${esc(e.title)}</option>`).join('');
  return `
  <div class="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap gap-3 items-center" id="filter-bar">
    <select id="f-epic" onchange="applyFilters()" class="border border-slate-300 rounded px-2 py-1 text-sm">
      <option value="">All Epics</option>${epicOptions}
    </select>
    <select id="f-status" onchange="applyFilters()" class="border border-slate-300 rounded px-2 py-1 text-sm">
      <option value="">All Statuses</option>
      <option>In Progress</option><option>Planned</option><option>Done</option><option>Blocked</option>
    </select>
    <select id="f-priority" onchange="applyFilters()" class="border border-slate-300 rounded px-2 py-1 text-sm">
      <option value="">All Priorities</option>
      <option>P0</option><option>P1</option><option>P2</option>
    </select>
    <select id="f-type" onchange="applyFilters()" class="border border-slate-300 rounded px-2 py-1 text-sm">
      <option value="">Stories + Bugs</option><option value="story">Stories only</option><option value="bug">Bugs only</option>
    </select>
    <input id="f-search" oninput="applyFilters()" type="text" placeholder="Search IDs, titles…"
      class="border border-slate-300 rounded px-2 py-1 text-sm w-48" />
    <button onclick="clearFilters()" class="text-sm text-slate-500 hover:text-slate-800 underline">Clear</button>
  </div>`;
}

function renderTabs() {
  const tabs = ['Hierarchy','Kanban','Traceability','Charts','Costs','Bugs'];
  return `
  <div class="border-b border-slate-700 bg-slate-800 px-6 flex gap-1" id="tab-bar">
    ${tabs.map((t, i) => `
    <button onclick="showTab('${t.toLowerCase()}')" id="tab-btn-${t.toLowerCase()}"
      class="px-4 py-2 text-sm font-medium border-b-2 ${i===0 ? 'border-blue-400 text-blue-300' : 'border-transparent text-slate-400 hover:text-slate-200'}">
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
          <span class="${ac.done ? 'text-green-500' : 'text-slate-400'}">${ac.done ? '✓' : '○'}</span>
          <span class="text-xs text-slate-500">${esc(ac.id)}</span>
          <span class="text-xs">${esc(ac.text)}</span>
          ${linkedTC ? `<span class="ml-2 text-xs text-slate-400">→ ${linkedTC.id} ${badge(linkedTC.status)}</span>` : ''}
        </li>`;
      }).join('');
      return `
      <div class="story-row ml-6 border-l-2 border-slate-200 pl-4 py-2"
           data-epic="${story.epicId}" data-status="${story.status}" data-priority="${story.priority}">
        <div class="flex flex-wrap items-center gap-2 cursor-pointer" onclick="toggleACs('${story.id}')">
          <span class="font-mono text-xs text-slate-500">${story.id}</span>
          ${badge(story.status)} ${badge(story.priority)}
          <span class="text-sm font-medium">${esc(story.title)}</span>
          ${riskBadge}
          <span class="ml-auto text-xs text-slate-400">${story.estimate || '?'} · ${usd(data.costs[story.id] && data.costs[story.id].projectedUsd || 0)}</span>
        </div>
        <ul id="acs-${story.id}" class="mt-2 hidden">${acItems || '<li class="text-xs text-slate-400 pl-4">No ACs yet</li>'}</ul>
      </div>`;
    }).join('');
    return `
    <div class="epic-block mb-4 border border-slate-200 rounded-lg overflow-hidden">
      <div class="bg-slate-50 px-4 py-3 flex flex-wrap items-center gap-3 cursor-pointer" onclick="toggleEpic('${epic.id}')">
        <span class="font-mono text-sm font-bold text-blue-600">${epic.id}</span>
        ${badge(epic.status)}
        <span class="font-semibold">${esc(epic.title)}</span>
        <span class="text-xs text-slate-400">${esc(epic.releaseTarget)}</span>
        <span class="ml-auto text-sm text-slate-500">${usd(epicProjected)} projected</span>
      </div>
      <div id="epic-stories-${epic.id}">${storyBlocks || '<p class="text-slate-400 text-sm px-4 py-2">No stories yet.</p>'}</div>
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
      <h3 class="text-sm font-semibold text-slate-600 mb-3 pb-1 border-b border-slate-200">${col} <span class="text-slate-400 font-normal">(${items.length})</span></h3>
      ${items.map(s => `
      <div class="story-row bg-white border border-slate-200 rounded p-3 mb-2 shadow-sm"
           data-epic="${s.epicId}" data-status="${s.status}" data-priority="${s.priority}">
        <div class="flex gap-1 mb-1">${badge(s.priority)} <span class="text-xs text-slate-400">${s.id}</span></div>
        <p class="text-sm">${esc(s.title)}</p>
        <p class="text-xs text-slate-400 mt-1">${s.epicId} · ${s.estimate || '?'}</p>
      </div>`).join('')}
    </div>`;
  }).join('');
  return `<div id="tab-kanban" class="p-6 hidden"><div class="flex gap-4 overflow-x-auto">${colHtml}</div></div>`;
}

function renderTraceabilityTab(data) {
  if (!data.testCases.length) {
    return `<div id="tab-traceability" class="p-6 hidden"><p class="text-slate-400">No test cases yet.</p></div>`;
  }
  const tcStatusColor = {
    'Pass': 'bg-green-100 text-green-800',
    'Fail': 'bg-red-100 text-red-800',
    'Not Run': 'bg-amber-50 text-amber-700',
  };
  const headers = data.testCases.map(tc => `<th class="text-xs font-mono p-2 border border-slate-200">${tc.id}</th>`).join('');
  const rows = data.stories.map(story => {
    const cells = data.testCases.map(tc => {
      const linked = tc.relatedStory === story.id;
      const cls = linked ? (tcStatusColor[tc.status] || 'bg-amber-50 text-amber-700') : 'bg-white';
      return `<td class="p-2 border border-slate-200 text-center text-xs font-medium ${cls}">${linked ? tc.status.slice(0,1) : ''}</td>`;
    }).join('');
    return `<tr><td class="text-xs font-mono px-2 py-1 border border-slate-200 whitespace-nowrap">${story.id}</td>${cells}</tr>`;
  }).join('');
  const passed  = data.testCases.filter(tc => tc.status === 'Pass').length;
  const failed  = data.testCases.filter(tc => tc.status === 'Fail').length;
  const notRun  = data.testCases.filter(tc => tc.status === 'Not Run').length;
  return `
  <div id="tab-traceability" class="p-6 hidden">
    <div class="flex gap-6 items-start">
      <div class="overflow-x-auto flex-1">
        <table class="border-collapse text-sm">
          <thead><tr><th class="p-2 border border-slate-200 text-xs">Story</th>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="flex-shrink-0 bg-white border border-slate-200 rounded-lg p-4 w-44">
        <h4 class="text-xs font-semibold text-slate-600 uppercase mb-3">Legend</h4>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="w-8 h-6 rounded text-xs font-medium flex items-center justify-center bg-green-100 text-green-800">P</span>
            <span class="text-xs text-slate-600">Pass</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-8 h-6 rounded text-xs font-medium flex items-center justify-center bg-red-100 text-red-800">F</span>
            <span class="text-xs text-slate-600">Fail</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-8 h-6 rounded text-xs font-medium flex items-center justify-center bg-amber-50 text-amber-700">N</span>
            <span class="text-xs text-slate-600">Not Run</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-8 h-6 rounded border border-slate-200 bg-white"></span>
            <span class="text-xs text-slate-400">Not linked</span>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100 space-y-1">
          <p class="text-xs font-semibold text-slate-500 mb-1">Summary</p>
          <p class="text-xs text-green-700">${passed} Pass</p>
          <p class="text-xs text-red-700">${failed} Fail</p>
          <p class="text-xs text-amber-700">${notRun} Not Run</p>
          <p class="text-xs text-slate-500 border-t border-slate-100 pt-1 mt-1">${data.testCases.length} Total TCs</p>
        </div>
      </div>
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

      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 mb-3">Epic Progress</h3>
        <canvas id="chart-epic-progress" height="200"></canvas>
      </div>

      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 mb-3">Cost Breakdown (Projected vs AI)</h3>
        <canvas id="chart-cost-breakdown" height="200"></canvas>
      </div>

      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 mb-3">Test Coverage</h3>
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

      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 mb-3">AI Cost Timeline</h3>
        <canvas id="chart-ai-timeline" height="200"></canvas>
      </div>

      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 mb-3">Story Status Distribution</h3>
        <canvas id="chart-burndown" height="200"></canvas>
      </div>

      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-slate-600 mb-3">Budget Burn Rate</h3>
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
        { label: 'Projected ($)', data: ${epicProjected}, backgroundColor: '#f59e0b' },
        { label: 'AI Cost ($)', data: ${epicAI}, backgroundColor: '#0d9488' },
      ]},
      options: { responsive: true }
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
      return `<tr class="border-t border-slate-100">
        <td class="px-3 py-2 pl-8 font-mono text-xs text-slate-500">${story.id}</td>
        <td class="px-3 py-2 text-sm">${esc(story.title)}</td>
        <td class="px-3 py-2 text-center">${badge(story.status)}</td>
        <td class="px-3 py-2 text-center text-sm">${story.estimate || '?'}</td>
        <td class="px-3 py-2 text-right text-sm">${usd(projected)}</td>
        <td class="px-3 py-2 text-right text-sm text-teal-600">${usd(aiCost)}</td>
        <td class="px-3 py-2 text-right text-xs text-slate-400">${fmtNum(ai.inputTokens || 0)} / ${fmtNum(ai.outputTokens || 0)}</td>
      </tr>`;
    }).join('');
    return `
    <tr class="bg-slate-50 border-t-2 border-slate-300">
      <td colspan="4" class="px-3 py-2">
        <span class="font-mono text-xs font-bold text-blue-600">${epic.id}</span>
        <span class="text-sm font-semibold ml-2 text-slate-700">${esc(epic.title)}</span>
        <span class="ml-2">${badge(epic.status)}</span>
      </td>
      <td class="px-3 py-2 text-right text-sm font-medium">${usd(epicProjected)}</td>
      <td class="px-3 py-2 text-right text-sm font-medium text-teal-600">${usd(epicAI)}</td>
      <td class="px-3 py-2 text-right text-xs text-slate-400">${fmtNum(epicIn)} / ${fmtNum(epicOut)}</td>
    </tr>
    ${storyRows}`;
  }).join('');
  const t = data.costs._totals;
  const totalProjected = data.stories.reduce((s, st) => s + (data.costs[st.id] && data.costs[st.id].projectedUsd || 0), 0);
  return `
  <div id="tab-costs" class="p-6 hidden overflow-x-auto">
    <table class="w-full text-left text-sm border-collapse">
      <thead class="bg-slate-800 text-slate-200 text-xs uppercase">
        <tr>
          <th class="px-3 py-2">Story</th><th class="px-3 py-2">Title</th><th class="px-3 py-2 text-center">Status</th>
          <th class="px-3 py-2 text-center">Size</th><th class="px-3 py-2 text-right">Projected</th>
          <th class="px-3 py-2 text-right">AI Cost</th><th class="px-3 py-2 text-right">Tokens (in/out)</th>
        </tr>
      </thead>
      <tbody>${epicBlocks}</tbody>
      <tfoot class="bg-slate-50 font-semibold border-t-2 border-slate-300">
        <tr>
          <td colspan="4" class="px-3 py-2 text-right text-sm">Totals</td>
          <td class="px-3 py-2 text-right text-sm">${usd(totalProjected)}</td>
          <td class="px-3 py-2 text-right text-sm text-teal-600">${usd(t.costUsd)}</td>
          <td class="px-3 py-2 text-right text-xs text-slate-400">${fmtNum(t.inputTokens)} / ${fmtNum(t.outputTokens)}</td>
        </tr>
      </tfoot>
    </table>
  </div>`;
}

function renderBugsTab(data) {
  if (!data.bugs.length) {
    return `<div id="tab-bugs" class="p-6 hidden"><p class="text-slate-400">No bugs logged yet.</p></div>`;
  }
  const rows = data.bugs.map(bug => `
  <tr class="bug-row border-t border-slate-100">
    <td class="px-3 py-2 font-mono text-xs">${bug.id}</td>
    <td class="px-3 py-2 text-sm">${esc(bug.title)}</td>
    <td class="px-3 py-2 text-center">${badge(bug.severity)}</td>
    <td class="px-3 py-2 text-center">${badge(bug.status)}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.relatedStory)}</td>
    <td class="px-3 py-2 text-xs text-slate-400">${esc(bug.fixBranch || '—')}</td>
    <td class="px-3 py-2 text-center text-xs">${bug.lessonEncoded === 'Yes' ? '✓' : '○'}</td>
  </tr>`).join('');
  return `
  <div id="tab-bugs" class="p-6 hidden overflow-x-auto">
    <table class="w-full text-left text-sm border-collapse">
      <thead class="bg-slate-50 text-slate-600 text-xs uppercase">
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
    `<li class="py-2 border-b border-slate-100 last:border-0">
      <span class="text-xs text-slate-400 block">${a.date}</span>
      <span class="text-sm text-slate-700">${esc(a.summary)}</span>
    </li>`
  ).join('');
  return `
  <div id="activity-panel" class="activity-panel fixed top-0 right-0 h-screen bg-white border-l border-slate-200 shadow-lg flex flex-col" style="width:280px;z-index:50;transition:width 0.25s ease">
    <div id="activity-expanded" class="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
      <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent Activity</h4>
      <button onclick="toggleActivityPanel()" class="text-slate-400 hover:text-slate-700 leading-none px-1" title="Collapse">&#9664;</button>
    </div>
    <ul id="activity-list" class="flex-1 overflow-y-auto px-4 py-2">${items}</ul>
    <div id="activity-collapsed" class="hidden flex-col items-center pt-3 pb-4 gap-3">
      <button onclick="toggleActivityPanel()" class="text-slate-400 hover:text-slate-700 leading-none px-1" title="Expand">&#9654;</button>
      <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide select-none" style="writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap">Recent Activity</span>
    </div>
  </div>`;
}

function renderScripts(data) {
  const allData = JSON.stringify({ epics: data.epics, stories: data.stories });
  return `
  <script>
  const ALL_DATA = ${allData};

  function showTab(name) {
    ['hierarchy','kanban','traceability','charts','costs','bugs'].forEach(t => {
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
  }

  function clearFilters() {
    ['f-epic','f-status','f-priority','f-type'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-search').value = '';
    applyFilters();
  }

  function toggleActivityPanel() {
    const panel = document.getElementById('activity-panel');
    if (!panel) return;
    const isCollapsed = panel.style.width === '40px';
    const expanded = document.getElementById('activity-expanded');
    const list = document.getElementById('activity-list');
    const collapsed = document.getElementById('activity-collapsed');
    if (isCollapsed) {
      panel.style.width = '280px';
      document.body.style.paddingRight = '280px';
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
    document.body.style.paddingRight = '280px';
    if (localStorage.getItem('activityPanelCollapsed') === 'true') {
      panel.style.width = '40px';
      document.body.style.paddingRight = '40px';
      document.getElementById('activity-expanded').classList.add('hidden');
      document.getElementById('activity-list').classList.add('hidden');
      const collapsed = document.getElementById('activity-collapsed');
      collapsed.classList.remove('hidden');
      collapsed.classList.add('flex');
    }
  }

  document.addEventListener('DOMContentLoaded', initActivityPanel);
  </script>`;
}

function renderPrintCSS() {
  return `
  <style>
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
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; } code, .font-mono { font-family: 'JetBrains Mono', monospace; }</style>
  ${renderPrintCSS()}
</head>
<body class="bg-slate-50 min-h-screen" style="padding-right:280px">
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
</body>
</html>`;
}

module.exports = { renderHtml };
