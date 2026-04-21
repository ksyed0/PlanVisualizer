'use strict';

const { generateCssTokens } = require('./theme');
const { buildSearchIndex } = require('./search-index');
const { esc, jsEsc, usd, fmtNum, normalizeStoryRef, BADGE_TONE, badge } = require('./render-utils');

function renderScripts(data, options = {}) {
  const allData = JSON.stringify({ epics: data.epics, stories: data.stories });
  return `
  <script>
  const ALL_DATA = ${allData};
  const SEARCH_INDEX = ${JSON.stringify(buildSearchIndex(data)).replace(/<\/script>/gi, '<\\/script>')};

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
    const showSearch = name === 'traceability' || name === 'lessons';
    bar.classList.toggle('hidden', !showStory && !showBug && !showSearch);
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
    var _staggerPanel = document.getElementById('tab-' + name);
    if (_staggerPanel) {
      _staggerPanel.querySelectorAll('.anim-stagger').forEach(function(el) {
        el.classList.remove('anim-stagger');
        void el.offsetWidth;
        el.classList.add('anim-stagger');
      });
    }
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
  function toggleKanbanACs(id) {
    const el = document.getElementById('kanban-acs-' + id);
    if (el) el.classList.toggle('hidden');
  }

  function applyFilters() {
    const epicEl = document.getElementById('f-epic');
    const statusEl = document.getElementById('f-status');
    const priorityEl = document.getElementById('f-priority');
    const bugEpicEl = document.getElementById('f-bug-epic');
    const bugStatusEl = document.getElementById('f-bug-status');
    const bugSeverityEl = document.getElementById('f-bug-severity');
    const searchEl = document.getElementById('f-search');
    if (!epicEl || !statusEl || !priorityEl || !bugStatusEl || !searchEl) return;
    const epic = epicEl.value;
    const status = statusEl.value;
    const priority = priorityEl.value;
    const bugEpic = bugEpicEl ? bugEpicEl.value : '';
    const bugStatus = bugStatusEl.value;
    const bugSeverity = bugSeverityEl ? bugSeverityEl.value : '';
    const search = searchEl.value.toLowerCase();
    document.querySelectorAll('.story-row').forEach(row => {
      const hide =
        (epic && row.dataset.epic !== epic) ||
        (status && row.dataset.status !== status) ||
        (priority && row.dataset.priority !== priority) ||
        (search && !row.innerText.toLowerCase().includes(search));
      row.style.display = hide ? 'none' : '';
    });
    document.querySelectorAll('.bug-row, .bug-compact-row').forEach(row => {
      const rowEpic = row.dataset.epic || '_ungrouped';
      const rowSeverity = row.dataset.severity || '';
      const hide =
        (bugEpic && rowEpic !== bugEpic) ||
        (bugStatus && row.dataset.status !== bugStatus) ||
        (bugSeverity && rowSeverity !== bugSeverity) ||
        (search && !row.innerText.toLowerCase().includes(search));
      row.style.display = hide ? 'none' : '';
    });
    document.querySelectorAll('.lesson-row').forEach(row => {
      const hide = search && !row.innerText.toLowerCase().includes(search);
      row.style.display = hide ? 'none' : '';
    });
    document.querySelectorAll('[data-trace-epic]').forEach(row => {
      const hide = search && !row.innerText.toLowerCase().includes(search);
      if (hide) row.classList.add('hidden');
    });
    document.querySelectorAll('.epic-block').forEach(block => {
      // Card view: story rows live in a sibling div (epic-cards-*), not inside .epic-block
      const wrapper = block.closest('.mb-8');
      const searchScope = wrapper || block;
      const visibleChildren = searchScope.querySelectorAll('.story-row:not([style*="display: none"])');
      const header = block.querySelector('div[onclick*="toggleSection"]');
      if (header) header.style.display = visibleChildren.length > 0 ? '' : 'none';
      block.style.display = visibleChildren.length > 0 ? '' : 'none';
      if (wrapper) wrapper.style.display = visibleChildren.length > 0 ? '' : 'none';
    });
    document.querySelectorAll('.ksw-swimlane').forEach(swimlane => {
      const visibleChildren = swimlane.querySelectorAll('.story-row:not([style*="display: none"])');
      const header = swimlane.querySelector('.ksw-swim-hdr');
      if (header) header.style.display = visibleChildren.length > 0 ? '' : 'none';
    });
    document.querySelectorAll('.bug-epic-header').forEach(header => {
      let container, visibleChildren;
      if (header.tagName === 'TR') {
        // Column view: header <tr> is in its own <tbody>; bug rows are in the next sibling <tbody>
        const headerTbody = header.closest('tbody');
        container = headerTbody ? headerTbody.nextElementSibling : null;
        visibleChildren = container ? container.querySelectorAll('tr:not([style*="display: none"])') : [];
      } else {
        // Card/compact view: bug rows are descendants of .bug-epic-card wrapper
        container = header.closest('.bug-epic-card');
        visibleChildren = container
          ? container.querySelectorAll('.bug-row:not([style*="display: none"]), .bug-compact-row:not([style*="display: none"])')
          : [];
      }
      header.style.display = visibleChildren.length > 0 ? '' : 'none';
      const countSpan = header.querySelector('.bug-count');
      if (countSpan) countSpan.textContent = '(' + visibleChildren.length + ')';
      // For card/compact view, hide the whole .bug-epic-card when no bugs match
      if (container && container.tagName === 'DIV') {
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
    ['f-epic','f-status','f-priority','f-bug-epic','f-bug-status','f-bug-severity'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const searchEl2 = document.getElementById('f-search');
    if (searchEl2) searchEl2.value = '';
    ['f-epic','f-status','f-priority','f-bug-epic','f-bug-status','f-bug-severity','f-search'].forEach(k => localStorage.removeItem(k));
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
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️ Light' : '🌙 Dark';

    initActivityPanel();

    // Restore active tab from URL hash or localStorage
    const hash = window.location.hash.replace('#', '');
    const savedTab = VALID_TABS.includes(hash) ? hash : (VALID_TABS.includes(localStorage.getItem('activeTab')) ? localStorage.getItem('activeTab') : 'hierarchy');
    showTab(savedTab);

    // Restore hierarchy view preference
    setHierarchyView(localStorage.getItem('hierarchyView') || 'column');

    // Auto-collapse Done epics in column view
    document.querySelectorAll('#hier-column-view .epic-block[data-epic-status="Done"]').forEach(function(block) {
      var id = block.querySelector('[id^="epic-stories-"]');
      var arrow = block.querySelector('[id^="epic-arrow-"]');
      if (id && !id.classList.contains('hidden')) toggleSection(id.id, arrow && arrow.id);
    });

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
    var isDark = html.getAttribute('data-theme') !== 'dark';
    html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('pv-theme', isDark ? 'dark' : 'light');
    var themeBtn2 = document.getElementById('theme-toggle');
    if (themeBtn2) themeBtn2.textContent = isDark ? '☀️ Light' : '🌙 Dark';
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

  // ── Global Search ──────────────────────────────────────────────────────
  var _searchDebounce;
  var _searchCursor = -1;
  var _searchResults = [];
  var _searchQuery = '';

  function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _highlightMatch(text, query) {
    if (!query || !text) return _escHtml(text || '');
    var lo = text.toLowerCase(), q = query.toLowerCase();
    var idx = lo.indexOf(q);
    if (idx === -1) return _escHtml(text);
    return _escHtml(text.slice(0, idx)) + '<strong>' + _escHtml(text.slice(idx, idx + q.length)) + '</strong>' + _escHtml(text.slice(idx + q.length));
  }

  function _scoreMatch(entry, query) {
    var q = (query || '').toLowerCase().trim();
    if (!q) return -1;
    var fields = [entry.id || '', entry.title || '', entry.rule || ''];
    var haystack = fields.join(' ').toLowerCase();
    if ((entry.id || '').toLowerCase() === q) return 4;
    if (fields.some(function(f){ return f.toLowerCase().startsWith(q); })) return 3;
    if (haystack.includes(q)) return 2;
    var i = 0;
    for (var j = 0; j < haystack.length && i < q.length; j++) { if (haystack[j] === q[i]) i++; }
    return i === q.length ? 1 : 0;
  }

  function openSearch() {
    document.getElementById('search-backdrop').style.display = 'block';
    document.getElementById('search-modal').style.display = 'block';
    var input = document.getElementById('search-input');
    input.value = ''; _searchCursor = -1; _searchResults = []; _searchQuery = '';
    _renderSearchBody('');
    input.focus();
  }

  function closeSearch() {
    document.getElementById('search-backdrop').style.display = 'none';
    document.getElementById('search-modal').style.display = 'none';
    _searchCursor = -1; _searchResults = [];
  }

  function _updateCursor() {
    document.querySelectorAll('#search-body .search-result').forEach(function(el) {
      el.classList.toggle('search-cursor', parseInt(el.dataset.idx) === _searchCursor);
    });
    var active = document.querySelector('#search-body .search-result.search-cursor');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function _runSearch(q) {
    _searchCursor = -1; _searchResults = []; _searchQuery = q;
    if (!q.trim()) { _renderSearchBody(''); return; }

    var scored = [];
    SEARCH_INDEX.forEach(function(entry) {
      var s = _scoreMatch(entry, q);
      if (s > 0) scored.push({ entry: entry, score: s });
    });
    scored.sort(function(a, b) { return b.score - a.score; });

    var epics   = scored.filter(function(r){ return r.entry.type === 'epic';   }).slice(0,3).map(function(r){ return r.entry; });
    var stories = scored.filter(function(r){ return r.entry.type === 'story'; }).slice(0,4).map(function(r){ return r.entry; });
    var bugs    = scored.filter(function(r){ return r.entry.type === 'bug';   }).slice(0,4).map(function(r){ return r.entry; });
    var lessons = scored.filter(function(r){ return r.entry.type === 'lesson';}).slice(0,3).map(function(r){ return r.entry; });
    _searchResults = epics.concat(stories).concat(bugs).concat(lessons);

    if (_searchResults.length === 0) {
      document.getElementById('search-body').innerHTML = '<div class="search-no-results">No results for &ldquo;' + _escHtml(q) + '&rdquo;</div>';
      return;
    }

    var icons = { epic:'🗂️', story:'📋', bug:'🐛', lesson:'💡' };

    function _renderGroup(group, label) {
      if (!group.length) return '';
      var rows = group.map(function(entry) {
        var idx = _searchResults.indexOf(entry);
        var mainText = entry.title || entry.rule || entry.id;
        var sub = entry.type === 'epic' ? entry.status : entry.type === 'story' ? entry.epicId : entry.type === 'bug' ? entry.severity : entry.id;
        return '<div class="search-result" data-idx="' + idx + '">' +
          '<span class="search-result-icon">' + icons[entry.type] + '</span>' +
          '<span class="search-result-title">' + _highlightMatch(mainText, q) + '</span>' +
          '<span class="search-result-sub">' + _escHtml(sub) + '</span>' +
          '</div>';
      }).join('');
      return '<div class="search-section-header">' + label + '</div>' + rows;
    }

    document.getElementById('search-body').innerHTML =
      _renderGroup(epics,   'Epics') +
      _renderGroup(stories, 'Stories') +
      _renderGroup(bugs,    'Bugs') +
      _renderGroup(lessons, 'Lessons');

    if (_searchResults.length > 0) { _searchCursor = 0; _updateCursor(); }
  }

  function navigateTo(idx) {
    var entry = _searchResults[idx];
    if (!entry) return;
    var q = _searchQuery;
    if (q) _saveRecent(q);
    closeSearch();
    showTab(entry.tabName);
    // Stories only have a DOM ID on the column-view row — switch to column view first
    if (entry.type === 'story') setHierarchyView('column');
    setTimeout(function() {
      if (entry.type === 'story' && entry.epicId) {
        var sec = document.getElementById('epic-stories-' + entry.epicId);
        if (sec && sec.classList.contains('hidden')) {
          var arrow = document.getElementById('epic-arrow-' + entry.epicId);
          toggleSection(sec.id, arrow && arrow.id);
        }
      }
      var domId = entry.domId || entry.domIdCol || entry.domIdCard;
      var el = document.getElementById(domId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('search-highlight');
        el.addEventListener('animationend', function() { el.classList.remove('search-highlight'); }, { once: true });
      }
    }, 50);
  }

  function _renderSearchBody(q) {
    if (!q) { _renderRecentSearches(); return; }
    _runSearch(q);
  }

  // Event delegation for result clicks
  document.getElementById('search-body').addEventListener('click', function(e) {
    var el = e.target.closest('.search-result');
    if (el) navigateTo(parseInt(el.dataset.idx, 10));
  });

  document.getElementById('search-input').addEventListener('input', function() {
    clearTimeout(_searchDebounce);
    var q = this.value;
    _searchDebounce = setTimeout(function() { _renderSearchBody(q); }, 200);
  });

  document.getElementById('search-input').addEventListener('focus', function() {
    if (!this.value) _renderRecentSearches();
  });

  // Keyboard navigation: ↑↓↵ ESC
  document.getElementById('search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeSearch(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _searchCursor = Math.min(_searchCursor + 1, _searchResults.length - 1);
      _updateCursor();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _searchCursor = Math.max(_searchCursor - 1, 0);
      _updateCursor();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (_searchCursor >= 0 && _searchResults[_searchCursor]) navigateTo(_searchCursor);
    }
  });

  // Global ⌘K / Ctrl+K shortcut
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-modal').style.display === 'block' ? closeSearch() : openSearch();
    }
  });

  // Recent searches
  function _loadRecent() {
    try { return JSON.parse(localStorage.getItem('recentSearches') || '[]'); } catch(e) { return []; }
  }

  function _saveRecent(q) {
    if (!q) return;
    var list = _loadRecent().filter(function(x) { return x !== q; });
    list.unshift(q);
    localStorage.setItem('recentSearches', JSON.stringify(list.slice(0, 5)));
  }

  function _renderRecentSearches() {
    var list = _loadRecent();
    var body = document.getElementById('search-body');
    if (!list.length) { body.innerHTML = ''; return; }
    body.innerHTML =
      '<div class="search-recent-header">' +
        '<span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--clr-text-muted)">Recent Searches</span>' +
        '<button onclick="_clearRecent()" style="font-size:11px;color:var(--clr-text-muted);background:none;border:none;cursor:pointer;padding:0">× Clear</button>' +
      '</div>' +
      '<div class="search-recent-pills">' +
        list.map(function(q) {
          return '<span class="search-recent-pill" data-recent="' + _escHtml(q) + '">' + _escHtml(q) + '</span>';
        }).join('') +
      '</div>';
  }

  function _clearRecent() {
    localStorage.removeItem('recentSearches');
    document.getElementById('search-body').innerHTML = '';
  }

  // Pill click via event delegation on search-body (second listener — merged with result clicks)
  document.getElementById('search-body').addEventListener('click', function(e) {
    var pill = e.target.closest('.search-recent-pill');
    if (pill) {
      var q = pill.dataset.recent || '';
      document.getElementById('search-input').value = q;
      _runSearch(q);
    }
  });

  // US-0102: Traceability crosshair hover
  (function() {
    var tbl = document.querySelector('#tab-traceability table');
    if (!tbl) return;
    tbl.addEventListener('mouseover', function(e) {
      var td = e.target.closest('td[data-col]');
      if (!td) return;
      var col = td.dataset.col;
      td.closest('tr').classList.add('trace-hover-row');
      var th = tbl.querySelector('th[data-col="' + col + '"]');
      if (th) th.classList.add('trace-hover-col');
    });
    tbl.addEventListener('mouseout', function(e) {
      var td = e.target.closest('td[data-col]');
      if (!td) return;
      td.closest('tr').classList.remove('trace-hover-row');
      var col = td.dataset.col;
      var th = tbl.querySelector('th[data-col="' + col + '"]');
      if (th) th.classList.remove('trace-hover-col');
    });
  })();
  </script>`;
}

