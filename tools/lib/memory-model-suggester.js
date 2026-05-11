'use strict';

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
]);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function tokenise(task) {
  if (!task) return [];
  return task
    .toLowerCase()
    .split(/[\s,./!?;:()[\]"'`-]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function scoreEntry(entry, tokens) {
  const titleLower = (entry.title || '').toLowerCase();
  const bodyLower = (entry.headBody || '').toLowerCase();
  let score = 0;
  const matchedTokens = [];
  for (const token of tokens) {
    const re = new RegExp('\\b' + escapeRegex(token), 'g');
    const titleMatches = (titleLower.match(re) || []).length;
    const bodyMatches = (bodyLower.match(re) || []).length;
    if (titleMatches > 0) {
      score += 2;
      matchedTokens.push(token);
    } else if (bodyMatches > 0) {
      score += bodyMatches;
      matchedTokens.push(token);
    }
  }
  return { score, matchedTokens };
}

function suggestModel(entries, task) {
  const tokens = tokenise(task);
  if (tokens.length === 0) {
    throw new Error('task description too short after filtering stopwords');
  }

  const scored = [];
  for (const entry of entries) {
    const { score, matchedTokens } = scoreEntry(entry, tokens);
    if (score >= 2) {
      const complexitySource = entry.complexity ? 'explicit' : 'default';
      const effectiveComplexity = entry.complexity || 'medium';
      scored.push({
        title: entry.title,
        file: entry.file,
        complexity: effectiveComplexity,
        complexitySource,
        score,
        matchedTokens,
      });
    }
  }

  if (scored.length === 0) {
    return {
      model: 'sonnet',
      matched: [],
      reason: 'No topics matched task description → sonnet (safe default)',
    };
  }

  const hasNonLow = scored.some((s) => s.complexity === 'medium' || s.complexity === 'high');
  if (hasNonLow) {
    const high = scored.find((s) => s.complexity === 'high');
    if (high) {
      return {
        model: 'sonnet',
        matched: scored,
        reason: `Found high-complexity topic '${high.title}' → sonnet`,
      };
    }
    const medium = scored.find((s) => s.complexity === 'medium' && s.complexitySource === 'explicit');
    if (medium) {
      return {
        model: 'sonnet',
        matched: scored,
        reason: `Found medium-complexity topic '${medium.title}' → sonnet`,
      };
    }
    const defaultedCount = scored.filter((s) => s.complexitySource === 'default').length;
    return {
      model: 'sonnet',
      matched: scored,
      reason: `${defaultedCount} matched topics have no explicit complexity hints → sonnet (safe default for unknown)`,
    };
  }

  return {
    model: 'haiku',
    matched: scored,
    reason: `All ${scored.length} matched topics low-complexity → haiku`,
  };
}

module.exports = { suggestModel, tokenise, escapeRegex, scoreEntry };
