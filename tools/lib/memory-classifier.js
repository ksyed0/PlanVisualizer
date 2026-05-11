'use strict';

function extractDate(title) {
  const dateMatches = title.match(/\b(\d{4})-(\d{2})-(\d{2})(?:\/(\d{1,2}))?/g);
  if (!dateMatches || dateMatches.length === 0) return null;
  let best = null;
  for (const m of dateMatches) {
    const range = m.match(/^(\d{4})-(\d{2})-(\d{2})\/(\d{1,2})$/);
    let dt;
    if (range) {
      const [, y, mo, , d2] = range;
      dt = `${y}-${mo}-${d2.padStart(2, '0')}`;
    } else {
      dt = m;
    }
    if (best === null || dt > best) best = dt;
  }
  return best;
}

function slugify(title) {
  let s = title.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/[—–]/g, ' ');

  // Truncate at word boundary before slugifying, if needed
  if (s.length > 60) {
    const truncated = s.slice(0, 60);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 30) {
      s = s.slice(0, lastSpace);
    } else {
      s = truncated;
    }
  }

  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

function classifySection(title) {
  if (/^lessons learned$/i.test(title.trim())) {
    return { category: 'lessons', slug: 'lessons-learned', date: null };
  }
  let category;
  if (/\(as of /i.test(title)) {
    category = 'snapshots';
  } else if (/\(session \d+/i.test(title) || /^session \d+/i.test(title)) {
    category = 'sessions';
  } else {
    category = 'topics';
  }
  return { category, slug: slugify(title), date: extractDate(title) };
}

module.exports = { classifySection, slugify, extractDate };
