'use strict';

const {
  esc,
  jsEsc,
  usd,
  sparkline,
  deltaArrow,
  fmtNum,
  normalizeStoryRef,
  EPIC_ACCENT_COLORS,
  badge,
  BADGE_TONE,
} = require('./render-utils');
const { LEVEL_COLORS: RISK_LEVEL_COLORS } = require('./compute-risk');

function renderHierarchyTab(data) {
  const epicBlocks = data.epics.map((epic, epicIdx) => {
    const accent = EPIC_ACCENT_COLORS[epicIdx % EPIC_ACCENT_COLORS.length];
    const stories = data.stories.filter((s) => s.epicId === epic.id);
    const epicProjected = stories.reduce(
      (s, st) => s + ((data.costs[st.id] && data.costs[st.id].projectedUsd) || 0),
      0,
    );
    const totalCnt = stories.length;
    const doneCnt = stories.filter((s) => /^done$/i.test(s.status)).length;

    // ── column view: expandable story rows ──────────────────────────────────
    const storyRows = stories
      .map((story) => {
        const risk = data.atRisk[story.id] || {};
        const riskBadge = risk.isAtRisk
          ? `<span class="at-risk text-orange-500 text-xs ml-1" title="${[
              risk.missingTCs && 'Missing TCs',
              risk.noBranch && 'No branch',
              risk.failedTCNoBug && 'Failed TC without bug',
            ]
              .filter(Boolean)
              .join('; ')}">⚠ At Risk</span>`
          : '';
        const storyRisk = data.risk && data.risk.byStory ? data.risk.byStory.get(story.id) : null;
        const riskScoreBadge =
          storyRisk && story.status !== 'Done' && story.status !== 'Retired' && story.status !== 'Cancelled'
            ? `<span class="risk-score-badge text-xs font-semibold ml-1" style="color:${RISK_LEVEL_COLORS[storyRisk.level]}">${storyRisk.level} ${storyRisk.score}</span>`
            : '';
        const tcs = data.testCases.filter((tc) => tc.relatedStory === story.id);
        const acItems = story.acs
          .map((ac) => {
            const linkedTC = tcs.find((tc) => tc.relatedAC === ac.id);
            return `<li class="flex items-start gap-2 py-0.5">
          <span class="${ac.done ? 'text-green-500' : 'text-slate-500'}">${ac.done ? '✓' : '○'}</span>
          <span class="text-xs text-slate-500">${esc(ac.id)}</span>
          <span class="text-xs">${esc(ac.text)}</span>
          ${linkedTC ? `<span class="ml-2 text-xs text-slate-500">→ ${linkedTC.id} ${badge(linkedTC.status)}</span>` : ''}
        </li>`;
          })
          .join('');
        return `
      <div id="story-${esc(story.id)}" class="story-row ml-6 border-l-2 border-slate-200 dark:border-slate-600 pl-4 py-2"
           data-epic="${esc(story.epicId)}" data-status="${esc(story.status)}" data-priority="${esc(story.priority)}">
        <div class="flex flex-wrap items-center gap-2 cursor-pointer" onclick="toggleACs('${jsEsc(story.id)}')">
          <span class="font-mono text-xs text-slate-500 whitespace-nowrap">${story.id}</span>
          ${badge(story.status)} ${badge(story.priority)}
          <span class="text-sm font-medium">${esc(story.title)}</span>
          ${riskBadge}
          ${riskScoreBadge}
          <span class="ml-auto text-xs text-slate-500">${esc(story.estimate || '?')} · ${usd((data.costs[story.id] && data.costs[story.id].projectedUsd) || 0)}</span>
        </div>
        <ul id="acs-${story.id}" class="ac-guide mt-2 hidden">${acItems || '<li class="text-xs text-slate-500 pl-4">No ACs yet</li>'}</ul>
      </div>`;
      })
      .join('');

    // ── card view: story cards in a grid ────────────────────────────────────
    const storyCards = stories
      .map((story) => {
        const risk = data.atRisk[story.id] || {};
        const riskBadge = risk.isAtRisk ? `<span class="text-orange-500 text-xs">⚠ At Risk</span>` : '';
        const storyRisk = data.risk && data.risk.byStory ? data.risk.byStory.get(story.id) : null;
        const riskScoreBadge =
          storyRisk && story.status !== 'Done' && story.status !== 'Retired' && story.status !== 'Cancelled'
            ? `<span class="risk-score-badge text-xs font-semibold" style="color:${RISK_LEVEL_COLORS[storyRisk.level]}">${storyRisk.level} ${storyRisk.score}</span>`
            : '';
        const tcs = data.testCases.filter((tc) => tc.relatedStory === story.id);
        const acDone = story.acs.filter((a) => a.done).length;
        const acTotal = story.acs.length;
        const cost = usd((data.costs[story.id] && data.costs[story.id].projectedUsd) || 0);
        const acItems = story.acs
          .map((ac) => {
            const linkedTC = tcs.find((tc) => tc.relatedAC === ac.id);
            return `<li class="flex items-start gap-2 py-0.5">
          <span class="${ac.done ? 'text-green-500' : 'text-slate-400'}">${ac.done ? '✓' : '○'}</span>
          <span class="text-xs text-slate-400">${esc(ac.id)}</span>
          <span class="text-xs dark:text-slate-300">${esc(ac.text)}</span>
          ${linkedTC ? `<span class="ml-auto shrink-0 text-xs text-slate-400">→ ${linkedTC.id} ${badge(linkedTC.status)}</span>` : ''}
        </li>`;
          })
          .join('');
        return `
      <div class="story-row story-card-hover card-elev rounded-lg p-3 flex flex-col gap-1"
           data-epic="${esc(story.epicId)}" data-status="${esc(story.status)}" data-priority="${esc(story.priority)}">
        <div class="flex flex-wrap items-center gap-1 cursor-pointer" onclick="toggleCardACs('${jsEsc(story.id)}')">
          ${badge(story.status)} ${badge(story.priority)}
          <span class="font-mono text-xs text-slate-500 ml-1">${story.id}</span>
        </div>
        <p class="flex items-center gap-1 text-sm font-medium dark:text-slate-100 leading-snug cursor-pointer" onclick="toggleCardACs('${jsEsc(story.id)}')"><span class="epic-accent-dot" style="background:${accent.border}"></span>${esc(story.title)}</p>
        <div class="flex items-center gap-2 mt-auto pt-1 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-600">
          <span>${esc(story.estimate || '?')}</span>
          <span>${cost}</span>
          ${acTotal ? `<span class="cursor-pointer" onclick="toggleCardACs('${jsEsc(story.id)}')">${acDone}/${acTotal} ACs ▾</span>` : ''}
          ${riskScoreBadge}
          <span class="ml-auto">${riskBadge}</span>
        </div>
        ${acTotal ? `<ul id="card-acs-${story.id}" class="ac-guide hidden mt-1 pt-1 border-t border-slate-100 dark:border-slate-600 space-y-0.5">${acItems || '<li class="text-xs text-slate-500 pl-4">No ACs yet</li>'}</ul>` : ''}
      </div>`;
      })
      .join('');

    const epicHeader = `
      <div class="flex flex-wrap items-center gap-3 mb-3">
        <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epic.id}</span>
        ${badge(epic.status)}
        <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
        <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
        <span class="ml-auto text-sm text-slate-500">${usd(epicProjected)} projected</span>
      </div>`;

    return { epic, accent, epicProjected, storyRows, storyCards, epicHeader, doneCnt, totalCnt };
  });

  const columnView = epicBlocks
    .map(
      ({ epic, accent, epicProjected, storyRows, doneCnt, totalCnt }, epicIdx) => `
    <div class="epic-block mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden anim-stagger" data-epic-status="${esc(epic.status)}" style="--i:${Math.min(epicIdx, 19)};border-left:4px solid ${accent.border}">
      <div class="px-3 py-2 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('epic-stories-${jsEsc(epic.id)}','epic-arrow-${jsEsc(epic.id)}')">
        <div class="flex flex-wrap items-center gap-3">
          <span id="epic-arrow-${esc(epic.id)}" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9660;</span>
          <span class="epic-id-display font-mono text-xs font-bold uppercase"><span class="epic-id-label">EPIC /</span> <span class="epic-id-num" style="color:${accent.text}">${esc(epic.id.replace('EPIC-', ''))}</span></span>
          ${badge(epic.status)}
          <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
          <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
          <span class="ml-auto text-sm text-slate-500">${usd(epicProjected)} projected</span>
        </div>
        <div class="epic-progress-track"><div class="epic-progress-fill" style="width:${Math.round((doneCnt / (totalCnt || 1)) * 100)}%;background:${accent.border}"></div></div>
      </div>
      <div id="epic-stories-${epic.id}">${storyRows || '<p class="text-slate-500 dark:text-slate-400 text-sm px-4 py-2">No stories yet.</p>'}</div>
    </div>`,
    )
    .join('');

  const cardView = epicBlocks
    .map(
      ({ epic, accent, epicProjected, storyCards, doneCnt, totalCnt }, epicIdx) => `
    <div class="mb-4 anim-stagger" style="--i:${Math.min(epicIdx, 19)}">
      <div class="epic-block border border-slate-200 dark:border-slate-700 rounded-t-lg px-3 py-2 mb-0 cursor-pointer select-none" style="border-left:4px solid ${accent.border};background:${accent.bg}" onclick="toggleSection('epic-cards-${jsEsc(epic.id)}','epic-card-arrow-${jsEsc(epic.id)}')">
        <div class="flex flex-wrap items-center gap-3">
          <span id="epic-card-arrow-${esc(epic.id)}" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9660;</span>
          <span class="epic-id-display font-mono text-xs font-bold uppercase"><span class="epic-id-label">EPIC /</span> <span class="epic-id-num" style="color:${accent.text}">${esc(epic.id.replace('EPIC-', ''))}</span></span>
          ${badge(epic.status)}
          <span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>
          <span class="text-xs text-slate-500">${esc(epic.releaseTarget)}</span>
          <span class="ml-auto text-sm text-slate-500">${usd(epicProjected)} projected</span>
        </div>
        <div class="epic-progress-track"><div class="epic-progress-fill" style="width:${Math.round((doneCnt / (totalCnt || 1)) * 100)}%;background:${accent.border}"></div></div>
      </div>
      <div id="epic-cards-${epic.id}" class="border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-lg p-3">
        ${
          storyCards
            ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">${storyCards}</div>`
            : '<p class="text-slate-500 dark:text-slate-400 text-sm">No stories yet.</p>'
        }
      </div>
    </div>`,
    )
    .join('');

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
  const cols = ['To Do', 'Planned', 'In Progress', 'Blocked', 'Done'];
  const epicOrder = [...new Set(data.stories.map((s) => s.epicId).filter(Boolean))];
  const hasUngrouped = data.stories.some((s) => !s.epicId);
  const SWIM_COLORS = ['#7c3aed', '#0369a1', '#b45309', '#166534', '#9f1239', '#6b21a8', '#0e7490', '#92400e'];

  const renderCard = (s, cardIdx) => {
    const tcs = data.testCases.filter((tc) => tc.relatedStory === s.id);
    const acDone = s.acs.filter((a) => a.done).length;
    const acTotal = s.acs.length;
    const acItems = s.acs
      .map((ac) => {
        const linkedTC = tcs.find((tc) => tc.relatedAC === ac.id);
        return `<li class="flex items-start gap-2 py-0.5">
          <span class="${ac.done ? 'text-green-500' : 'text-slate-400'}">${ac.done ? '✓' : '○'}</span>
          <span class="text-xs text-slate-400">${esc(ac.id)}</span>
          <span class="text-xs dark:text-slate-300">${esc(ac.text)}</span>
          ${linkedTC ? `<span class="ml-auto shrink-0 text-xs text-slate-400">→ ${linkedTC.id} ${badge(linkedTC.status)}</span>` : ''}
        </li>`;
      })
      .join('');
    // AC-0330: left border stripe by priority (P0=danger, P1=warn, else transparent)
    const priorityStripe =
      s.priority === 'P0'
        ? 'var(--badge-danger-text,#dc2626)'
        : s.priority === 'P1'
          ? 'var(--badge-warn-text,#d97706)'
          : 'transparent';
    return `
    <div class="story-row story-card-hover card-elev border border-slate-200 dark:border-slate-600 rounded p-3 mb-2 cursor-pointer anim-stagger"
         style="--i:${Math.min(cardIdx || 0, 19)};border-left:3px solid ${priorityStripe}"
         data-epic="${esc(s.epicId)}" data-status="${esc(s.status)}" data-priority="${esc(s.priority)}"
         onclick="toggleKanbanACs('${jsEsc(s.id)}')">
      <div class="flex gap-1 mb-1">${badge(s.priority)} <span class="text-xs text-slate-500 font-mono">${esc(s.id)}</span></div>
      <p class="text-sm dark:text-slate-100">${esc(s.title)}</p>
      <div class="flex items-center gap-2 mt-1 text-xs text-slate-500">
        <span class="font-mono">${esc(s.estimate || '?')}</span>
        ${acTotal ? `<span>${acDone}/${acTotal} ACs ▾</span>` : ''}
      </div>
      ${acTotal ? `<ul id="kanban-acs-${esc(s.id)}" class="hidden mt-2 pt-2 border-t border-slate-100 dark:border-slate-600 space-y-0.5">${acItems}</ul>` : ''}
    </div>`;
  };

  // Column header row
  const headerRow = `<div class="ksw-header-row">
    <div class="ksw-label-cell"></div>
    ${cols
      .map((col) => {
        const count = data.stories.filter((s) => s.status === col).length;
        return `<div class="ksw-status-cell">
        <span class="text-xs font-semibold uppercase tracking-widest">${col}</span>
        <span class="wip-pill${count > 3 ? ' wip-over' : ''} ml-1">${count}</span>
      </div>`;
      })
      .join('')}
  </div>`;

  // Epic swimlane rows
  const swimlaneRows = epicOrder
    .map((epicId, i) => {
      const color = SWIM_COLORS[i % SWIM_COLORS.length];
      const epicTitle = (data.epics || []).find((e) => e.id === epicId);
      const epicLabel = epicTitle ? `${esc(epicId)}: ${esc(epicTitle.title)}` : esc(epicId);
      const epicCount = data.stories.filter((s) => s.epicId === epicId).length;
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
        ${cols
          .map((col) => {
            const items = data.stories.filter((s) => s.epicId === epicId && s.status === col);
            const inProgressClass = col === 'In Progress' ? ' ksw-inprogress' : '';
            return `<div class="ksw-cards-cell${inProgressClass}">${items.map((s, idx) => renderCard(s, idx)).join('')}</div>`;
          })
          .join('')}
      </div>
    </div>`;
    })
    .join('');

  // Ungrouped row
  const ungroupedRow = hasUngrouped
    ? (() => {
        const sid = 'ksw-ungrouped';
        const items = data.stories.filter((s) => !s.epicId);
        return `
    <div class="ksw-swimlane" style="border-left:3px solid #64748b">
      <div class="ksw-swim-hdr" onclick="toggleKsw('${sid}')" style="border-left-color:#64748b">
        <span id="${sid}-arrow" class="ksw-arrow">&#9654;</span>
        <span class="ksw-epic-title" style="color:#64748b">No Epic</span>
        <span class="ksw-epic-count">${items.length}</span>
      </div>
      <div id="${sid}-body" class="ksw-swim-body hidden">
        <div class="ksw-label-cell"></div>
        ${cols
          .map((col) => {
            const ci = items.filter((s) => s.status === col);
            const inProgressClass = col === 'In Progress' ? ' ksw-inprogress' : '';
            return `<div class="ksw-cards-cell${inProgressClass}">${ci.map((s, idx) => renderCard(s, idx)).join('')}</div>`;
          })
          .join('')}
      </div>
    </div>`;
      })()
    : '';

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
  const tcTone = { Pass: 'success', Fail: 'danger', 'Not Run': 'warn' };
  const passed = data.testCases.filter((tc) => tc.status === 'Pass').length;
  const failed = data.testCases.filter((tc) => tc.status === 'Fail').length;
  const notRun = data.testCases.filter((tc) => tc.status === 'Not Run').length;
  const headers = data.testCases
    .map(
      (tc) =>
        `<th class="text-xs font-mono p-2 border border-slate-200 dark:border-slate-600" data-col="${tc.id}">${tc.id}</th>`,
    )
    .join('');
  const rows = data.epics
    .map((epic) => {
      const epicStories = data.stories.filter((s) => s.epicId === epic.id);
      if (!epicStories.length) return '';
      const epicRowId = `trace-epic-${epic.id}`;
      const accent = EPIC_ACCENT_COLORS[data.epics.indexOf(epic) % EPIC_ACCENT_COLORS.length];
      const epicTCs = epicStories.flatMap((s) => data.testCases.filter((tc) => tc.relatedStory === s.id));
      const hasFail = epicTCs.some((tc) => tc.status === 'Fail');
      const hasNotRun = !hasFail && epicTCs.some((tc) => tc.status === 'Not Run');
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
      const storyRows = epicStories
        .map((story, storyIdx) => {
          const cells = data.testCases
            .map((tc) => {
              const linked = tc.relatedStory === story.id;
              const tone = linked ? tcTone[tc.status] || 'warn' : null;
              return linked
                ? `<td class="tc-dot tc-dot-${tone}" data-col="${tc.id}"></td>`
                : `<td class="p-2 border border-slate-200 dark:border-slate-600" data-col="${tc.id}"></td>`;
            })
            .join('');
          return `<tr class="hidden anim-stagger" style="--i:${Math.min(storyIdx, 19)}" data-trace-epic="${esc(epic.id)}">
        <td class="trace-sticky-col text-xs font-mono px-2 py-1 border border-slate-200 dark:border-slate-600 whitespace-nowrap pl-6 dark:text-slate-200">${story.id}</td>
        ${cells}
      </tr>`;
        })
        .join('');
      return epicHeader + storyRows;
    })
    .join('');
  const caption = `<caption class="trace-caption">
    <span class="tc-dot tc-dot-success"></span> Pass: ${passed}
    &middot; <span class="tc-dot tc-dot-danger"></span> Fail: ${failed}
    &middot; <span class="tc-dot tc-dot-warn"></span> Not Run: ${notRun}
    &middot; Total: ${data.testCases.length}
  </caption>`;
  return `
  <div id="tab-traceability" class="p-6 hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-traceability">
    <div class="scroll-table">
      <table class="border-collapse text-sm">
        ${caption}
        <thead><tr><th class="trace-sticky-col p-2 border border-slate-200 dark:border-slate-600 text-xs">Story</th>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function renderTrendsTab(data, options = {}) {
  const trends = options.trends || data.trends || null;
  const hasData = trends && trends.dates && trends.dates.length >= 2;

  const datesJson = trends ? JSON.stringify(trends.dates.map((d) => d.replace('T', ' ').slice(0, 16))) : '[]';
  const doneJson = trends ? JSON.stringify(trends.doneCounts) : '[]';
  const totalJson = trends ? JSON.stringify(trends.totalStories) : '[]';
  const costJson = trends ? JSON.stringify(trends.aiCosts.map((c) => c.toFixed(2))) : '[]';
  const coverageJson = trends ? JSON.stringify(trends.coverage.map((c) => (c !== null ? c.toFixed(1) : null))) : '[]';
  const velocityJson = trends ? JSON.stringify(trends.velocity.map((v) => v.toFixed(1))) : '[]';
  const bugsJson = trends ? JSON.stringify(trends.openBugs) : '[]';
  const riskJson = trends ? JSON.stringify(trends.atRisk) : '[]';
  const inputTokensJson = trends ? JSON.stringify(trends.inputTokens) : '[]';
  const outputTokensJson = trends ? JSON.stringify(trends.outputTokens) : '[]';
  const avgRiskJson = trends ? JSON.stringify((trends.avgRisk || []).map((v) => v.toFixed(2))) : '[]';

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
    ${
      !hasData
        ? placeholder
        : `
    <div class="col-span-full trends-filter-bar mb-2">
      <button class="trends-range-btn active" data-range="all" onclick="setTrendsRange(this,'all')">All</button>
      <button class="trends-range-btn" data-range="90" onclick="setTrendsRange(this,90)">90d</button>
      <button class="trends-range-btn" data-range="30" onclick="setTrendsRange(this,30)">30d</button>
      <button class="trends-range-btn" data-range="7" onclick="setTrendsRange(this,7)">7d</button>
    </div>

    <div class="chart-supertitle">Progress</div>

    <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:0">
      <div class="chart-header-rule"><span class="display-title">Done Stories</span><span class="chart-subtitle">over time</span></div>
      <div style="height:250px;position:relative"><canvas id="chart-trends-progress"></canvas></div>
    </div>
    <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:1">
      <div class="chart-header-rule"><span class="display-title">Velocity</span><span class="chart-subtitle">story points per session</span></div>
      <div style="height:250px;position:relative"><canvas id="chart-trends-velocity"></canvas></div>
    </div>

    <div class="chart-supertitle">Cost &amp; Spend</div>

    <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:2">
      <div class="chart-header-rule"><span class="display-title">AI Cost</span><span class="chart-subtitle">cumulative USD over time</span></div>
      <div style="height:250px;position:relative"><canvas id="chart-trends-cost"></canvas></div>
    </div>
    <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:3">
      <div class="chart-header-rule"><span class="display-title">Token Usage</span><span class="chart-subtitle">input &amp; output tokens</span></div>
      <div style="height:250px;position:relative"><canvas id="chart-trends-tokens"></canvas></div>
    </div>

    <div class="chart-supertitle">Quality</div>

    <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:4">
      <div class="chart-header-rule"><span class="display-title">Coverage</span><span class="chart-subtitle">statement % over time</span></div>
      <div style="height:250px;position:relative"><canvas id="chart-trends-coverage"></canvas></div>
    </div>
    <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:5">
      <div class="chart-header-rule"><span class="display-title">Open Bugs</span><span class="chart-subtitle">over time</span></div>
      <div style="height:250px;position:relative"><canvas id="chart-trends-bugs"></canvas></div>
    </div>
    <div class="card-elev rounded-lg p-4 col-span-full anim-stagger" style="--i:6">
      <div class="chart-header-rule"><span class="display-title">At-Risk Stories</span><span class="chart-subtitle">over time</span></div>
      <div style="height:250px;position:relative"><canvas id="chart-trends-risk"></canvas></div>
    </div>
    <div class="card-elev rounded-lg p-4 col-span-full anim-stagger" style="--i:7">
      <div class="chart-header-rule"><span class="display-title">Avg Risk Score</span><span class="chart-subtitle">project-wide, over time</span></div>
      <div style="height:250px;position:relative"><canvas id="chart-trends-avg-risk"></canvas></div>
    </div>
    `
    }
  </div>
</div>
<script>
var _trendsAllLabels = ${datesJson};
var _trendsAllData = {
  done: ${doneJson}, total: ${totalJson}, cost: ${costJson},
  coverage: ${coverageJson}, velocity: ${velocityJson},
  bugs: ${bugsJson}, risk: ${riskJson},
  inputTokens: ${inputTokensJson}, outputTokens: ${outputTokensJson},
  avgRisk: ${avgRiskJson}
};
var _trendsChartRefs = {};
function _trendGrad(ctx, hex) {
  var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  var grad = ctx.createLinearGradient(0,0,0,200);
  grad.addColorStop(0,'rgba('+r+','+g+','+b+',0.35)');
  grad.addColorStop(1,'rgba('+r+','+g+','+b+',0.0)');
  return grad;
}
function _mkTrend(id, cfg) {
  var el = document.getElementById(id); if (!el) return;
  _trendsChartRefs[id] = new Chart(el, cfg);
  _trendsChartRefs[id]._allData = cfg.data.datasets.map(function(ds){ return ds.data.slice(); });
  cfg.data.datasets.forEach(function(ds, i) {
    if (ds._gc) _trendsChartRefs[id].data.datasets[i].backgroundColor = _trendGrad(el.getContext('2d'), ds._gc);
  });
  _trendsChartRefs[id].update('none');
}
function initTrendsCharts() {
  var tc = chartTextColor();
  var gc = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.07)' : '#e2e8f0';
  var labels = _trendsAllLabels; if (labels.length < 2) return;
  var xA = { ticks:{ color:tc, maxTicksLimit:8, callback:function(v){ var d=new Date(this.getLabelForValue(v)); return isNaN(d)?v:(d.getMonth()+1)+'/'+d.getDate(); }}, grid:{color:gc} };
  var yA = function(o){ return Object.assign({ticks:{color:tc},grid:{color:gc},beginAtZero:true},o||{}); };
  var leg = { labels:{color:tc, font:{family:"'Inter',sans-serif",size:12}, pointStyle:'circle', usePointStyle:true }};
  _mkTrend('chart-trends-progress', {type:'line', data:{labels:labels, datasets:[
    {label:'Done', data:_trendsAllData.done, borderColor:'#22c55e', _gc:'#22c55e', fill:true, tension:0.3},
    {label:'Total', data:_trendsAllData.total, borderColor:'#64748b', backgroundColor:'transparent', borderDash:[5,5], tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA()}}});
  _mkTrend('chart-trends-velocity', {type:'bar', data:{labels:labels, datasets:[
    {label:'Story Points', data:_trendsAllData.velocity, backgroundColor:'#3b82f6'}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA()}}});
  _mkTrend('chart-trends-cost', {type:'line', data:{labels:labels, datasets:[
    {label:'Total Cost ($)', data:_trendsAllData.cost, borderColor:'#f59e0b', _gc:'#f59e0b', fill:true, tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA()}}});
  _mkTrend('chart-trends-tokens', {type:'line', data:{labels:labels, datasets:[
    {label:'Input', data:_trendsAllData.inputTokens, borderColor:'#06b6d4', _gc:'#06b6d4', fill:true},
    {label:'Output', data:_trendsAllData.outputTokens, borderColor:'#ec4899', _gc:'#ec4899', fill:true}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA({ticks:{color:tc,callback:function(v){return v>=1e6?(v/1e6).toFixed(0)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v;}}})}}});
  _mkTrend('chart-trends-coverage', {type:'line', data:{labels:labels, datasets:[
    {label:'Coverage %', data:_trendsAllData.coverage, borderColor:'#8b5cf6', _gc:'#8b5cf6', fill:true, tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA({min:0,max:100})}}});
  _mkTrend('chart-trends-bugs', {type:'line', data:{labels:labels, datasets:[
    {label:'Open Bugs', data:_trendsAllData.bugs, borderColor:'#ef4444', _gc:'#ef4444', fill:true, tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA()}}});
  _mkTrend('chart-trends-risk', {type:'line', data:{labels:labels, datasets:[
    {label:'At-Risk', data:_trendsAllData.risk, borderColor:'#f97316', _gc:'#f97316', fill:true, tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA({suggestedMax:5})}}});
  _mkTrend('chart-trends-avg-risk', {type:'line', data:{labels:labels, datasets:[
    {label:'Avg Risk Score', data:_trendsAllData.avgRisk, borderColor:'#f59e0b', _gc:'#f59e0b', fill:true, tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA({min:0,suggestedMax:4})}}});
  var saved = localStorage.getItem('pv-trends-range');
  if (saved && saved !== 'all') {
    var btn = document.querySelector('.trends-range-btn[data-range="'+saved+'"]');
    if (btn) setTrendsRange(btn, saved === 'all' ? 'all' : Number(saved));
  }
}
function setTrendsRange(btn, range) {
  document.querySelectorAll('.trends-range-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  localStorage.setItem('pv-trends-range', range);
  var n = range === 'all' ? _trendsAllLabels.length : Math.min(Number(range), _trendsAllLabels.length);
  Object.keys(_trendsChartRefs).forEach(function(id) {
    var ch = _trendsChartRefs[id]; if (!ch._allData) return;
    ch.data.labels = _trendsAllLabels.slice(-n);
    ch.data.datasets.forEach(function(ds, i){ ds.data = ch._allData[i].slice(-n); });
    ch.update('none');
  });
}
</script>`;
}