function renderPrintCSS() {
  return `
  <style>
  ${generateCssTokens()}
  /* US-0097: Badge base + semantic classes */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
    border: 1px solid var(--badge-neutral-border);
    background-color: var(--badge-neutral-bg);
    color: var(--badge-neutral-text);
    white-space: nowrap;
  }
  .badge-success { background-color: var(--badge-success-bg); color: var(--badge-success-text); border-color: var(--badge-success-border); }
  .badge-warn    { background-color: var(--badge-warn-bg);    color: var(--badge-warn-text);    border-color: var(--badge-warn-border); }
  .badge-danger  { background-color: var(--badge-danger-bg);  color: var(--badge-danger-text);  border-color: var(--badge-danger-border); }
  .badge-info    { background-color: var(--badge-info-bg);    color: var(--badge-info-text);    border-color: var(--badge-info-border); }
  .badge-neutral { background-color: var(--badge-neutral-bg); color: var(--badge-neutral-text); border-color: var(--badge-neutral-border); }
  /* US-0097 AC-0317: .badge-dot variant — 8px coloured circle + text for dense contexts */
  .badge-dot {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--clr-text-primary);
    background: transparent;
    border: none;
    padding: 0;
    white-space: nowrap;
  }
  .badge-dot::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--badge-neutral-text);
    flex-shrink: 0;
  }
  .badge-dot.badge-success::before { background-color: var(--badge-success-text); }
  .badge-dot.badge-warn::before    { background-color: var(--badge-warn-text); }
  .badge-dot.badge-danger::before  { background-color: var(--badge-danger-text); }
  .badge-dot.badge-info::before    { background-color: var(--badge-info-text); }
  .badge-dot.badge-neutral::before { background-color: var(--badge-neutral-text); }
  /* === Dark mode fallbacks === */
  [data-theme="dark"] body{
    background-color: var(--clr-body-bg);
    color: var(--clr-text-primary);
    background-image: radial-gradient(rgba(255,255,255,0.028) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  [data-theme="dark"] #topbar-fixed { border-color: rgba(0,80,179,0.5) !important; }
  [data-theme="dark"] #sidebar { border-color: var(--clr-border) !important; }
  [data-theme="dark"] #filter-bar { background-color: var(--clr-panel-bg) !important; border-color: var(--clr-border) !important; }
  [data-theme="dark"] #filter-bar select, [data-theme="dark"] #filter-bar input { background-color: var(--clr-input-bg) !important; border-color: var(--clr-input-border) !important; color: var(--clr-input-text) !important; }
  [data-theme="dark"] #filter-bar button { color: var(--clr-text-muted) !important; }
  [data-theme="dark"] .epic-block { border-color: var(--clr-border) !important; }
  [data-theme="dark"] .story-row { color: var(--clr-text-primary); }
  [data-theme="dark"] .story-row p { color: var(--clr-text-primary) !important; }
  [data-theme="dark"] #activity-panel { background-color: var(--clr-panel-bg) !important; border-color: var(--clr-border) !important; color: var(--clr-text-primary) !important; }
  [data-theme="dark"] #activity-panel li { border-color: var(--clr-border) !important; }
  /* === Hover transforms === */
  .story-card-hover { transition: transform 150ms ease, box-shadow 150ms ease; }
  .story-card-hover:hover { transform: scale(1.02); box-shadow: var(--shadow-card-hover); }
  /* Tabs that should fill the full viewport height */
  .tab-fill { display: flex; flex-direction: column; height: calc(100vh - var(--sticky-top, 100px)); box-sizing: border-box; }
  .tab-fill .scroll-table { flex: 1; min-height: 0; max-height: none; }
  .scroll-table { overflow: auto; max-height: calc(100vh - var(--sticky-top, 100px) - 3rem); }
  .scroll-table thead th { position: sticky; top: 0; z-index: 10; background-color: var(--clr-header-bg); color: var(--clr-header-text); }
  /* Zebra striping + row hover — nth-child(even) scopes WITHIN each tbody,
     so Bugs/Costs epic-header tbodies (single row) are unaffected and only
     data-row tbodies alternate. Epic header rows with inline background styles
     keep their accent colour. tfoot rows are excluded by the tbody selector. */
  .scroll-table tbody tr:nth-child(even) { background-color: var(--clr-row-alt); }
  .scroll-table tbody tr:hover { background-color: var(--clr-row-hover); }
  /* Costs tab: scroll naturally with the page, no viewport-clipped tables */
  #tab-costs .scroll-table { max-height: none; overflow: visible; }
  /* Kanban: Epic swimlane grid */
  .ksw-outer { overflow: auto; height: calc(100vh - var(--sticky-top, 100px) - 1rem); padding: 16px; }
  .ksw-board { min-width: calc(160px + 5 * 200px); }
  .ksw-header-row, .ksw-swim-body { display: grid; grid-template-columns: 160px repeat(5, minmax(200px, 1fr)); }
  /* US-0101: Kanban polish — AC-0329 column header gradient + accent rule */
  .ksw-status-cell { padding: 8px 10px; background: linear-gradient(to bottom, var(--clr-header-bg, #f8fafc), var(--clr-body-bg, #f1f5f9)); color: var(--clr-header-text); border-bottom: 2px solid var(--clr-accent, #7c3aed); position: sticky; top: 0; z-index: 6; }
  [data-theme="dark"] .ksw-status-cell { background: linear-gradient(to bottom, var(--clr-header-bg), var(--clr-panel-bg)); }
  .ksw-label-cell { padding: 8px 10px; }
  .ksw-header-row .ksw-label-cell { background: var(--clr-header-bg); border-bottom: 2px solid var(--clr-border); position: sticky; top: 0; z-index: 6; }
  .ksw-swimlane { border-left: 3px solid transparent; margin-bottom: 4px; }
  .ksw-swim-hdr { display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; background: var(--clr-surface); border-bottom: 1px solid var(--clr-border); user-select: none; }
  .ksw-swim-hdr:hover { background: var(--clr-row-hover, rgba(124,58,237,0.08)); }
  .ksw-arrow { font-size: 10px; color: var(--clr-text-muted); flex-shrink: 0; }
  .ksw-epic-title { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ksw-epic-count { font-size: 11px; color: var(--clr-text-muted); flex-shrink: 0; }
  .ksw-cards-cell { padding: 8px 6px; border-right: 1px solid var(--clr-border); min-height: 40px; }
  /* US-0101: AC-0331 In-Progress column pulse */
  .ksw-inprogress { animation: kswPulse 3s ease-in-out infinite; }
  @keyframes kswPulse {
    0%, 100% { background: transparent; }
    50% { background: color-mix(in srgb, var(--clr-accent) 6%, transparent); }
  }
  /* US-0101: AC-0332 WIP count pill */
  .wip-pill { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:18px; border-radius:9px; padding:0 5px; font-size:11px; font-weight:600; background:var(--clr-border); color:var(--clr-text-muted,#64748b); }
  .wip-over { background:var(--badge-danger-bg,#fef2f2); color:var(--badge-danger-text,#dc2626); border:1px solid var(--badge-danger-border,#fca5a5); }
  [data-theme="dark"] .scroll-table table thead { background-color: transparent; }
  [data-theme="dark"] table tbody tr { border-color: var(--clr-border) !important; }
  [data-theme="dark"] .bg-white { background-color: var(--clr-panel-bg) !important; }
  [data-theme="dark"] .dark\\:bg-slate-800 { background-color: var(--clr-panel-bg) !important; }
  [data-theme="dark"] .dark\\:bg-slate-700 { background-color: var(--clr-surface-raised) !important; }
  [data-theme="dark"] .border-slate-200, [data-theme="dark"] .dark\\:border-slate-700, [data-theme="dark"] .dark\\:border-slate-600 { border-color: var(--clr-border) !important; }
  [data-theme="dark"] .text-slate-700, [data-theme="dark"] .text-slate-600 { color: var(--clr-text-primary) !important; }
  [data-theme="dark"] .text-slate-500 { color: var(--clr-text-muted) !important; }
  [data-theme="dark"] h3 { color: var(--clr-text-primary) !important; }
  /* US-0098: Staggered tab content animation */
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .anim-stagger {
    animation: fadeInUp 240ms ease both;
    animation-delay: calc(var(--i, 0) * 20ms);
  }
  @media (prefers-reduced-motion: reduce) {
    .anim-stagger { animation: none; }
  }
  /* US-0104: Trends filter bar */
  .trends-filter-bar { display: flex; gap: 6px; flex-wrap: wrap; }
  .trends-range-btn {
    padding: 4px 14px; border-radius: 16px; border: 1px solid var(--clr-border-mid);
    background: var(--clr-panel-bg); color: var(--clr-text-secondary);
    font-size: 12px; font-weight: 500; cursor: pointer; transition: all 150ms;
  }
  .trends-range-btn.active { background: var(--clr-accent); color: #fff; border-color: var(--clr-accent); }
  .trends-range-btn:hover:not(.active) { border-color: var(--clr-accent); color: var(--clr-accent); }
  /* US-0105: Costs tab sparklines + polish */
  .sparkline-svg { display: inline-block; vertical-align: middle; color: var(--clr-accent); opacity: 0.7; }
  .currency-sign { font-size: 0.72em; vertical-align: super; opacity: 0.65; }
  .delta-arrow { font-size: 11px; font-weight: 600; margin-left: 6px; vertical-align: middle; }
  .delta-up   { color: var(--badge-danger-text, #dc2626); }
  .delta-down { color: var(--badge-success-text, #16a34a); }
  .delta-flat { color: var(--clr-text-muted); }
  .progress-bar { width: 60px; height: 6px; background: #334155; border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle; }
  .pb-fill { height: 100%; border-radius: 3px; }
  .pb-ok   { background: #22c55e; }
  .pb-warn { background: #eab308; }
  .pb-danger { background: #ef4444; }
  /* US-0107: Lessons card polish */
  .lesson-accent-bar { border-left-width: 4px; border-left-style: solid; }
  .lesson-cat-icon { font-size: 1em; margin-right: 4px; }
  .lesson-bug-inline summary::-webkit-details-marker { display: none; }
  .lesson-bug-inline summary { display: flex; }
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
  /* US-0100: Hierarchy tab polish */
  .epic-id-display { font-family: var(--font-display, inherit); letter-spacing: 0.08em; text-transform: uppercase; }
  .epic-id-label { font-size: 0.65em; opacity: 0.6; }
  .epic-id-num { font-weight: 700; }
  .epic-progress-track { height: 2px; background: var(--clr-border); border-radius: 1px; margin: 4px 0 8px; }
  .epic-progress-fill { height: 100%; border-radius: 1px; transition: width 0.4s ease; }
  .ac-guide { border-left: 1px solid var(--clr-accent, #7c3aed); padding-left: 12px; margin-left: 4px; }
  [data-theme="dark"] .ac-guide { border-left-color: var(--clr-accent, #8b5cf6); }
  .epic-accent-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-right: 4px; vertical-align: middle; }
  /* US-0102: Traceability matrix redesign */
  .tc-dot { text-align: center; vertical-align: middle; width: 32px; }
  .tc-dot::after { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
  .tc-dot-success::after { background: var(--badge-success-text, #16a34a); }
  .tc-dot-danger::after { background: var(--badge-danger-text, #dc2626); }
  .tc-dot-warn::after { background: var(--badge-warn-text, #d97706); }
  .trace-hover-row td { background: var(--clr-accent-subtle, rgba(124,58,237,0.06)); }
  .trace-hover-col { background: var(--clr-accent-subtle, rgba(124,58,237,0.06)) !important; }
  .trace-sticky-col { position: sticky; left: 0; z-index: 5; background: var(--clr-panel-bg); }
  .trace-caption { caption-side: bottom; text-align: left; font-size: 12px; color: var(--clr-text-muted, rgba(255,255,255,0.5)); padding: 8px 4px 0; }
  /* US-0106: Bug severity styling */
  .badge-sev { border-radius: 2px; font-variant: small-caps; letter-spacing: 0.05em; }
  .copy-btn { opacity: 0; transition: opacity 150ms; background: none; border: none; cursor: pointer; font-size: 12px; color: var(--clr-text-muted); padding: 0 2px; vertical-align: middle; }
  .truncate:hover .copy-btn { opacity: 1; }
  .lesson-pill { display: inline-flex; align-items: center; gap: 4px; background: var(--badge-info-bg, rgba(59,130,246,0.12)); color: var(--badge-info-text, #3b82f6); border: 1px solid var(--badge-info-border, rgba(59,130,246,0.3)); border-radius: 12px; padding: 1px 8px; font-size: 11px; text-decoration: none; }
  .lesson-pill-id { font-weight: 600; }
  .bug-compact-row { display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-bottom: 1px solid var(--clr-border); font-size: 13px; }
  .bug-compact-id { font-family: monospace; font-size: 11px; opacity: 0.7; min-width: 80px; }
  .bug-compact-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  </style>`;
}

module.exports = { renderScripts, renderPrintCSS };
