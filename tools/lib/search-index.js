'use strict';

/**
 * Score how well an index entry matches a query string.
 * Returns: 4 = exact ID, 3 = starts-with, 2 = substring, 1 = fuzzy, 0 = no match, -1 = empty query.
 */
function scoreMatch(entry, query) {
  var q = (query || '').toLowerCase().trim();
  if (!q) return -1;

  var fields = [entry.id || '', entry.title || '', entry.rule || ''];
  var haystack = fields.join(' ').toLowerCase();

  if ((entry.id || '').toLowerCase() === q) return 4;
  if (
    fields.some(function (f) {
      return f.toLowerCase().startsWith(q);
    })
  )
    return 3;
  if (haystack.includes(q)) return 2;

  // Fuzzy: all chars of query appear in order within haystack
  var i = 0;
  for (var j = 0; j < haystack.length && i < q.length; j++) {
    if (haystack[j] === q[i]) i++;
  }
  return i === q.length ? 1 : 0;
}

/**
 * Escape </script> sequences so index entries are safe to embed inside a <script> block.
 */
function _safeStr(s) {
  return (s || '').replace(/<\/script>/gi, '<\\/script>');
}

/**
 * Build a search index array from dashboard data.
 * String values are sanitized so the index is safe to JSON.stringify inside a <script> block.
 */
function buildSearchIndex(data) {
  var index = [];

  (data.stories || []).forEach(function (story) {
    index.push({
      type: 'story',
      id: _safeStr(story.id),
      title: _safeStr(story.title),
      epicId: _safeStr(story.epicId),
      status: _safeStr(story.status),
      tabName: 'hierarchy',
      domId: 'story-' + _safeStr(story.id),
    });
  });

  (data.bugs || []).forEach(function (bug) {
    index.push({
      type: 'bug',
      id: _safeStr(bug.id),
      title: _safeStr(bug.title),
      severity: _safeStr(bug.severity),
      status: _safeStr(bug.status),
      tabName: 'bugs',
      domId: 'bug-row-' + _safeStr(bug.id),
    });
  });

  (data.lessons || []).forEach(function (lesson) {
    index.push({
      type: 'lesson',
      id: _safeStr(lesson.id),
      rule: _safeStr(lesson.rule),
      tabName: 'lessons',
      domIdCol: 'lesson-col-' + _safeStr(lesson.id),
      domIdCard: 'lesson-card-' + _safeStr(lesson.id),
    });
  });

  (data.epics || []).forEach(function (epic) {
    index.push({
      type: 'epic',
      id: _safeStr(epic.id),
      title: _safeStr(epic.title),
      status: _safeStr(epic.status),
      tabName: 'hierarchy',
      domId: 'epic-arrow-' + _safeStr(epic.id),
    });
  });

  return index;
}

module.exports = { scoreMatch, buildSearchIndex };