function renderChartsTab(data) {
  const epicLabels = JSON.stringify(data.epics.map((e) => e.id));
  const epicDone = JSON.stringify(
    data.epics.map((e) => data.stories.filter((s) => s.epicId === e.id && s.status === 'Done').length),
  );
  const epicInProgress = JSON.stringify(
    data.epics.map((e) => data.stories.filter((s) => s.epicId === e.id && s.status === 'In Progress').length),
  );
  const epicPlanned = JSON.stringify(
    data.epics.map(
      (e) => data.stories.filter((s) => s.epicId === e.id && ['Planned', 'To Do'].includes(s.status)).length,
    ),
  );
  const epicProjected = JSON.stringify(
    data.epics.map((e) =>
      data.stories
        .filter((s) => s.epicId === e.id)
        .reduce((sum, s) => sum + ((data.costs[s.id] && data.costs[s.id].projectedUsd) || 0), 0),
    ),
  );
  const epicAI = JSON.stringify(
    data.epics.map((e) => {
      const branchStories = data.stories.filter((s) => s.epicId === e.id);
      return branchStories.reduce((sum, s) => sum + (data.costs[s.id] ? data.costs[s.id].costUsd || 0 : 0), 0);
    }),
  );
  const coveragePct = data.coverage.available !== false ? data.coverage.overall.toFixed(1) : null;
  const coveragePctNum = coveragePct !== null ? parseFloat(coveragePct) : 0;
  const coverageGap = coveragePct !== null ? (100 - coveragePctNum).toFixed(1) : '100';
  const timeline = data.sessionTimeline || [];
  const sessionDates = JSON.stringify(timeline.map((s) => s.date));
  const sessionCosts = JSON.stringify(timeline.map((s) => s.cumCost.toFixed(2)));
  const sessionPerCosts = JSON.stringify(
    timeline.map((s, i) => (i === 0 ? s.cumCost : s.cumCost - timeline[i - 1].cumCost).toFixed(2)),
  );
  const statusCounts = JSON.stringify(
    ['Done', 'In Progress', 'Planned', 'To Do', 'Blocked'].map(
      (st) => data.stories.filter((s) => s.status === st).length,
    ),
  );
  const totalStories = data.stories.filter((s) => s.status !== 'Retired').length;

  // Risk chart data
  const riskEpics =
    data.risk && data.risk.byEpic ? [...data.risk.byEpic.entries()].sort((a, b) => b[1].avgScore - a[1].avgScore) : [];
  const riskCounts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  let totalRiskScore = 0,
    activeStoryCount = 0;
  if (data.risk && data.risk.byStory) {
    for (const story of data.stories) {
      if (story.status === 'Done' || story.status === 'Retired') continue;
      const sr = data.risk.byStory.get(story.id);
      if (sr) {
        riskCounts[sr.level]++;
        totalRiskScore += sr.score;
        activeStoryCount++;
      }
    }
  }
  const avgRiskScore = activeStoryCount > 0 ? (totalRiskScore / activeStoryCount).toFixed(1) : '—';
  const highCritCount = riskCounts.High + riskCounts.Critical;
  const riskDistCounts = JSON.stringify([riskCounts.Low, riskCounts.Medium, riskCounts.High, riskCounts.Critical]);

  const atRiskEpics = riskEpics.filter(([, r]) => r.avgScore >= 2.0);

  return `
  <div id="tab-charts" class="p-6 hidden" role="tabpanel" aria-labelledby="tab-btn-charts">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <div class="chart-supertitle">Delivery</div>

      <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:0">
        <div class="chart-header-rule">
          <span class="display-title">Epic Progress</span>
          <span class="chart-subtitle">by epic</span>
        </div>
        <div style="height:${Math.max(300, data.epics.length * 36)}px;position:relative"><canvas id="chart-epic-progress"></canvas></div>
      </div>

      <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:1">
        <div class="chart-header-rule">
          <span class="display-title">Story Status Distribution</span>
          <span class="chart-subtitle">distribution</span>
        </div>
        <div style="position:relative">
          <canvas id="chart-burndown"></canvas>
          <div class="chart-center-overlay">
            <span class="hero-num">${totalStories}</span>
            <span style="font-size:10px;opacity:0.6">stories</span>
          </div>
        </div>
      </div>

      <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:2">
        <div class="chart-header-rule">
          <span class="display-title">Test Coverage</span>
          <span class="chart-subtitle">overall %</span>
        </div>
        <div style="height:300px;position:relative">
          <canvas id="chart-coverage"></canvas>
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="padding-bottom:3rem">
            <div class="text-center">
              <div class="hero-num text-slate-700 dark:text-slate-200">${coveragePct !== null ? coveragePct + '%' : 'N/A'}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">overall</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:3">
        <div class="chart-header-rule">
          <span class="display-title">AI Cost Timeline</span>
          <span class="chart-subtitle">trend</span>
        </div>
        <div style="height:300px;position:relative"><canvas id="chart-ai-timeline"></canvas></div>
      </div>

      <div class="chart-supertitle">Financial</div>

      <div class="card-elev rounded-lg p-4 flex flex-col anim-stagger" style="--i:4">
        <div class="chart-header-rule">
          <span class="display-title">Cost Breakdown</span>
          <span class="chart-subtitle">projected vs AI</span>
        </div>
        <!-- BUG-0169 — flex-centered wrapper lets the fixed-height chart sit vertically centered when the grid row is forced taller by a sibling card (e.g. Epic Progress dynamic height). -->
        <div class="flex-1 flex items-center justify-center">
          <div class="w-full" style="height:300px;position:relative"><canvas id="chart-cost-breakdown"></canvas></div>
        </div>
      </div>

      <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:5">
        <div class="chart-header-rule">
          <span class="display-title">Budget Burn Rate</span>
          <span class="chart-subtitle">by session</span>
        </div>
        <div style="height:300px;position:relative"><canvas id="chart-burn-rate"></canvas></div>
      </div>

      <div class="chart-supertitle">Risk</div>

      <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:6">
        <div class="chart-header-rule">
          <span class="display-title">Risk Score by Epic</span>
          <span class="chart-subtitle">avg score, active stories</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-top:4px">
          ${
            riskEpics.length === 0
              ? '<p style="color:#64748b;font-size:12px">No risk data</p>'
              : riskEpics
                  .map(([id, r]) => {
                    const pct = Math.min(100, Math.round((r.avgScore / 4) * 100));
                    const col = RISK_LEVEL_COLORS[r.level];
                    return `<div style="display:flex;align-items:center;gap:6px">
              <span style="color:#e2e8f0;width:72px;font-size:11px;font-family:monospace;flex-shrink:0">${esc(id)}</span>
              <div style="flex:1;background:#1e293b;border-radius:3px;height:14px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${col};border-radius:3px"></div>
              </div>
              <span style="color:${col};font-size:11px;font-weight:600;width:28px;text-align:right">${r.avgScore}</span>
              <span style="background:${col};color:${r.level === 'High' ? '#1e293b' : 'white'};font-size:9px;padding:1px 5px;border-radius:3px;white-space:nowrap">${r.level}</span>
            </div>`;
                  })
                  .join('')
          }
        </div>
      </div>

      <div class="card-elev rounded-lg p-4 anim-stagger" style="--i:7">
        <div class="chart-header-rule">
          <span class="display-title">Story Risk Distribution</span>
          <span class="chart-subtitle">stories by risk level</span>
        </div>
        <div style="height:200px;position:relative"><canvas id="chart-risk-distribution"></canvas></div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <div style="flex:1;background:var(--clr-card,#1e293b);border-radius:6px;padding:8px 10px;border-left:3px solid #f59e0b">
            <div style="font-size:10px;color:#64748b">Avg score</div>
            <div style="font-size:18px;font-weight:700;color:#f59e0b">${avgRiskScore}</div>
          </div>
          <div style="flex:1;background:var(--clr-card,#1e293b);border-radius:6px;padding:8px 10px;border-left:3px solid #ef4444">
            <div style="font-size:10px;color:#64748b">High + Critical</div>
            <div style="font-size:18px;font-weight:700;color:#ef4444">${highCritCount} stories</div>
          </div>
        </div>
      </div>

      ${
        atRiskEpics.length > 0
          ? `
      <div class="col-span-full card-elev rounded-lg p-4 anim-stagger" style="--i:8">
        <div class="chart-header-rule">
          <span class="display-title">At-Risk Epics</span>
          <span class="chart-subtitle">avg score \u2265 2.0</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          ${atRiskEpics
            .map(([id, r]) => {
              const col = RISK_LEVEL_COLORS[r.level];
              const textCol = r.level === 'High' ? '#1e293b' : 'white';
              return `<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--clr-card,#1e293b);border-radius:6px;border-left:3px solid ${col}">
              <span style="font-family:monospace;font-size:12px;font-weight:700;color:#e2e8f0">${esc(id)}</span>
              <span style="font-size:13px;font-weight:700;color:${col}">${r.avgScore}</span>
              <span style="background:${col};color:${textCol};font-size:10px;padding:1px 6px;border-radius:3px">${r.level}</span>
              <span style="font-size:11px;color:#64748b;margin-left:auto">${r.counts.High + r.counts.Critical} High+Critical stories</span>
            </div>`;
            })
            .join('')}
        </div>
      </div>`
          : ''
      }

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
        plugins: { legend: { labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } },
        scales: { x: { stacked: true, ticks: { color: tc } }, y: { stacked: true, ticks: { color: tc, autoSkip: false } } } }
    });
    _charts.costBreakdown = new Chart(document.getElementById('chart-cost-breakdown'), {
      type: 'bar',
      data: { labels: ${epicLabels}, datasets: [
        { label: 'Projected ($)', data: ${epicProjected}, backgroundColor: '#f59e0b', yAxisID: 'yProjected' },
        { label: 'AI Cost ($)', data: ${epicAI}, backgroundColor: '#0d9488', yAxisID: 'yAI' },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } },
        scales: {
          x: { ticks: { color: tc, autoSkip: false, maxRotation: 60, minRotation: 45 } },
          yProjected: { type: 'linear', position: 'left', ticks: { color: tc }, title: { display: true, text: 'Projected ($)', color: tc } },
          yAI: { type: 'linear', position: 'right', ticks: { color: tc }, title: { display: true, text: 'AI Cost ($)', color: tc }, grid: { drawOnChartArea: false } }
        }
      }
    });
    _charts.coverage = new Chart(document.getElementById('chart-coverage'), {
      type: 'doughnut',
      data: { labels: ['Covered', 'Gap'], datasets: [{ data: [${coveragePctNum}, ${coverageGap}], backgroundColor: ['${coveragePct !== null ? '#22c55e' : '#94a3b8'}','#cbd5e1'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: true, position: 'bottom', labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } } }
    });
    _charts.aiTimeline = new Chart(document.getElementById('chart-ai-timeline'), {
      type: 'line',
      data: { labels: ${sessionDates}, datasets: [{ label: 'Cumulative AI Cost ($)', data: ${sessionCosts}, borderColor: '#0d9488', tension: 0.3, fill: true, backgroundColor: 'rgba(13,148,136,0.1)' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } }, scales: { x: { ticks: { color: tc } }, y: { ticks: { color: tc } } } }
    });
    _charts.burndown = new Chart(document.getElementById('chart-burndown'), {
      type: 'doughnut',
      data: { labels: ['Done','In Progress','Planned','To Do','Blocked'], datasets: [{ data: ${statusCounts}, backgroundColor: ['#22c55e','#3b82f6','#94a3b8','#f59e0b','#ef4444'], borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } } }
    });
    _charts.burnRate = new Chart(document.getElementById('chart-burn-rate'), {
      type: 'bar',
      data: { labels: ${sessionDates}, datasets: [{ label: 'Session AI Spend ($)', data: ${sessionPerCosts}, backgroundColor: '#6366f1' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } }, scales: { x: { ticks: { color: tc } }, y: { ticks: { color: tc } } } }
    });
    if (document.getElementById('chart-risk-distribution')) {
      _charts.riskDist = new Chart(document.getElementById('chart-risk-distribution'), {
        type: 'bar',
        data: { labels: ['Low','Medium','High','Critical'], datasets: [{ data: ${riskDistCounts}, backgroundColor: ['#22c55e','#3b82f6','#f59e0b','#ef4444'] }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { color: tc } }, y: { ticks: { color: tc }, beginAtZero: true } } }
      });
    }
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
  const totalProjected = data.stories.reduce(
    (s, st) => s + ((data.costs[st.id] && data.costs[st.id].projectedUsd) || 0),
    0,
  );

  const budget = data.budget || {};
  const hasBudget = budget.hasBudget;

  let budgetSection = '';
  if (hasBudget) {
    const br = budget.burnRate;
    const days = budget.daysRemaining;
    const brDisplay = br > 0 ? `Burn Rate: $${br.toFixed(2)}/day` : 'No recent spend data';
    const exDisplay = days !== null ? `Exhaustion: ${days} days remaining` : br > 0 ? 'Budget unlimited' : '';

    const epicRows = budget.epicBudgets
      .map((eb, i) => {
        const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
        const barPct = eb.percentUsed !== null ? Math.min(100, eb.percentUsed) : 0;
        let barColor = '#22c55e';
        if (eb.percentUsed !== null) {
          if (eb.percentUsed >= 90) barColor = '#ef4444';
          else if (eb.percentUsed >= 75) barColor = '#f97316';
          else if (eb.percentUsed >= 50) barColor = '#eab308';
        }
        const pbClass =
          eb.percentUsed !== null && eb.percentUsed >= 90
            ? 'pb-danger'
            : eb.percentUsed !== null && eb.percentUsed >= 75
              ? 'pb-warn'
              : 'pb-ok';
        return `<tr class="border-t border-slate-100 dark:border-slate-700 anim-stagger" style="--i:${Math.min(i, 19)}">
        <td class="px-3 py-2"><span class="font-mono text-xs font-bold" style="color:${accent.border}">${eb.id}</span></td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${eb.budget !== null ? usd(eb.budget) : '—'}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${usd(eb.spent)}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${eb.remaining !== null ? usd(eb.remaining) : '—'}</td>
        <td class="px-3 py-2">
          ${eb.percentUsed !== null ? `<div class="flex items-center gap-2"><div class="progress-bar"><div class="pb-fill ${pbClass}" style="width:${barPct}%"></div></div><span class="text-xs" style="color:${barColor}">${eb.percentUsed}%</span></div>` : '—'}
        </td>
      </tr>`;
      })
      .join('');

    const csvDownload = options.budgetCSV ? `onclick="downloadBudgetCSV()"` : '';
    const remaining =
      budget.totalBudget !== null && budget.totalBudget !== undefined ? budget.totalBudget - budget.totalSpent : null;
    budgetSection = `
    <div class="card-elev rounded-lg p-4 mb-4">
      <div class="flex flex-wrap items-center gap-6 mb-4">
        <div>
          <span class="text-xs text-slate-500 uppercase">${brDisplay}</span>
        </div>
        <div>
          <span class="text-xs text-slate-500 uppercase">${exDisplay}</span>
        </div>
      </div>
      <div class="flex flex-wrap items-end gap-8 mb-4">
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Budget</div>
          <div class="hero-num text-slate-800 dark:text-slate-100">${usd(budget.totalBudget)}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wide mb-1">Spent</div>
          <div class="hero-num text-slate-800 dark:text-slate-100">${usd(budget.totalSpent)}${deltaArrow(data.deltaSpend)}</div>
        </div>
        <div>
          <div class="text-xs text-slate-500 uppercase tracking-wide mb-1">Remaining</div>
          <div class="hero-num text-slate-800 dark:text-slate-100">${remaining !== null ? usd(remaining) : '—'}</div>
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
  const epicBlocks = data.epics
    .map((epic, epicIdx) => {
      const accent = EPIC_ACCENT_COLORS[epicIdx % EPIC_ACCENT_COLORS.length];
      const epicStories = data.stories.filter((s) => s.epicId === epic.id);
      const epicProjected = epicStories.reduce(
        (s, st) => s + ((data.costs[st.id] && data.costs[st.id].projectedUsd) || 0),
        0,
      );
      const epicAI = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).costUsd || 0), 0);
      const epicIn = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).inputTokens || 0), 0);
      const epicOut = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).outputTokens || 0), 0);
      const ceid = `costs-ep-${jsEsc(epic.id)}`;
      const storyRows = epicStories
        .map((story) => {
          const projected = (data.costs[story.id] && data.costs[story.id].projectedUsd) || 0;
          const ai = data.costs[story.id] || {};
          const storyHistory = (data.costHistory || {})[story.branch] || [];
          const sparkSvg = sparkline(storyHistory.map((h) => h.costUsd));
          return `<tr class="border-t border-slate-100 dark:border-slate-700">
        <td class="px-3 py-2 pl-8 font-mono text-xs text-slate-500 whitespace-nowrap">${story.id}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(story.title)}</td>
        <td class="px-3 py-2 text-center">${badge(story.status)}</td>
        <td class="px-3 py-2 text-center text-sm dark:text-slate-200">${esc(story.estimate || '?')}</td>
        <td class="px-3 py-2 text-right text-sm dark:text-slate-200">${usd(projected)}</td>
        <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${usd(ai.costUsd || 0)}${sparkSvg}</td>
        <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(ai.inputTokens || 0)} / ${fmtNum(ai.outputTokens || 0)}</td>
      </tr>`;
        })
        .join('');
      return `<tbody>
    <tr class="border-t-2 border-slate-300 dark:border-slate-600 cursor-pointer select-none anim-stagger" style="--i:${Math.min(epicIdx, 19)};background:${accent.bg}" onclick="toggleSection('${ceid}','${ceid}-arrow')">
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
    })
    .join('');

  // ── Bug cost helpers (shared by column + card) ──────────────────────────
  const allBugCosts = data.bugs.map(
    (b) => (data.costs._bugs && data.costs._bugs[b.id]) || { costUsd: 0, inputTokens: 0, outputTokens: 0 },
  );
  const bugTotalAI = allBugCosts.reduce((s, bc) => s + (bc.costUsd || 0), 0);
  const bugTotalProjected = allBugCosts.reduce((s, bc) => s + (bc.projectedUsd || 0), 0);
  const bugTotalIn = allBugCosts.reduce((s, bc) => s + (bc.isEstimated ? 0 : bc.inputTokens || 0), 0);
  const bugTotalOut = allBugCosts.reduce((s, bc) => s + (bc.isEstimated ? 0 : bc.outputTokens || 0), 0);

  // ── Bug cost epic grouping ───────────────────────────────────────────────
  const bugCostStoryEpicMap = {};
  data.stories.forEach((s) => {
    bugCostStoryEpicMap[s.id] = s.epicId;
  });
  const bugCostEpicGroupIds = [];
  const bugsByCostEpic = {};
  data.bugs.forEach((bug) => {
    const epicId = bugCostStoryEpicMap[normalizeStoryRef(bug.relatedStory)] || '_ungrouped';
    if (!bugsByCostEpic[epicId]) {
      bugsByCostEpic[epicId] = [];
      bugCostEpicGroupIds.push(epicId);
    }
    bugsByCostEpic[epicId].push(bug);
  });
  const bugCostEpicOrder = [...new Set(bugCostEpicGroupIds)].sort((a, b) => {
    if (a === '_ungrouped') return 1;
    if (b === '_ungrouped') return -1;
    return a.localeCompare(b);
  });

  // ── Column view: bug rows grouped by epic ────────────────────────────────
  const bugColGroups = bugCostEpicOrder
    .map((epicId, i) => {
      const bugs = bugsByCostEpic[epicId];
      const epic = data.epics.find((e) => e.id === epicId);
      const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
      const label = epic ? `${epicId}: ${esc(epic.title)}` : epicId === '_ungrouped' ? 'No Epic' : epicId;
      const bceid = `bug-costs-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const epicProjected = bugs.reduce(
        (s, b) => s + ((data.costs._bugs && data.costs._bugs[b.id] && data.costs._bugs[b.id].projectedUsd) || 0),
        0,
      );
      const epicAI = bugs.reduce(
        (s, b) => s + ((data.costs._bugs && data.costs._bugs[b.id] && data.costs._bugs[b.id].costUsd) || 0),
        0,
      );
      const epicIn = bugs.reduce(
        (s, b) =>
          s +
          (data.costs._bugs && data.costs._bugs[b.id] && !data.costs._bugs[b.id].isEstimated
            ? data.costs._bugs[b.id].inputTokens || 0
            : 0),
        0,
      );
      const epicOut = bugs.reduce(
        (s, b) =>
          s +
          (data.costs._bugs && data.costs._bugs[b.id] && !data.costs._bugs[b.id].isEstimated
            ? data.costs._bugs[b.id].outputTokens || 0
            : 0),
        0,
      );
      const bugRows = bugs
        .map((bug) => {
          const bc = (data.costs._bugs && data.costs._bugs[bug.id]) || { costUsd: 0, inputTokens: 0, outputTokens: 0 };
          return `<tr class="border-t border-slate-100 dark:border-slate-700">
        <td class="px-3 py-2 pl-8 font-mono text-xs text-slate-500 whitespace-nowrap">${esc(bug.id)}</td>
        <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(bug.title)}</td>
        <td class="px-3 py-2 text-center">${badge(bug.severity)}</td>
        <td class="px-3 py-2 text-center">${badge(bug.status)}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.relatedStory || '—')}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${esc(bug.fixBranch || '—')}</td>
        <td class="px-3 py-2 text-right text-sm dark:text-slate-200">${bc.projectedUsd > 0 ? usd(bc.projectedUsd) : '—'}</td>
        <td class="px-3 py-2 text-right text-sm text-teal-700 dark:text-teal-400">${bc.costUsd > 0 ? (bc.isEstimated ? `<span title="Estimated cost">≈${usd(bc.costUsd)}</span>` : usd(bc.costUsd)) : '—'}</td>
        <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${bc.isEstimated ? '—' : `${fmtNum(bc.inputTokens)} / ${fmtNum(bc.outputTokens)}`}</td>
      </tr>`;
        })
        .join('');
      return `<tbody>
    <tr class="border-t-2 border-slate-300 dark:border-slate-600 cursor-pointer select-none bug-epic-header" data-epic="${esc(epicId)}" style="background:${accent.bg}" onclick="toggleSection('${jsEsc(bceid)}','${jsEsc(bceid)}-arrow')">
      <td colspan="6" class="px-3 py-2">
        <span id="${bceid}-arrow" class="text-slate-400 text-xs mr-2">&#9660;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-2 text-xs text-slate-500 bug-count">(${bugs.length})</span>
      </td>
      <td class="px-3 py-2 text-right text-sm font-medium dark:text-slate-200">${epicProjected > 0 ? usd(epicProjected) : '—'}</td>
      <td class="px-3 py-2 text-right text-sm font-medium text-teal-700 dark:text-teal-400">${usd(epicAI)}</td>
      <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(epicIn)} / ${fmtNum(epicOut)}</td>
    </tr>
    </tbody><tbody id="${bceid}">${bugRows}</tbody>`;
    })
    .join('');

  // ── Card view: story cards grouped by epic ──────────────────────────────
  const epicCardBlocks = data.epics
    .map((epic) => {
      const epicStories = data.stories.filter((s) => s.epicId === epic.id);
      if (!epicStories.length) return '';
      const storyCards = epicStories
        .map((story) => {
          const ai = data.costs[story.id] || {};
          const projected = ai.projectedUsd || 0;
          return `<div class="card-elev rounded-lg p-4 flex flex-col gap-2">
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
        })
        .join('');
      const epicProjTotal = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).projectedUsd || 0), 0);
      const epicAITotal = epicStories.reduce((s, st) => s + ((data.costs[st.id] || {}).costUsd || 0), 0);
      const cceid = `costs-card-ep-${jsEsc(epic.id)}`;
      const accent2 = EPIC_ACCENT_COLORS[data.epics.indexOf(epic) % EPIC_ACCENT_COLORS.length];
      return `<div class="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" style="border-left:4px solid ${accent2.border}">
      <div class="flex items-center gap-2 px-3 py-2 flex-wrap cursor-pointer select-none" style="background:${accent2.bg}" onclick="toggleSection('${cceid}','${cceid}-arrow')">
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
    })
    .join('');

  // ── Card view: bug cards grouped by epic ────────────────────────────────
  const bugCardEpicBlocks = bugCostEpicOrder
    .map((epicId, i) => {
      const bugs = bugsByCostEpic[epicId];
      const epic = data.epics.find((e) => e.id === epicId);
      const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
      const label = epic ? `${epicId}: ${esc(epic.title)}` : epicId === '_ungrouped' ? 'No Epic' : epicId;
      const bcceid = `bug-costs-card-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const epicBugProjected = bugs.reduce(
        (s, b) => s + ((data.costs._bugs && data.costs._bugs[b.id] && data.costs._bugs[b.id].projectedUsd) || 0),
        0,
      );
      const epicBugAI = bugs.reduce(
        (s, b) =>
          s +
          (data.costs._bugs && data.costs._bugs[b.id] && !data.costs._bugs[b.id].isEstimated
            ? data.costs._bugs[b.id].costUsd || 0
            : 0),
        0,
      );
      const bugCardItems = bugs
        .map((bug) => {
          const bc = (data.costs._bugs && data.costs._bugs[bug.id]) || {};
          return `<div class="card-elev rounded-lg p-4 flex flex-col gap-2">
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
        })
        .join('');
      return `<div class="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bug-epic-card" data-epic="${esc(epicId)}" style="border-left:4px solid ${accent.border}">
      <div class="flex items-center gap-2 px-3 py-2 flex-wrap cursor-pointer select-none bug-epic-header" data-epic="${esc(epicId)}" style="background:${accent.bg}" onclick="toggleSection('${jsEsc(bcceid)}','${jsEsc(bcceid)}-arrow')">
        <span id="${bcceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-2 text-xs text-slate-500 bug-count">(${bugs.length})</span>
        <span class="ml-auto text-xs text-slate-500">Proj ${usd(epicBugProjected)} · AI ${usd(epicBugAI)}</span>
      </div>
      <div id="${bcceid}" class="p-3 hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${bugCardItems}</div>
      </div>
    </div>`;
    })
    .join('');

  const bugFixColumnSection = data.bugs.length
    ? `
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
    </div>`
    : '';

  const bugFixCardSection = data.bugs.length
    ? `
    <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-6 mb-3">Bug Fix Costs</h3>
    ${bugCardEpicBlocks}`
    : '';

  return `
  <div id="tab-costs" class="p-6 hidden" role="tabpanel" aria-labelledby="tab-btn-costs">
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

    <div id="costs-column-view" class="flex flex-col">
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

    <div id="costs-card-view" class="hidden">
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

  // AC-0351: severity tone helper
  function severityTone(sev) {
    if (!sev) return 'neutral';
    const s = sev.toLowerCase();
    if (s === 'critical' || s === 'high') return 'danger';
    if (s === 'medium') return 'warn';
    return 'neutral';
  }

  // AC-0352: severity stripe color helper
  function severityStripeColor(sev) {
    if (!sev) return 'transparent';
    const s = sev.toLowerCase();
    if (s === 'critical' || s === 'high') return 'var(--badge-danger-text, #dc2626)';
    if (s === 'medium') return 'var(--badge-warn-text, #d97706)';
    return 'var(--badge-neutral-text, #6b7280)';
  }

  // AC-0351: severity badge with badge-sev class
  const sevBadge = (sev) => `<span class="badge badge-${severityTone(sev)} badge-sev">${esc(sev || '')}</span>`;

  const lessonCell = (bug) => {
    if (!bug.lessonEncoded || !bug.lessonEncoded.startsWith('Yes')) return '○';
    const lm = bug.lessonEncoded.match(/L-\d{4}/);
    if (!lm) return '✓';
    // AC-0354: lesson pill link
    return `<a href="#" onclick="showTab('lessons');setTimeout(function(){var colView=document.getElementById('lessons-column-view');var prefix=colView&&!colView.classList.contains('hidden')?'lesson-col-':'lesson-card-';var el=document.getElementById(prefix+'${lm[0]}');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},50);return false;" title="View lesson ${lm[0]}" style="text-decoration:none"><span class="lesson-pill"><span class="lesson-pill-id">${esc(lm[0])}</span><span>↗</span></span></a>`;
  };

  // Build story→epic map
  const storyEpicMap = {};
  data.stories.forEach((s) => {
    storyEpicMap[s.id] = s.epicId;
  });

  // Group bugs by epic
  const bugEpicIds = [];
  const bugsByEpic = {};
  data.bugs.forEach((bug) => {
    const epicId = storyEpicMap[normalizeStoryRef(bug.relatedStory)] || '_ungrouped';
    if (!bugsByEpic[epicId]) {
      bugsByEpic[epicId] = [];
      bugEpicIds.push(epicId);
    }
    bugsByEpic[epicId].push(bug);
  });
  const bugEpicOrder = [...new Set(bugEpicIds)].sort((a, b) => {
    if (a === '_ungrouped') return 1;
    if (b === '_ungrouped') return -1;
    return a.localeCompare(b);
  });

  // BUG-0165 / AC-0352 — severity stripe on the first td of every row.
  const renderBugRow = (bug, accent, bugIdx = 0) => {
    const epicId = storyEpicMap[normalizeStoryRef(bug.relatedStory)] || '_ungrouped';
    const severityLeft = `border-left:4px solid ${severityStripeColor(bug.severity)};`;
    return `
    <tr id="bug-row-${esc(bug.id)}" class="bug-row border-t border-slate-100 dark:border-slate-700 anim-stagger" style="--i:${Math.min(bugIdx, 19)}" data-status="${esc(bug.status)}" data-epic="${esc(epicId)}" data-severity="${esc(bug.severity)}">
      <td class="px-3 py-2 font-mono text-xs whitespace-nowrap dark:text-slate-200" style="${severityLeft}">${esc(bug.id)}</td>
      <td class="px-3 py-2 text-sm dark:text-slate-200">${esc(bug.title)}</td>
      <td class="px-3 py-2 text-center">${sevBadge(bug.severity)}</td>
      <td class="px-3 py-2 text-center">${badge(bug.status)}</td>
      <td class="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">${esc(bug.relatedStory)}</td>
      <td class="px-3 py-2 text-xs text-slate-500"><span class="truncate" title="${esc(bug.fixBranch || '')}">${esc(bug.fixBranch || '—')}<button class="copy-btn" onclick="navigator.clipboard.writeText('${jsEsc(bug.fixBranch || '')}')">&#x29c7;</button></span></td>
      <td class="px-3 py-2 text-center text-xs dark:text-slate-200">${lessonCell(bug)}</td>
    </tr>`;
  };

  // AC-0352: bug cards get border-left severity stripe
  const renderBugCard = (bug, bugIdx = 0) => {
    const epicId = storyEpicMap[normalizeStoryRef(bug.relatedStory)] || '_ungrouped';
    return `
    <div id="bug-card-${esc(bug.id)}" class="bug-row story-card-hover card-elev rounded-lg p-4 flex flex-col gap-2 anim-stagger" style="--i:${Math.min(bugIdx, 19)};border-left:4px solid ${severityStripeColor(bug.severity)}" data-status="${esc(bug.status)}" data-epic="${esc(epicId)}" data-severity="${esc(bug.severity)}">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-mono text-xs text-slate-500 whitespace-nowrap">${esc(bug.id)}</span>
        ${sevBadge(bug.severity)} ${badge(bug.status)}
      </div>
      <p class="text-sm font-medium dark:text-slate-200">${esc(bug.title)}</p>
      <div class="text-xs text-slate-500 flex flex-col gap-0.5">
        <span>Story: <span class="font-mono">${esc(bug.relatedStory || '—')}</span></span>
        <span class="truncate" title="${esc(bug.fixBranch || '')}">Branch: <span class="font-mono">${esc(bug.fixBranch || '—')}</span><button class="copy-btn" onclick="navigator.clipboard.writeText('${jsEsc(bug.fixBranch || '')}')">&#x29c7;</button></span>
      </div>
      <div class="flex items-center justify-between mt-1">
        <span class="text-xs text-slate-500">Lesson: <span class="dark:text-slate-200">${lessonCell(bug)}</span></span>
      </div>
    </div>`;
  };

  const openBugCount = (bugs) =>
    bugs.filter((b) => !/^(Fixed|Retired|Cancelled|Verified|Closed)/i.test(b.status)).length;

  // AC-0355: compact view rows (flat, no epic grouping)
  const compactRows = data.bugs
    .map(
      (bug) => `
    <div class="bug-compact-row" data-status="${esc(bug.status)}" data-severity="${esc(bug.severity)}" data-epic="${esc(storyEpicMap[normalizeStoryRef(bug.relatedStory)] || '_ungrouped')}" style="border-left:4px solid ${severityStripeColor(bug.severity)}">
      <span class="bug-compact-id">${esc(bug.id)}</span>
      <span class="bug-compact-title">${esc(bug.title)}</span>
      ${sevBadge(bug.severity)}
      <span class="badge badge-${BADGE_TONE[bug.status] || 'neutral'}">${esc(bug.status)}</span>
    </div>`,
    )
    .join('');

  const bugColGroups = bugEpicOrder
    .map((epicId, i) => {
      const bugs = bugsByEpic[epicId];
      const epic = data.epics.find((e) => e.id === epicId);
      const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
      const beid = `bugs-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const open = openBugCount(bugs);
      const titlePart = epic
        ? `<span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>`
        : epicId === '_ungrouped'
          ? `<span class="italic text-slate-500">No Epic</span>`
          : '';
      // BUG-0165 — header mirrors Hierarchy: left-accent bar, epic-id +
      // status badge + title + aggregate counter on the right.
      // BUG-0167 — default-collapsed to match Hierarchy; &#9654; arrow + hidden tbody.
      return `<tbody>
    <tr class="border-t-2 border-slate-300 dark:border-slate-600 cursor-pointer select-none bug-epic-header" data-epic="${epicId}" style="background:${accent.bg}" onclick="toggleSection('${beid}','${beid}-arrow')">
      <td colspan="7" class="px-3 py-2" style="border-left:4px solid ${accent.border};">
        <div class="flex flex-wrap items-center gap-3">
          <span id="${beid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
          <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epicId}</span>
          ${epic ? badge(epic.status) : ''}
          ${titlePart}
          <span class="ml-auto text-xs text-slate-500 bug-count">${open} open &middot; ${bugs.length} total</span>
        </div>
      </td>
    </tr>
    </tbody><tbody id="${beid}" class="hidden">${bugs.map((b, bugIdx) => renderBugRow(b, accent, bugIdx)).join('')}</tbody>`;
    })
    .join('');

  const bugCardGroups = bugEpicOrder
    .map((epicId, i) => {
      const bugs = bugsByEpic[epicId];
      const epic = data.epics.find((e) => e.id === epicId);
      const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
      const bceid = `bugs-card-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const open = openBugCount(bugs);
      const titlePart = epic
        ? `<span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>`
        : epicId === '_ungrouped'
          ? `<span class="italic text-slate-500">No Epic</span>`
          : '';
      // BUG-0168 — mb-2 matches Hierarchy's tight spacing between epic groups.
      return `<div class="mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bug-epic-card" data-epic="${epicId}" style="border-left:4px solid ${accent.border}">
      <div class="flex flex-wrap items-center gap-3 px-3 py-2 cursor-pointer select-none bug-epic-header" data-epic="${epicId}" style="background:${accent.bg}" onclick="toggleSection('${bceid}','${bceid}-arrow')">
        <span id="${bceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
        <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epicId}</span>
        ${epic ? badge(epic.status) : ''}
        ${titlePart}
        <span class="ml-auto text-xs text-slate-500 bug-count">${open} open &middot; ${bugs.length} total</span>
      </div>
      <div id="${bceid}" class="p-3 hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${bugs.map((b, bugIdx) => renderBugCard(b, bugIdx)).join('')}</div>
      </div>
    </div>`;
    })
    .join('');

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
        <button id="bugs-compact-btn" onclick="setBugsView('compact')"
          class="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          ☰ Compact
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

    <div id="bugs-compact-view" class="hidden" style="overflow-y:auto">
      ${compactRows}
    </div>
  </div>
  <script>
  function setBugsView(v) {
    var col = document.getElementById('bugs-column-view');
    var card = document.getElementById('bugs-card-view');
    var compact = document.getElementById('bugs-compact-view');
    var colBtn = document.getElementById('bugs-col-btn');
    var cardBtn = document.getElementById('bugs-card-btn');
    var compactBtn = document.getElementById('bugs-compact-btn');
    if (!col) return;
    col.classList.toggle('hidden', v !== 'column');
    card.classList.toggle('hidden', v !== 'card');
    if (compact) compact.classList.toggle('hidden', v !== 'compact');
    colBtn.style.fontWeight = v === 'column' ? '700' : '';
    colBtn.style.background = v === 'column' ? 'rgba(59,130,246,0.1)' : '';
    cardBtn.style.fontWeight = v === 'card' ? '700' : '';
    cardBtn.style.background = v === 'card' ? 'rgba(59,130,246,0.1)' : '';
    if (compactBtn) { compactBtn.style.fontWeight = v === 'compact' ? '700' : ''; compactBtn.style.background = v === 'compact' ? 'rgba(59,130,246,0.1)' : ''; }
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

  // US-0107 AC-0357: Category icon derived from keyword match in rule text
  function categoryIcon(rule) {
    const r = (rule || '').toLowerCase();
    if (/security|auth|credential|secret|token|inject/.test(r)) return '🔒';
    if (/performance|cache|slow|memory|latency|timeout/.test(r)) return '⚡';
    if (/test|coverage|mock|assert|spec/.test(r)) return '🧪';
    return '💡';
  }

  // US-0107 AC-0358: Related bug inline expansion with severity dot
  function lessonBugDetails(l, bugs) {
    // Use l.bugIds (from parseLessons) or fall back to BUG-XXXX in lessonEncoded
    const bugIds =
      l.bugIds && l.bugIds.length > 0
        ? l.bugIds
        : (() => {
            const m = (l.lessonEncoded || '').match(/BUG-\d{4}/);
            return m ? [m[0]] : [];
          })();
    if (!bugIds.length) return '';
    return bugIds
      .map((bugId) => {
        const bug = (bugs || []).find((b) => b.id === bugId);
        if (!bug) return `<span class="text-xs text-slate-400">${esc(bugId)}</span>`;
        const dotColor =
          bug.severity === 'Critical' || bug.severity === 'High'
            ? 'var(--badge-danger-text,#dc2626)'
            : bug.severity === 'Medium'
              ? 'var(--badge-warn-text,#d97706)'
              : 'var(--badge-neutral-text,#64748b)';
        return `<details class="lesson-bug-inline">
    <summary class="cursor-pointer text-xs text-slate-500 hover:text-slate-700 list-none flex items-center gap-1">
      <span class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background:${dotColor}"></span>
      <span class="font-mono">${esc(bugId)}</span>
    </summary>
    <div class="mt-1 text-xs text-slate-600 dark:text-slate-400 pl-3">
      ${esc(bug.title || '')} — <span class="badge badge-${BADGE_TONE[bug.severity] || 'neutral'}">${esc(bug.severity || '')}</span>
    </div>
  </details>`;
      })
      .join('');
  }

  // Build lesson→epic grouping via lesson→bug→story→epic
  const lessonStoryMap = {};
  for (const bug of data.bugs) {
    const m = bug.lessonEncoded && bug.lessonEncoded.match(/L-\d{4}/);
    if (m) lessonStoryMap[m[0]] = normalizeStoryRef(bug.relatedStory);
  }
  const lessonStoryEpicMap = {};
  data.stories.forEach((s) => {
    lessonStoryEpicMap[s.id] = s.epicId;
  });

  const lessonEpicIds = [];
  const lessonsByEpic = {};
  lessons.forEach((l) => {
    const storyId = lessonStoryMap[l.id];
    const epicId = (storyId && lessonStoryEpicMap[storyId]) || '_ungrouped';
    if (!lessonsByEpic[epicId]) {
      lessonsByEpic[epicId] = [];
      lessonEpicIds.push(epicId);
    }
    lessonsByEpic[epicId].push(l);
  });
  const lessonEpicOrder = [...new Set(lessonEpicIds)];

  const renderLessonRow = (l) => `
  <tr id="lesson-col-${l.id}" class="lesson-row border-t border-slate-100 dark:border-slate-700 align-top">
    <td class="px-3 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">${l.id}</td>
    <td class="px-3 py-3 text-sm text-slate-700 dark:text-slate-200">${esc(l.rule)}</td>
    <td class="px-3 py-3 text-sm text-slate-500 dark:text-slate-400 italic">${esc(l.context)}</td>
    <td class="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">${l.date ? l.date.slice(0, 7) : '—'}</td>
    <td class="px-3 py-3 text-xs whitespace-nowrap">${bugRefLink(l.id)}</td>
  </tr>`;

  const renderLessonCard = (l, accent, lessonIdx = 0) => `
  <div id="lesson-card-${l.id}" class="lesson-row story-card-hover card-elev lesson-accent-bar rounded-lg p-4 flex flex-col gap-2 anim-stagger" style="--i:${Math.min(lessonIdx, 19)};border-left:4px solid ${accent.border}">
    <div class="flex items-center gap-2">
      <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap flex-shrink-0">${l.id}</span>
      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${esc(l.title)}</span>
    </div>
    <hr class="border-slate-100 dark:border-slate-700">
    <div>
      <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Rule</span>
      <p class="text-sm text-slate-700 dark:text-slate-200 mt-0.5"><span class="lesson-cat-icon">${categoryIcon(l.rule)}</span>${esc(l.rule)}</p>
    </div>
    <div>
      <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Context</span>
      <p class="text-sm text-slate-500 dark:text-slate-400 italic mt-0.5">${esc(l.context)}</p>
    </div>
    <div class="flex items-center justify-between mt-1">
      <span class="text-xs text-slate-400">${l.date ? l.date.slice(0, 7) : '—'}</span>
      <span class="text-xs text-slate-500">${lessonBugDetails(l, data.bugs) || `Bug ref: ${bugRefLink(l.id)}`}</span>
    </div>
  </div>`;

  const lessonColGroups = lessonEpicOrder
    .map((epicId, i) => {
      const ls = lessonsByEpic[epicId];
      const epic = data.epics.find((e) => e.id === epicId);
      const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
      const label = epic ? `${epicId}: ${esc(epic.title)}` : epicId === '_ungrouped' ? 'No Epic' : epicId;
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
    })
    .join('');

  const lessonCardGroups = lessonEpicOrder
    .map((epicId, i) => {
      const ls = lessonsByEpic[epicId];
      const epic = data.epics.find((e) => e.id === epicId);
      const accent = EPIC_ACCENT_COLORS[i % EPIC_ACCENT_COLORS.length];
      const label = epic ? `${epicId}: ${esc(epic.title)}` : epicId === '_ungrouped' ? 'No Epic' : epicId;
      const lceid = `lessons-card-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      return `<div class="mb-6 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" style="border-left:4px solid ${accent.border}">
      <div class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('${lceid}','${lceid}-arrow')">
        <span id="${lceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-1 text-xs text-slate-500">(${ls.length})</span>
      </div>
      <div id="${lceid}" class="p-3 hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${ls.map((l, lessonIdx) => renderLessonCard(l, accent, lessonIdx)).join('')}</div>
      </div>
    </div>`;
    })
    .join('');

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
  const items = data.recentActivity
    .map(
      (a) =>
        `<li class="py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span class="text-xs text-slate-500 block">Session ${a.sessionNum} &middot; ${a.date}</span>
      <span class="text-sm text-slate-700 dark:text-slate-200">${esc(a.summary)}</span>
    </li>`,
    )
    .join('');
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

module.exports = {
  renderHierarchyTab,
  renderKanbanTab,
  renderTraceabilityTab,
  renderTrendsTab,
  renderChartsTab,
  renderCostsTab,
  renderBugsTab,
  renderLessonsTab,
  renderRecentActivity,
};
