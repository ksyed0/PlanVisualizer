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
          <span id="epic-arrow-${esc(epic.id)}" class="text-slate-400 text-xs w-3 flex-shrink-0">▼</span>
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
    <div class="mb-2 anim-stagger" style="--i:${Math.min(epicIdx, 19)}">
      <div class="epic-block border border-slate-200 dark:border-slate-700 rounded-t-lg px-3 py-2 mb-0 cursor-pointer select-none" style="border-left:4px solid ${accent.border};background:${accent.bg}" onclick="toggleSection('epic-cards-${jsEsc(epic.id)}','epic-card-arrow-${jsEsc(epic.id)}')">
        <div class="flex flex-wrap items-center gap-3">
          <span id="epic-card-arrow-${esc(epic.id)}" class="text-slate-400 text-xs w-3 flex-shrink-0">▼</span>
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
  const SWIM_COLORS = [
    'oklch(56% 0.22 290)',
    'oklch(50% 0.19 232)',
    'oklch(57% 0.17 58)',
    'oklch(46% 0.15 148)',
    'oklch(44% 0.20 12)',
    'oklch(48% 0.22 300)',
    'oklch(52% 0.14 196)',
    'oklch(54% 0.14 65)',
  ];

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
      s.priority === 'P0' ? 'var(--badge-danger-text)' : s.priority === 'P1' ? 'var(--badge-warn-text)' : 'transparent';
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
      const epicObj = (data.epics || []).find((e) => e.id === epicId);
      const epicLabel = epicObj ? `${esc(epicId)}: ${esc(epicObj.title)}` : esc(epicId);
      const epicCount = data.stories.filter((s) => s.epicId === epicId).length;
      const sid = `ksw-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      return `
    <div class="ksw-swimlane" style="border-left:3px solid ${color}">
      <div class="ksw-swim-hdr" onclick="toggleKsw('${sid}')" style="border-left-color:${color}">
        <span id="${sid}-arrow" class="ksw-arrow">▶</span>
        <span class="ksw-epic-title" style="color:${color}">${epicLabel}</span>
        ${epicObj ? badge(epicObj.status) : ''}
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
    <div class="ksw-swimlane" style="border-left:3px solid var(--text-muted,var(--text-dim))">
      <div class="ksw-swim-hdr" onclick="toggleKsw('${sid}')" style="border-left-color:var(--text-muted,var(--text-dim))">
        <span id="${sid}-arrow" class="ksw-arrow">▶</span>
        <span class="ksw-epic-title" style="color:var(--text-muted,var(--text-dim))">No Epic</span>
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
          <span id="${epicRowId}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">▶</span>
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
      <div class="chart-header-rule"><span class="display-title">Velocity</span><span class="chart-subtitle">cumulative done points</span></div>
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
var pvChartColors = (function() {
  var cs = getComputedStyle(document.documentElement);
  function tok(v, fb) { var r = cs.getPropertyValue(v).trim(); return r || fb; }
  return {
    ok:     tok('--ok',          'oklch(68% 0.15 150)'),
    warn:   tok('--warn',        'oklch(74% 0.16 78)'),
    risk:   tok('--risk',        'oklch(64% 0.20 25)'),
    info:   tok('--info',        'oklch(66% 0.14 240)'),
    accent: tok('--plan-accent', 'oklch(62% 0.19 268)'),
    mute:   tok('--text-mute',   'oklch(70% 0.012 95)'),
  };
})();
var _trendsAllLabels = ${datesJson};
var _trendsAllData = {
  done: ${doneJson}, total: ${totalJson}, cost: ${costJson},
  coverage: ${coverageJson}, velocity: ${velocityJson},
  bugs: ${bugsJson}, risk: ${riskJson},
  inputTokens: ${inputTokensJson}, outputTokens: ${outputTokensJson},
  avgRisk: ${avgRiskJson}
};
var _trendsChartRefs = {};
function _cssToRgb(color) {
  var c = document.createElement('canvas'); c.width = c.height = 1;
  var x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0,0,1,1);
  var d = x.getImageData(0,0,1,1).data;
  return { r: d[0], g: d[1], b: d[2] };
}
function _trendGrad(ctx, color) {
  var rgb = _cssToRgb(color);
  var r = rgb.r, g = rgb.g, b = rgb.b;
  var grad = ctx.createLinearGradient(0,0,0,200);
  var fn = ['r','g','b'].join(''); // assemble color function name at runtime
  grad.addColorStop(0, fn+'('+r+' '+g+' '+b+' / 0.35)');
  grad.addColorStop(1, fn+'('+r+' '+g+' '+b+' / 0.0)');
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
  var gc = document.documentElement.getAttribute('data-theme') === 'dark' ? 'oklch(100% 0 0 / 0.07)' : 'oklch(88% 0.010 95)';
  var labels = _trendsAllLabels; if (labels.length < 2) return;
  var xA = { ticks:{ color:tc, maxTicksLimit:8, callback:function(v){ var d=new Date(this.getLabelForValue(v)); return isNaN(d)?v:(d.getMonth()+1)+'/'+d.getDate(); }}, grid:{color:gc} };
  var yA = function(o){ return Object.assign({ticks:{color:tc},grid:{color:gc},beginAtZero:true},o||{}); };
  var leg = { labels:{color:tc, font:{family:"'Inter',sans-serif",size:12}, pointStyle:'circle', usePointStyle:true }};
  _mkTrend('chart-trends-progress', {type:'line', data:{labels:labels, datasets:[
    {label:'Done', data:_trendsAllData.done, borderColor:pvChartColors.ok, _gc:pvChartColors.ok, fill:true, tension:0.3},
    {label:'Total', data:_trendsAllData.total, borderColor:pvChartColors.mute, backgroundColor:'transparent', borderDash:[5,5], tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA()}}});
  _mkTrend('chart-trends-velocity', {type:'bar', data:{labels:labels, datasets:[
    {label:'Story Points', data:_trendsAllData.velocity, backgroundColor:pvChartColors.info}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA()}}});
  _mkTrend('chart-trends-cost', {type:'line', data:{labels:labels, datasets:[
    {label:'Total Cost ($)', data:_trendsAllData.cost, borderColor:pvChartColors.warn, _gc:pvChartColors.warn, fill:true, tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA()}}});
  _mkTrend('chart-trends-tokens', {type:'line', data:{labels:labels, datasets:[
    {label:'Input', data:_trendsAllData.inputTokens, borderColor:pvChartColors.info, _gc:pvChartColors.info, fill:true},
    {label:'Output', data:_trendsAllData.outputTokens, borderColor:pvChartColors.accent, _gc:pvChartColors.accent, fill:true}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA({ticks:{color:tc,callback:function(v){return v>=1e6?(v/1e6).toFixed(0)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v;}}})}}});
  _mkTrend('chart-trends-coverage', {type:'line', data:{labels:labels, datasets:[
    {label:'Coverage %', data:_trendsAllData.coverage, borderColor:pvChartColors.accent, _gc:pvChartColors.accent, fill:true, tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA({min:0,max:100})}}});
  _mkTrend('chart-trends-bugs', {type:'line', data:{labels:labels, datasets:[
    {label:'Open Bugs', data:_trendsAllData.bugs, borderColor:pvChartColors.risk, _gc:pvChartColors.risk, fill:true, tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA()}}});
  _mkTrend('chart-trends-risk', {type:'line', data:{labels:labels, datasets:[
    {label:'At-Risk', data:_trendsAllData.risk, borderColor:pvChartColors.warn, _gc:pvChartColors.warn, fill:true, tension:0.3}
  ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:leg}, scales:{x:xA,y:yA({suggestedMax:5})}}});
  _mkTrend('chart-trends-avg-risk', {type:'line', data:{labels:labels, datasets:[
    {label:'Avg Risk Score', data:_trendsAllData.avgRisk, borderColor:pvChartColors.warn, _gc:pvChartColors.warn, fill:true, tension:0.3}
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

// US-0135: Status hero card — answers "is the release on track?" in one glance.
// Read-only dependency on data.completion (EPIC-0010 artifact) — not modified.
function _renderStatusHero(data) {
  const activeStories = data.stories.filter((s) => s.status !== 'Retired');
  const done = activeStories.filter((s) => s.status === 'Done').length;
  const total = activeStories.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const openBugs = (data.bugs || []).filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status));
  const criticalBugs = openBugs.filter((b) => ['Critical', 'High'].includes(b.severity)).length;
  const blockedStories = activeStories.filter((s) => s.status === 'Blocked').length;

  let verdict, verdictTone, narrative;
  if (criticalBugs > 0 || blockedStories > 1) {
    verdict = 'Off track';
    verdictTone = 'risk';
    narrative = `${criticalBugs} critical/high ${criticalBugs === 1 ? 'bug' : 'bugs'} and ${blockedStories} blocked ${blockedStories === 1 ? 'story' : 'stories'} require immediate attention.`;
  } else if (criticalBugs > 0 || blockedStories > 0 || pct < 50) {
    verdict = 'At risk';
    verdictTone = 'warn';
    narrative = `Release is progressing at ${pct}% with minor blockers to resolve.`;
  } else {
    verdict = 'On track';
    verdictTone = 'ok';
    narrative = `Release is ${pct}% complete with no critical blockers.`;
  }

  // Forecast — from EPIC-0010 data.completion (read-only)
  const comp = data.completion;
  const forecastHtml =
    comp && comp.likelyDate
      ? `<span class="pv-stat-val tnum">${esc(comp.likelyDate)}</span>`
      : '<span class="pv-stat-val">—</span>';

  // Velocity
  const velocityArr = (data.trends && data.trends.velocity) || [];
  const lastVel = velocityArr.length > 0 ? velocityArr[velocityArr.length - 1] : null;
  const prevVel = velocityArr.length > 1 ? velocityArr[velocityArr.length - 2] : null;
  const velDelta = lastVel !== null && prevVel !== null ? lastVel - prevVel : null;
  const velHtml =
    lastVel !== null
      ? `<span class="pv-stat-val tnum">${lastVel.toFixed(1)} <span class="pv-delta ${velDelta !== null && velDelta >= 0 ? 'up' : 'dn'}">${velDelta !== null && velDelta >= 0 ? '▲' : '▼'} ${Math.abs(velDelta || 0).toFixed(1)}</span></span>`
      : '<span class="pv-stat-val">—</span>';

  // Budget
  const budget = data.budget || {};
  const budgetHtml =
    budget.hasBudget && budget.percentUsed !== null
      ? `<span class="pv-stat-val tnum">${budget.percentUsed}%</span>`
      : '<span class="pv-stat-val">—</span>';

  // 30-day coverage heat strip
  const covHistory = (data.trends && data.trends.coverage) || [];
  const cells30 = Array.from({ length: 30 }, (_, i) => {
    const val = covHistory[covHistory.length - 30 + i];
    if (val === null || val === undefined) return '<span class="pv-heat-cell" style="opacity:0.15"></span>';
    const tone = val >= 80 ? 'var(--ok)' : val >= 60 ? 'var(--warn)' : 'var(--risk)';
    return `<span class="pv-heat-cell" style="background:${tone};opacity:${(0.3 + (val / 100) * 0.7).toFixed(2)}" title="${val.toFixed(1)}%"></span>`;
  }).join('');

  return `
  <div class="pv-hero card" style="margin-bottom:16px">
    <div class="pv-hero-head">
      <div class="pv-hero-verdict" style="position:relative">
        <div class="pv-hero-toggle" role="group" aria-label="Density">${['L', 'M', 'S'].map((d) => `<button class="pv-hero-density-btn${d === 'M' ? ' pv-hero-active' : ''}" data-density="${d}" onclick="pvHeroDensity('${d}')">${d}</button>`).join('')}</div>
        <span class="chip ${verdictTone}"><span class="d"></span>${esc(verdict)}</span>
        <p class="pv-hero-narrative">${esc(narrative)}</p>
      </div>
      <div class="pv-hero-stats">
        <div class="pv-stat">
          <span class="pv-stat-lbl">Forecast</span>
          ${forecastHtml}
        </div>
        <div class="pv-stat">
          <span class="pv-stat-lbl">Velocity</span>
          ${velHtml}
        </div>
        <div class="pv-stat">
          <span class="pv-stat-lbl">Budget</span>
          ${budgetHtml}
        </div>
      </div>
    </div>
    <div class="pv-hero-vizrow pv-hero-viz">
      <div class="pv-heat" aria-label="30-day coverage heat strip">${cells30}</div>
    </div>
  </div>`;
}

function _renderDecisionWidgets(data) {
  const openBugs = (data.bugs || []).filter((b) => !/^(Fixed|Retired|Cancelled)/i.test(b.status));
  const critHighBugs = openBugs.filter((b) => ['Critical', 'High'].includes(b.severity));
  const activeStories = data.stories.filter((s) => s.status !== 'Retired');
  const blockedStories = activeStories.filter((s) => s.status === 'Blocked');
  const now = Date.now();
  const overdueEpics = (data.epics || []).filter((e) => {
    if (e.status === 'Done') return false;
    if (!e.releaseTarget) return false;
    const d = new Date(e.releaseTarget);
    return !isNaN(d) && d < now;
  });

  const riskItems = [
    ...critHighBugs
      .slice(0, 3)
      .map(
        (b) =>
          `<div class="pv-risk-item"><span class="chip risk">${esc(b.severity)}</span><span class="pv-risk-label">${esc(b.id)}: ${esc(b.title)}</span></div>`,
      ),
    ...blockedStories
      .slice(0, 2)
      .map(
        (s) =>
          `<div class="pv-risk-item"><span class="chip warn">Blocked</span><span class="pv-risk-label">${esc(s.id)}: ${esc(s.title)}</span></div>`,
      ),
    ...overdueEpics
      .slice(0, 2)
      .map(
        (e) =>
          `<div class="pv-risk-item"><span class="chip warn">Overdue</span><span class="pv-risk-label">${esc(e.id)}: ${esc(e.title)}</span></div>`,
      ),
  ];
  const riskContent =
    riskItems.length > 0 ? riskItems.join('') : '<p class="pv-widget-empty">No critical risks detected.</p>';

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentDone = (data.recentActivity || []).filter((a) => a.date && new Date(a.date) >= sevenDaysAgo);
  const totalAI = (data.costs && data.costs._totals && data.costs._totals.costUsd) || 0;
  const weekContent = `
    <div class="pv-kv"><span class="pv-kv-k">Stories shipped</span><span class="pv-kv-v tnum">${recentDone.length}</span></div>
    <div class="pv-kv"><span class="pv-kv-k">Open bugs</span><span class="pv-kv-v tnum">${openBugs.length}</span></div>
    <div class="pv-kv"><span class="pv-kv-k">AI spend (total)</span><span class="pv-kv-v tnum">$${totalAI.toFixed(2)}</span></div>`;

  const agentMap = {};
  activeStories.forEach((s) => {
    const agent = s.assignedAgent || s.agent || 'Unassigned';
    agentMap[agent] = (agentMap[agent] || 0) + (s.status !== 'Done' ? 1 : 0);
  });
  const agentEntries = Object.entries(agentMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxCount = agentEntries.length > 0 ? agentEntries[0][1] : 1;
  const workloadContent =
    agentEntries.length > 0
      ? agentEntries
          .map(
            ([name, count]) =>
              `<div class="pv-wl-row">
          <span class="pv-wl-name">${esc(name)}</span>
          <div class="pv-wl-bar-bg"><div class="pv-wl-bar" style="width:${Math.round(((count || 0) / (maxCount || 1)) * 100)}%"></div></div>
          <span class="pv-wl-count tnum">${count}</span>
        </div>`,
          )
          .join('')
      : '<p class="pv-widget-empty">No active assignments.</p>';

  return `
  <style>@media(max-width:1100px){.pv-widgets{grid-template-columns:minmax(0,1fr)}}</style>
  <div class="pv-widgets" style="margin-bottom:16px">
    <div class="card pv-widget-top-risks">
      <div class="card-head"><h3>Top Risks</h3></div>
      <div class="card-body pv-risk-list">${riskContent}</div>
    </div>
    <div class="card pv-widget-this-week">
      <div class="card-head"><h3>This Week</h3></div>
      <div class="card-body">${weekContent}</div>
    </div>
    <div class="card pv-widget-agent-workload">
      <div class="card-head"><h3>Agent Workload</h3></div>
      <div class="card-body">${workloadContent}</div>
    </div>
  </div>`;
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

  // Risk chart data — BUG-0219: suppress Done epics
  const epicStatusMap = Object.fromEntries((data.epics || []).map((e) => [e.id, e.status]));
  const riskEpics =
    data.risk && data.risk.byEpic
      ? [...data.risk.byEpic.entries()]
          .filter(([id]) => !/^done$/i.test(epicStatusMap[id] || ''))
          .sort((a, b) => b[1].avgScore - a[1].avgScore)
      : [];
  const riskCounts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  let totalRiskScore = 0,
    activeStoryCount = 0;
  if (data.risk && data.risk.byStory) {
    for (const story of data.stories || []) {
      if (story.status === 'Done' || story.status === 'Retired' || story.status === 'Cancelled') continue;
      const sr = data.risk.byStory.get(story.id);
      if (sr) {
        if (sr.level in riskCounts) riskCounts[sr.level]++;
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
    ${_renderStatusHero(data)}
    ${_renderDecisionWidgets(data)}
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
        <div style="height:300px;position:relative">
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
          <span class="chart-subtitle">incomplete epics only · avg score</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-top:4px">
          ${
            riskEpics.length === 0
              ? '<p style="color:var(--text-muted,var(--text-dim));font-size:12px">No risk data</p>'
              : riskEpics
                  .map(([id, r]) => {
                    const pct = Math.min(100, Math.round((r.avgScore / 4) * 100));
                    const col = RISK_LEVEL_COLORS[r.level];
                    return `<div style="display:flex;align-items:center;gap:6px">
              <span style="color:var(--text);width:72px;font-size:11px;font-family:monospace;flex-shrink:0">${esc(id)}</span>
              <div style="flex:1;background:var(--surface-alt,oklch(25% 0.015 220));border-radius:3px;height:14px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${col};border-radius:3px"></div>
              </div>
              <span style="color:${col};font-size:11px;font-weight:600;width:28px;text-align:right">${r.avgScore}</span>
              <span style="background:${col};color:oklch(100% 0 0);font-size:9px;padding:1px 5px;border-radius:3px;white-space:nowrap">${r.level}</span>
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
          <div style="flex:1;background:var(--clr-card,var(--surface-alt,oklch(25% 0.015 220)));border-radius:6px;padding:8px 10px;border-left:3px solid var(--warn)">
            <div style="font-size:10px;color:var(--text-muted,var(--text-dim))">Avg score</div>
            <div style="font-size:18px;font-weight:700;color:var(--warn)">${avgRiskScore}</div>
          </div>
          <div style="flex:1;background:var(--clr-card,var(--surface-alt,oklch(25% 0.015 220)));border-radius:6px;padding:8px 10px;border-left:3px solid var(--risk)">
            <div style="font-size:10px;color:var(--text-muted,var(--text-dim))">High + Critical</div>
            <div style="font-size:18px;font-weight:700;color:var(--risk)">${highCritCount} stories</div>
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
              return `<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--clr-card,var(--surface-alt,oklch(25% 0.015 220)));border-radius:6px;border-left:3px solid ${col}">
              <span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--text)">${esc(id)}</span>
              <span style="font-size:13px;font-weight:700;color:${col}">${r.avgScore}</span>
              <span style="background:${col};color:oklch(100% 0 0);font-size:10px;padding:1px 6px;border-radius:3px">${r.level}</span>
              <span style="font-size:11px;color:var(--text-muted,var(--text-dim));margin-left:auto">${(r.counts?.High ?? 0) + (r.counts?.Critical ?? 0)} High+Critical stories</span>
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
  var pvChartColors = (function() {
    var cs = getComputedStyle(document.documentElement);
    function tok(v, fb) { var r = cs.getPropertyValue(v).trim(); return r || fb; }
    return {
      ok:     tok('--ok',          'oklch(68% 0.15 150)'),
      warn:   tok('--warn',        'oklch(74% 0.16 78)'),
      risk:   tok('--risk',        'oklch(64% 0.20 25)'),
      info:   tok('--info',        'oklch(66% 0.14 240)'),
      accent: tok('--plan-accent', 'oklch(62% 0.19 268)'),
      mute:   tok('--text-mute',   'oklch(70% 0.012 95)'),
    };
  })();
  var _charts = {};
  function chartTextColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--clr-chart-text').trim() || getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || 'oklch(65% 0.014 95)';
  }
  function initCharts() {
    var tc = chartTextColor();
    _charts.epicProgress = new Chart(document.getElementById('chart-epic-progress'), {
      type: 'bar',
      data: { labels: ${epicLabels}, datasets: [
        { label: 'Done', data: ${epicDone}, backgroundColor: pvChartColors.ok },
        { label: 'In Progress', data: ${epicInProgress}, backgroundColor: pvChartColors.info },
        { label: 'Planned/To Do', data: ${epicPlanned}, backgroundColor: pvChartColors.mute },
      ]},
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } },
        scales: { x: { stacked: true, ticks: { color: tc } }, y: { stacked: true, ticks: { color: tc, autoSkip: false } } } }
    });
    _charts.costBreakdown = new Chart(document.getElementById('chart-cost-breakdown'), {
      type: 'bar',
      data: { labels: ${epicLabels}, datasets: [
        { label: 'Projected ($)', data: ${epicProjected}, backgroundColor: pvChartColors.warn, yAxisID: 'yProjected' },
        { label: 'AI Cost ($)', data: ${epicAI}, backgroundColor: pvChartColors.info, yAxisID: 'yAI' },
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
      data: { labels: ['Covered', 'Gap'], datasets: [{ data: [${coveragePctNum}, ${coverageGap}], backgroundColor: [${coveragePct !== null ? 'pvChartColors.ok' : 'pvChartColors.mute'},pvChartColors.mute], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: true, position: 'bottom', labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } } }
    });
    _charts.aiTimeline = new Chart(document.getElementById('chart-ai-timeline'), {
      type: 'line',
      data: { labels: ${sessionDates}, datasets: [{ label: 'Cumulative AI Cost ($)', data: ${sessionCosts}, borderColor: pvChartColors.info, tension: 0.3, fill: true, backgroundColor: pvChartColors.mute }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } }, scales: { x: { ticks: { color: tc } }, y: { ticks: { color: tc } } } }
    });
    _charts.burndown = new Chart(document.getElementById('chart-burndown'), {
      type: 'doughnut',
      data: { labels: ['Done','In Progress','Planned','To Do','Blocked'], datasets: [{ data: ${statusCounts}, backgroundColor: [pvChartColors.ok,pvChartColors.info,pvChartColors.mute,pvChartColors.warn,pvChartColors.risk], borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } } }
    });
    _charts.burnRate = new Chart(document.getElementById('chart-burn-rate'), {
      type: 'bar',
      data: { labels: ${sessionDates}, datasets: [{ label: 'Session AI Spend ($)', data: ${sessionPerCosts}, backgroundColor: pvChartColors.accent }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc, font: { family: "'Inter', sans-serif", size: 12 }, pointStyle: 'circle', usePointStyle: true } } }, scales: { x: { ticks: { color: tc } }, y: { ticks: { color: tc } } } }
    });
    if (document.getElementById('chart-risk-distribution')) {
      _charts.riskDist = new Chart(document.getElementById('chart-risk-distribution'), {
        type: 'bar',
        data: { labels: ['Low','Medium','High','Critical'], datasets: [{ data: ${riskDistCounts}, backgroundColor: [pvChartColors.ok, pvChartColors.info, pvChartColors.warn, pvChartColors.risk] }] },
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
        let barColor = 'var(--ok)';
        if (eb.percentUsed !== null) {
          if (eb.percentUsed >= 90) barColor = 'var(--risk)';
          else if (eb.percentUsed >= 75) barColor = 'var(--warn)';
          else if (eb.percentUsed >= 50) barColor = 'var(--warn)';
        }
        const pbClass =
          eb.percentUsed !== null && eb.percentUsed >= 90
            ? 'pb-danger'
            : eb.percentUsed !== null && eb.percentUsed >= 75
              ? 'pb-warn'
              : 'pb-ok';
        return `<tr class="border-t border-slate-100 dark:border-slate-700 anim-stagger" style="--i:${Math.min(i, 19)};background:${accent.bg}">
        <td class="px-3 py-2" style="border-left:4px solid ${accent.border}"><span class="font-mono text-xs font-bold" style="color:${accent.border}">${eb.id}</span></td>
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
        <span id="${ceid}-arrow" class="text-slate-400 text-xs mr-2">▶</span>
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
        <span id="${bceid}-arrow" class="text-slate-400 text-xs mr-2">&#9654;</span>
        <span class="font-mono text-xs font-bold" style="color:${accent.border}">${label}</span>
        <span class="ml-2 text-xs text-slate-500 bug-count">(${bugs.length})</span>
      </td>
      <td class="px-3 py-2 text-right text-sm font-medium dark:text-slate-200">${epicProjected > 0 ? usd(epicProjected) : '—'}</td>
      <td class="px-3 py-2 text-right text-sm font-medium text-teal-700 dark:text-teal-400">${usd(epicAI)}</td>
      <td class="px-3 py-2 text-right text-xs text-slate-500 tokens-col">${fmtNum(epicIn)} / ${fmtNum(epicOut)}</td>
    </tr>
    </tbody><tbody id="${bceid}" class="hidden">${bugRows}</tbody>`;
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
        <span id="${cceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">▶</span>
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
        <span id="${bcceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">▶</span>
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
    colBtn.classList.toggle('active-view', v === 'column');
    cardBtn.classList.toggle('active-view', v === 'card');
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
    if (s === 'critical' || s === 'high') return 'var(--badge-danger-text)';
    if (s === 'medium') return 'var(--badge-warn-text)';
    return 'var(--badge-neutral-text)';
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

  // AC-0355: compact view rows (flat, no epic grouping) — BUG-0225: sort ascending by ID
  const compactRows = [...data.bugs]
    .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
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
      // BUG-0167 — default-collapsed to match Hierarchy; ▶ arrow + hidden tbody.
      return `<tbody>
    <tr class="border-t-2 border-slate-300 dark:border-slate-600 cursor-pointer select-none bug-epic-header" data-epic="${epicId}" style="background:${accent.bg}" onclick="toggleSection('${beid}','${beid}-arrow')">
      <td colspan="7" class="px-3 py-2" style="border-left:4px solid ${accent.border};">
        <div class="flex flex-wrap items-center gap-3">
          <span id="${beid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">▶</span>
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
        <span id="${bceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">▶</span>
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
    colBtn.classList.toggle('active-view', v === 'column');
    cardBtn.classList.toggle('active-view', v === 'card');
    if (compactBtn) compactBtn.classList.toggle('active-view', v === 'compact');
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
            ? 'var(--badge-danger-text)'
            : bug.severity === 'Medium'
              ? 'var(--badge-warn-text)'
              : 'var(--badge-neutral-text)';
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
      const leid = `lessons-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const titlePart = epic
        ? `<span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>`
        : epicId === '_ungrouped'
          ? `<span class="italic text-slate-500">No Epic</span>`
          : '';
      return `<tbody>
    <tr class="border-t-2 border-slate-300 dark:border-slate-600 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('${leid}','${leid}-arrow')">
      <td colspan="5" class="px-3 py-2" style="border-left:4px solid ${accent.border};">
        <div class="flex flex-wrap items-center gap-3">
          <span id="${leid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">▶</span>
          <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epicId === '_ungrouped' ? 'No Epic' : epicId}</span>
          ${epic ? badge(epic.status) : ''}
          ${titlePart}
          <span class="ml-auto text-xs text-slate-500">${ls.length} lesson${ls.length !== 1 ? 's' : ''}</span>
        </div>
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
      const lceid = `lessons-card-ep-${epicId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const titlePart = epic
        ? `<span class="font-semibold dark:text-slate-100">${esc(epic.title)}</span>`
        : epicId === '_ungrouped'
          ? `<span class="italic text-slate-500">No Epic</span>`
          : '';
      return `<div class="mb-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" style="border-left:4px solid ${accent.border}">
      <div class="flex flex-wrap items-center gap-3 px-3 py-2 cursor-pointer select-none" style="background:${accent.bg}" onclick="toggleSection('${lceid}','${lceid}-arrow')">
        <span id="${lceid}-arrow" class="text-slate-400 text-xs w-3 flex-shrink-0">▶</span>
        <span class="font-mono text-xs font-bold uppercase tracking-widest" style="color:${accent.border}">${epicId === '_ungrouped' ? 'No Epic' : epicId}</span>
        ${epic ? badge(epic.status) : ''}
        ${titlePart}
        <span class="ml-auto text-xs text-slate-500">${ls.length} lesson${ls.length !== 1 ? 's' : ''}</span>
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
    colBtn.classList.toggle('active-view', v === 'column');
    cardBtn.classList.toggle('active-view', v === 'card');
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
      <button onclick="toggleActivityPanel()" class="text-slate-400 hover:text-slate-700 leading-none px-1" title="Expand" aria-label="Expand activity panel">▶</button>
      <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide select-none" style="writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap">Recent Activity</span>
    </div>
  </div>`;
}

// ─── US-0135/US-0139: Status tab — release health hero + decision widgets ───
function renderStatusTab(data) {
  const activeStories = data.stories.filter((s) => s.status !== 'Retired');
  const doneStories = activeStories.filter((s) => s.status === 'Done');
  const inProgress = activeStories.filter((s) => s.status === 'In Progress' || s.status === 'In-Progress');
  const openBugs = (data.bugs || []).filter((b) => !/^(Fixed|Retired|Cancelled|Rejected)/i.test(b.status));
  const criticalBugs = openBugs.filter((b) => b.severity === 'Critical');
  const highBugs = openBugs.filter((b) => b.severity === 'High');
  const blockedStories = activeStories.filter((s) => s.status === 'Blocked');
  const cov = data.coverage;
  const covPct = cov && cov.available !== false ? cov.overall : null;
  const totalAI = (data.costs && data.costs._totals && data.costs._totals.costUsd) || 0;
  const totalProjected = activeStories.reduce(
    (s, st) => s + ((data.costs && data.costs[st.id] && data.costs[st.id].projectedUsd) || 0),
    0,
  );
  const budgetPct = totalProjected > 0 ? Math.round((totalAI / totalProjected) * 100) : 0;
  const donePct = activeStories.length > 0 ? Math.round((doneStories.length / activeStories.length) * 100) : 0;

  // Release health verdict
  const hasBlocker = blockedStories.length > 0 || criticalBugs.length > 0;
  const hasRisk = highBugs.length > 0 || openBugs.length > 3 || budgetPct > 80;
  const verdict = hasBlocker ? 'Off track' : hasRisk ? 'At risk' : 'On track';
  const verdictColor = hasBlocker ? 'var(--risk)' : hasRisk ? 'var(--warn)' : 'var(--ok)';
  const chipCls = hasBlocker ? 'risk' : hasRisk ? 'warn' : 'ok';
  const narrative = hasBlocker
    ? `${criticalBugs.length} critical bug${criticalBugs.length !== 1 ? 's' : ''} or blocked stories need immediate attention.`
    : hasRisk
      ? `${openBugs.length} open bug${openBugs.length !== 1 ? 's' : ''} and ${100 - donePct}% of stories remaining — watch velocity closely.`
      : `${doneStories.length} of ${activeStories.length} stories done at ${covPct !== null ? covPct.toFixed(1) + '% coverage' : 'unknown coverage'}. Release is on track.`;

  // ── Completion data ───────────────────────────────────────────────
  const comp = data.completion;
  const forecastLabel = comp ? `${comp.likelyDate}` : '—';
  const rangeLabel = comp ? `${comp.rangeStart} – ${comp.rangeEnd}` : '—';
  const velocityLabel = comp ? `${comp.velocityWeeks}wk` : '—';

  // ── 14-week progress mini-bar ─────────────────────────────────────
  const trends = data.trends;
  const progressBars = (() => {
    if (!trends || !trends.dates || trends.dates.length < 2)
      return '<span class="text-xs text-slate-400">No history</span>';
    const recent = trends.dates.slice(-14);
    const doneCounts = (trends.doneCounts || []).slice(-14);
    const totalCounts = (trends.totalStories || []).slice(-14);
    const maxDone = Math.max(...doneCounts, 1);
    return recent
      .map((d, i) => {
        const pct = Math.round((doneCounts[i] / maxDone) * 100);
        return `<div title="${d}: ${doneCounts[i]}/${totalCounts[i]} done"
        style="width:8px;background:color-mix(in oklab,var(--plan-accent) ${Math.max(pct, 8)}%,var(--border));border-radius:2px;height:${Math.max(Math.round((doneCounts[i] / maxDone) * 32), 4)}px;align-self:flex-end;flex-shrink:0"></div>`;
      })
      .join('');
  })();

  // ── 30-day coverage dots ──────────────────────────────────────────
  const coverageDots = (() => {
    if (!trends || !trends.dates || trends.dates.length < 2)
      return '<span class="text-xs text-slate-400">No history</span>';
    const recent30 = trends.dates.slice(-30);
    const covVals = (trends.coveragePcts || []).slice(-30);
    return recent30
      .map((d, i) => {
        const v = covVals[i] || 0;
        const good = v >= 80;
        const warn = v >= 60 && v < 80;
        const color = good ? 'var(--ok)' : warn ? 'var(--warn)' : 'var(--risk)';
        return `<span title="${d}: ${v.toFixed(1)}%" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin:1px;opacity:${v > 0 ? 0.85 : 0.2}"></span>`;
      })
      .join('');
  })();

  // ── Epic progress list ────────────────────────────────────────────
  const epicProgress = data.epics
    .filter(
      (e) =>
        e.status !== 'Done' ||
        data.stories.some((s) => s.epicId === e.id && s.status !== 'Done' && s.status !== 'Retired'),
    )
    .slice(0, 8)
    .map((epic, i) => {
      const accent = EPIC_ACCENT_COLORS[data.epics.indexOf(epic) % EPIC_ACCENT_COLORS.length];
      const epicStories = data.stories.filter((s) => s.epicId === epic.id && s.status !== 'Retired');
      const epicDone = epicStories.filter((s) => s.status === 'Done').length;
      const pct = epicStories.length > 0 ? Math.round((epicDone / epicStories.length) * 100) : 0;
      return `
      <div class="pv-wl-row" style="grid-template-columns:110px 1fr 36px">
        <span class="pv-wl-name" style="color:${accent.text}" title="${esc(epic.title)}">${esc(epic.id)}: ${esc(epic.title)}</span>
        <div class="pv-wl-bar-bg"><div class="pv-wl-bar" style="width:${pct}%;background:${accent.border}"></div></div>
        <span class="pv-wl-count">${pct}%</span>
      </div>`;
    })
    .join('');

  // ── This week stats (last 7 days from trends if available) ────────
  const thisWeekStories = inProgress.length;
  const weekBugsOpen = openBugs.filter((b) => b.severity === 'Critical' || b.severity === 'High').length;

  // ── Top risks list ────────────────────────────────────────────────
  const risks = [];
  criticalBugs
    .slice(0, 2)
    .forEach((b) =>
      risks.push({ level: 'HIGH', label: esc(b.title), sub: `${esc(b.id)} · ${esc(b.relatedStory || 'no story')}` }),
    );
  highBugs
    .slice(0, 2)
    .forEach((b) =>
      risks.push({ level: 'MED', label: esc(b.title), sub: `${esc(b.id)} · ${esc(b.relatedStory || 'no story')}` }),
    );
  blockedStories
    .slice(0, 2)
    .forEach((s) => risks.push({ level: 'MED', label: esc(s.title), sub: `${esc(s.id)} · Blocked` }));
  if (budgetPct > 80) risks.push({ level: 'LOW', label: 'Budget approaching cap', sub: `${budgetPct}% consumed` });
  const riskColors = { HIGH: 'var(--risk)', MED: 'var(--warn)', LOW: 'var(--ok)' };
  const riskItems =
    risks
      .slice(0, 5)
      .map(
        (r) =>
          `<div class="pv-risk-item">
      <span class="chip ${r.level === 'HIGH' ? 'risk' : r.level === 'MED' ? 'warn' : 'ok'}" style="font-size:10px;padding:1px 6px"><span class="d"></span>${r.level}</span>
      <span class="pv-risk-label"><strong>${r.label}</strong><br><span style="font-size:11px;opacity:.7">${r.sub}</span></span>
    </div>`,
      )
      .join('') || '<p class="pv-widget-empty">No active risks — looking good 🎉</p>';

  // ── Test quality ──────────────────────────────────────────────────
  const allTCs = data.testCases || [];
  const passed = allTCs.filter((t) => t.status === 'Pass').length;
  const failed = allTCs.filter((t) => t.status === 'Fail').length;
  const notRun = allTCs.filter((t) => t.status === 'Not Run').length;
  const passRate = allTCs.length > 0 ? Math.round((passed / allTCs.length) * 100) : 0;

  return `
  <div id="tab-status" class="p-6" role="tabpanel" aria-labelledby="tab-btn-status">

    <!-- Release Health Hero -->
    <div class="pv-hero card mb-6 p-0 overflow-hidden">
      <div class="pv-hero-head">
        <div class="pv-hero-verdict" style="position:relative">
          <div class="pv-hero-toggle" role="group" aria-label="Density">${['L', 'M', 'S'].map((d) => `<button class="pv-hero-density-btn${d === 'M' ? ' pv-hero-active' : ''}" data-density="${d}" onclick="pvHeroDensity('${d}')">${d}</button>`).join('')}</div>
          <p class="pv-eyebrow">Release Health</p>
          <h2 style="margin:4px 0 6px;font-family:var(--font-display);font-size:clamp(28px,4vw,44px);font-weight:600;letter-spacing:-0.02em;line-height:1;color:${verdictColor}">${verdict}</h2>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="chip ${chipCls}"><span class="d"></span>${hasBlocker ? 'BLOCKED' : hasRisk ? 'AT RISK' : 'STABLE'}</span>
            <p class="pv-hero-narrative">${narrative}</p>
          </div>
        </div>
        <div class="pv-hero-stats">
          <div class="pv-stat">
            <span class="pv-stat-lbl">Forecast</span>
            <span class="pv-stat-val">${esc(forecastLabel)}</span>
            <span class="pv-delta" style="color:var(--text-mute);font-size:11px">${esc(rangeLabel)}</span>
          </div>
          <div class="pv-stat">
            <span class="pv-stat-lbl">Velocity</span>
            <span class="pv-stat-val">${esc(velocityLabel)}</span>
            <span class="pv-delta" style="color:var(--text-mute);font-size:11px">stories/wk</span>
          </div>
          <div class="pv-stat">
            <span class="pv-stat-lbl">Budget</span>
            <span class="pv-stat-val" style="color:${budgetPct > 90 ? 'var(--risk)' : budgetPct > 75 ? 'var(--warn)' : 'inherit'}">${budgetPct}%</span>
            <span class="pv-delta" style="color:var(--text-mute);font-size:11px">${usd(totalAI)} / ${usd(totalProjected)}</span>
          </div>
        </div>
      </div>
      <!-- Mini-viz row -->
      <div class="pv-hero-vizrow pv-hero-viz" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <p class="pv-eyebrow" style="margin-bottom:6px">Progress · Past 14 weeks</p>
          <div style="display:flex;align-items:flex-end;gap:3px;height:36px">${progressBars}</div>
        </div>
        <div>
          <p class="pv-eyebrow" style="margin-bottom:6px">Coverage · Last 30 days</p>
          <div style="line-height:1;display:flex;flex-wrap:wrap;align-items:center">${coverageDots}</div>
        </div>
      </div>
    </div>

    <!-- Decision widgets row -->
    <div class="pv-widgets mb-6">
      <!-- Overall progress KPIs -->
      <div class="card">
        <div class="card-head">
          <h3>Overall Progress</h3>
          <span style="margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--text-mute)">${doneStories.length}/${activeStories.length} stories</span>
        </div>
        <div class="card-body">
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
              <span style="font-size:12px;color:var(--text-dim)">Completion</span>
              <span style="font-family:var(--font-mono);font-size:13px;font-weight:600">${donePct}%</span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${donePct}%;background:${donePct === 100 ? 'var(--ok)' : 'var(--plan-accent)'};border-radius:3px;transition:width 0.4s"></div>
            </div>
          </div>
          <div class="pv-kv"><span class="pv-kv-k">In Progress</span><span class="pv-kv-v">${inProgress.length}</span></div>
          <div class="pv-kv"><span class="pv-kv-k">Blocked</span><span class="pv-kv-v" style="color:${blockedStories.length > 0 ? 'var(--risk)' : 'inherit'}">${blockedStories.length}</span></div>
          <div class="pv-kv"><span class="pv-kv-k">Coverage</span><span class="pv-kv-v">${covPct !== null ? covPct.toFixed(1) + '%' : 'N/A'}</span></div>
          <div class="pv-kv" style="border-bottom:0"><span class="pv-kv-k">Open bugs</span><span class="pv-kv-v" style="color:${openBugs.length > 0 ? 'var(--risk)' : 'inherit'}">${openBugs.length}</span></div>
        </div>
      </div>

      <!-- Epic progress -->
      <div class="card">
        <div class="card-head"><h3>Epic Progress</h3><span style="margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--text-mute)">${data.epics.filter((e) => e.status === 'Done').length}/${data.epics.length} done</span></div>
        <div class="card-body">
          ${epicProgress || '<p class="pv-widget-empty">All epics done!</p>'}
        </div>
      </div>

      <!-- Top Risks -->
      <div class="card pv-widget-top-risks">
        <div class="card-head"><h3>Top Risks</h3></div>
        <div class="card-body">
          <div class="pv-risk-list">${riskItems}</div>
        </div>
      </div>
    </div>

    <!-- Quality + This-week row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-head"><h3>Quality</h3><span style="margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--text-mute)">${allTCs.length} TCs</span></div>
        <div class="card-body">
          <div class="pv-kv"><span class="pv-kv-k">Pass rate</span><span class="pv-kv-v" style="color:${passRate >= 90 ? 'var(--ok)' : passRate >= 70 ? 'var(--warn)' : 'var(--risk)'}">${passRate}%</span></div>
          <div class="pv-kv"><span class="pv-kv-k">Passed</span><span class="pv-kv-v">${passed}</span></div>
          <div class="pv-kv"><span class="pv-kv-k">Failed</span><span class="pv-kv-v" style="color:${failed > 0 ? 'var(--risk)' : 'inherit'}">${failed}</span></div>
          <div class="pv-kv" style="border-bottom:0"><span class="pv-kv-k">Not Run</span><span class="pv-kv-v">${notRun}</span></div>
        </div>
      </div>
      <div class="card pv-widget-this-week">
        <div class="card-head"><h3>This Week</h3></div>
        <div class="card-body">
          <div class="pv-kv"><span class="pv-kv-k">Stories done</span><span class="pv-kv-v">${doneStories.length}</span></div>
          <div class="pv-kv"><span class="pv-kv-k">In progress</span><span class="pv-kv-v">${thisWeekStories}</span></div>
          <div class="pv-kv"><span class="pv-kv-k">Critical + High bugs</span><span class="pv-kv-v" style="color:${weekBugsOpen > 0 ? 'var(--risk)' : 'inherit'}">${weekBugsOpen}</span></div>
          <div class="pv-kv"><span class="pv-kv-k">AI spend</span><span class="pv-kv-v">${usd(totalAI)}</span></div>
          <div class="pv-kv" style="border-bottom:0"><span class="pv-kv-k">Est. budget</span><span class="pv-kv-v">${usd(totalProjected)}</span></div>
        </div>
      </div>
      <div class="card pv-widget-agent-workload">
        <div class="card-head"><h3>Agent Workload</h3></div>
        <div class="card-body">
          <p class="pv-widget-empty" style="font-size:12px;color:var(--text-mute)">No live data</p>
        </div>
      </div>
    </div>
  </div>
  <style>
  .pv-hero-toggle{position:absolute;top:8px;right:10px;display:flex;gap:2px}
  .pv-hero-density-btn{padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;
    border:1px solid oklch(100% 0 0 / 0.2);background:none;color:inherit;cursor:pointer;opacity:.6}
  .pv-hero-density-btn.pv-hero-active{opacity:1;background:oklch(100% 0 0 / 0.15)}
  @media(max-width:1100px){.pv-widgets{grid-template-columns:1fr}}
  </style>
  <script>
  (function(){var s=localStorage.getItem('pv-hero-density')||'M';pvHeroDensity(s)})();
  function pvHeroDensity(d){
    localStorage.setItem('pv-hero-density',d);
    var h=document.querySelector('#tab-status .pv-hero-head');
    if(h)h.setAttribute('data-density',d);
    document.querySelectorAll('.pv-hero-density-btn').forEach(function(b){
      b.classList.toggle('pv-hero-active',b.dataset.density===d);
    });
  }
  window.pvHeroDensity=pvHeroDensity;
  </script>`;
}

// ── EPIC-0012: Stakeholder View ──────────────────────────────────────────────

const STATUS_LABELS = {
  Done: 'Complete',
  'In Progress': 'Being Worked On',
  'In-Progress': 'Being Worked On',
  Planned: 'Planned',
  Blocked: 'Needs Attention',
  'At Risk': 'Needs Attention',
};

const STATUS_CHIP = {
  Done: 'info',
  'In Progress': 'warn',
  'In-Progress': 'warn',
  Planned: 'mute',
  Blocked: 'warn',
  'At Risk': 'warn',
};

const SH_DOT_COLOR = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  risk: 'var(--risk)',
  info: 'var(--info)',
  mute: 'var(--text-mute)',
};

function shStoryLabel(status) {
  return STATUS_LABELS[status] || esc(status);
}
function shStoryChip(status) {
  return STATUS_CHIP[status] || 'mute';
}

function shEpicCompositeStatus(epicId, stories, bugs) {
  const epicStories = stories.filter((s) => s.epicId === epicId && s.status !== 'Retired');
  if (!epicStories.length) return { label: 'Planned', chipClass: 'mute', dotKey: 'mute' };

  const allDone = epicStories.every((s) => /^done$/i.test(s.status));
  const anyBlocked = epicStories.some((s) => /^blocked$/i.test(s.status));
  const hasOpenCritical = (bugs || []).some(
    (b) =>
      b.epicId === epicId && /^(Critical|High)$/i.test(b.severity) && !/^(Fixed|Retired|Cancelled)/i.test(b.status),
  );
  const anyActive = epicStories.some((s) => /^(done|in[ -]progress)$/i.test(s.status));
  const allPlanned = epicStories.every((s) => /^planned$/i.test(s.status));

  if (allDone) return { label: 'Complete', chipClass: 'info', dotKey: 'info' };
  if (anyBlocked || hasOpenCritical) return { label: 'Needs Attention', chipClass: 'risk', dotKey: 'risk' };
  if (anyActive) return { label: 'On Track', chipClass: 'warn', dotKey: 'warn' };
  if (allPlanned) return { label: 'Planned', chipClass: 'mute', dotKey: 'mute' };
  return { label: 'In Progress', chipClass: 'warn', dotKey: 'warn' };
}

// Plain-text USD formatter for stakeholder tab — appends " USD" postfix instead of the <span> wrapper used by usd() elsewhere.
function shUsdLabel(n) {
  const num = Number(n);
  if (num >= 1000) return '$' + Math.round(num).toLocaleString('en-US') + ' USD';
  if (num > 0) return '$' + num.toFixed(2) + ' USD';
  return '$0.00 USD';
}

function renderStakeholderTab(data) {
  const costs = data.costs || null;
  const budget = data.budget || {};
  const stories = data.stories || [];
  const epics = data.epics || [];
  const bugs = data.bugs || [];

  // ── Summary bar ─────────────────────────────────────────────────────────────
  const nonRetired = stories.filter((s) => s.status !== 'Retired');
  const doneCnt = nonRetired.filter((s) => /^done$/i.test(s.status)).length;
  const totalCnt = nonRetired.length;
  const overallPct = totalCnt ? Math.round((doneCnt / totalCnt) * 100) : 0;

  const pctUsed = budget.percentUsed !== null && budget.percentUsed !== undefined ? budget.percentUsed : null;
  let tlColor = 'var(--ok)';
  let tlLabel = 'On track';
  if (pctUsed !== null && pctUsed > 80) {
    tlColor = 'var(--risk)';
    tlLabel = 'At risk';
  } else if (pctUsed !== null && pctUsed >= 50) {
    tlColor = 'var(--warn)';
    tlLabel = 'Watch';
  }

  const totalSpent = (costs && costs._totals && costs._totals.costUsd) || 0;
  const totalProjected = costs
    ? Object.entries(costs)
        .filter(([k]) => k !== '_totals')
        .reduce((sum, [, c]) => sum + (c && c.projectedUsd ? c.projectedUsd : 0), 0)
    : 0;

  let budgetLine = '';
  if (budget.hasBudget) {
    budgetLine = `${esc(tlLabel)} · Est. ${shUsdLabel(totalProjected)} · AI spend ${shUsdLabel(totalSpent)}`;
    if (budget.daysRemaining !== null && budget.daysRemaining !== undefined && budget.burnRate > 0) {
      const wks = Math.round(budget.daysRemaining / 7);
      if (wks >= 1) budgetLine += ` · At current pace, budget lasts ${wks} more week${wks !== 1 ? 's' : ''}`;
    }
  } else if (costs) {
    budgetLine = `Est. ${shUsdLabel(totalProjected)} · AI spend ${shUsdLabel(totalSpent)}`;
  }

  const openHighBugs = bugs.filter(
    (b) => /^(Critical|High)$/i.test(b.severity) && !/^(Fixed|Retired|Cancelled)/i.test(b.status),
  );
  const blockedStoriesCnt = stories.filter((s) => /^blocked$/i.test(s.status)).length;

  const summaryBar = `
  <div class="sh-summary-bar">
    <div class="sh-tile">
      <div class="sh-tile-label">Overall Progress</div>
      <div class="sh-tile-value">
        <span class="sh-big-num">${overallPct}%</span>
        <span class="sh-tile-sub">${doneCnt} of ${totalCnt} stories done</span>
      </div>
    </div>
    <div class="sh-tile sh-tile-wide">
      <div class="sh-tile-label">Budget Health</div>
      <div class="sh-tile-value">
        ${budget.hasBudget ? `<span class="sh-tl-dot" style="background:${tlColor}"></span>` : ''}
        <span class="sh-tile-sub">${budgetLine}</span>
      </div>
    </div>
    <div class="sh-tile">
      <div class="sh-tile-label">Open Risks</div>
      <div class="sh-tile-value">
        <span class="sh-big-num">${openHighBugs.length + blockedStoriesCnt}</span>
        <span class="sh-tile-sub">${openHighBugs.length} high bug${openHighBugs.length !== 1 ? 's' : ''} · ${blockedStoriesCnt} blocked ${blockedStoriesCnt !== 1 ? 'stories' : 'story'}</span>
      </div>
    </div>
  </div>`;

  // ── Milestones ───────────────────────────────────────────────────────────────
  const activeEpics = epics.filter((e) => e.status !== 'Retired');
  activeEpics.sort((a, b) => {
    if (a.id === '_ungrouped') return 1;
    if (b.id === '_ungrouped') return -1;
    return a.id.localeCompare(b.id);
  });

  const ungroupedStories = stories.filter((s) => !s.epicId && s.status !== 'Retired');
  const epicGroups = [
    ...activeEpics.map((e) => ({
      epic: e,
      epicStories: stories.filter((s) => s.epicId === e.id && s.status !== 'Retired'),
    })),
    ...(ungroupedStories.length
      ? [{ epic: { id: '_ungrouped', title: 'No Epic' }, epicStories: ungroupedStories }]
      : []),
  ];

  const epicRows = epicGroups
    .map(({ epic, epicStories }) => {
      const isUngrouped = epic.id === '_ungrouped';
      const {
        label: statusLabel,
        chipClass,
        dotKey,
      } = isUngrouped
        ? { label: 'Planned', chipClass: 'mute', dotKey: 'mute' }
        : shEpicCompositeStatus(epic.id, stories, bugs);

      const epicDone = epicStories.filter((s) => /^done$/i.test(s.status)).length;
      const epicTotal = epicStories.length;
      const pct = epicTotal ? Math.round((epicDone / epicTotal) * 100) : 0;

      let costLine = '';
      if (costs) {
        const epicProjected = epicStories.reduce((s, st) => s + ((costs[st.id] && costs[st.id].projectedUsd) || 0), 0);
        const epicSpent = epicStories.reduce((s, st) => s + ((costs[st.id] && costs[st.id].costUsd) || 0), 0);
        costLine = `<div class="sh-epic-costs epic-costs">
          <span><span class="sh-cost-label">Est.</span>&nbsp;<span class="sh-cost-val">${shUsdLabel(epicProjected)}</span></span>
          <span><span class="sh-cost-label">AI spend</span>&nbsp;<span class="sh-cost-val">${shUsdLabel(epicSpent)}</span></span>
        </div>`;
      }

      const epicRowId = `sh-epic-${esc(epic.id.replace(/[^a-zA-Z0-9]/g, '-'))}`;
      const storiesId = `${epicRowId}-stories`;
      const toggleId = `${epicRowId}-toggle`;

      const storyRows = epicStories
        .map((story) => {
          const icon = /^done$/i.test(story.status) ? '✓' : '○';
          const iconColor = /^done$/i.test(story.status)
            ? 'var(--ok)'
            : /^blocked$/i.test(story.status)
              ? 'var(--risk)'
              : 'var(--warn)';
          const chipHtml =
            story.status === 'Done'
              ? ''
              : `<span class="chip ${shStoryChip(story.status)}">${shStoryLabel(story.status)}</span>`;

          const acsId = `sh-acs-${esc(story.id)}`;
          const acRows = (story.acs || [])
            .map(
              (ac) =>
                `<div class="sh-ac-row"><span class="sh-ac-id">${esc(ac.id)}</span>${ac.done ? '✓ ' : ''}${esc(ac.text)}</div>`,
            )
            .join('');
          const acToggle =
            story.acs && story.acs.length
              ? `<button class="sh-ac-toggle" onclick="shToggle('${jsEsc(acsId)}',this)">► ${story.acs.length} AC${story.acs.length !== 1 ? 's' : ''}</button>`
              : '';
          const acsArea =
            story.acs && story.acs.length
              ? `<div id="${esc(acsId)}" class="sh-acs-area" style="display:none">${acRows}</div>`
              : '';

          return `<div class="sh-story-row">
            <div class="sh-story-header">
              <span class="sh-story-icon" style="color:${iconColor}">${icon}</span>
              <div class="sh-story-name"><span class="sh-story-id">${esc(story.id)}</span>${esc(story.title)}</div>
              ${chipHtml}
              ${acToggle}
            </div>
            ${acsArea}
          </div>`;
        })
        .join('');

      return `<div class="sh-epic-row epic-row">
        <div class="sh-epic-header" onclick="shToggle('${jsEsc(storiesId)}', document.getElementById('${jsEsc(toggleId)}'))">
          <span class="sh-dot" style="background:${SH_DOT_COLOR[dotKey]}"></span>
          <div class="sh-epic-name-block">
            <div class="sh-epic-name"><span class="sh-epic-id">${esc(epic.id)}</span>${esc(epic.title)}</div>
            ${costLine}
          </div>
          <div class="sh-progress-track"><div class="sh-progress-fill" style="width:${pct}%;background:${SH_DOT_COLOR[dotKey]}"></div></div>
          <span class="sh-pct" style="color:${SH_DOT_COLOR[dotKey]}">${pct}%</span>
          <span class="chip ${chipClass}">${statusLabel}</span>
          <span id="${esc(toggleId)}" class="sh-toggle">►</span>
        </div>
        <div id="${esc(storiesId)}" class="sh-stories-area" style="display:none">
          <div class="sh-stories-label">Stories</div>
          ${storyRows || '<div class="sh-story-empty">No stories</div>'}
        </div>
      </div>`;
    })
    .join('');

  return `
  <div id="tab-stakeholder" class="p-6 hidden tab-fill" role="tabpanel" aria-labelledby="tab-btn-stakeholder">
    ${summaryBar}
    <div class="sh-milestone-section">
      <div class="sh-section-label">Milestones</div>
      <div class="sh-epics-list">
        ${epicRows}
      </div>
    </div>
    <div class="stakeholder-export-bar">
      <span class="sh-export-hint">Opens your browser's Save as PDF dialog</span>
      <button class="sh-export-btn" onclick="window.print()">Export PDF</button>
    </div>
  </div>
  <script>
  function shToggle(id, toggleEl) {
    var el = document.getElementById(id);
    if (!el) return;
    var open = el.style.display !== 'none';
    el.style.display = open ? 'none' : '';
    if (toggleEl) toggleEl.innerHTML = open ? '►' : '▼';
  }
  </script>`;
}

module.exports = {
  renderHierarchyTab,
  renderKanbanTab,
  renderTraceabilityTab,
  renderStatusTab,
  renderTrendsTab,
  renderChartsTab,
  renderCostsTab,
  renderBugsTab,
  renderLessonsTab,
  renderRecentActivity,
  renderStakeholderTab,
};
