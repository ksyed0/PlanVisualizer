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
  if (fields.some(function (f) { return f.toLowerCase().startsWith(q); })) return 3;
  if (haystack.includes(q)) return 2;

  // Fuzzy: all chars of query appear in order within haystack
  var i = 0;
  for (var j = 0; j < haystack.length && i < q.length; j++) {
    if (haystack[j] === q[i]) i++;
  }
  return i === q.length ? 1 : 0;
}

module.exports = { scoreMatch };
