'use strict';

const CANONICAL_PERSONAS = [
  'compass',
  'palette',
  'pixel',
  'keystone',
  'lens',
  'forge',
  'sentinel',
  'circuit',
  'plan-author',
];

/**
 * Parse Lens findings from a markdown document.
 * Expected format: a `## Findings` section with bullets like:
 *   - @compass: AC-007 missing edge case
 *   - @palette @keystone: contrast plus spec gap
 * Returns array of { primary, cc[], text, warning? }.
 */
function parseLensFindings(markdown) {
  if (!markdown) return [];

  // Find the `## Findings` section. Stop at next `## ` heading or end of file.
  // (?![\s\S]) matches end-of-string (avoids multiline $ matching line endings).
  const findingsMatch = markdown.match(/^##\s+Findings[ \t]*\n([\s\S]*?)(?=\n##\s+|(?![\s\S]))/m);
  if (!findingsMatch) return [];

  const body = findingsMatch[1];
  const lines = body.split('\n');
  const findings = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) continue;

    // Strip bullet prefix
    const content = trimmed.replace(/^-\s*/, '');

    // Match leading @tags (possibly multiple separated by spaces)
    const tagMatch = content.match(/^((?:@[a-zA-Z][a-zA-Z0-9-]*\s*)+):\s*(.*)$/);
    if (!tagMatch) continue;

    const tagsString = tagMatch[1];
    const text = tagMatch[2].trim();
    const tags = (tagsString.match(/@([a-zA-Z][a-zA-Z0-9-]*)/g) || []).map((t) => t.slice(1).toLowerCase());

    if (tags.length === 0) continue;

    const finding = {
      primary: tags[0],
      cc: tags.slice(1),
      text,
    };

    if (!CANONICAL_PERSONAS.includes(finding.primary)) {
      finding.warning = `unknown persona '${finding.primary}'; not in canonical list`;
    }

    findings.push(finding);
  }

  return findings;
}

module.exports = {
  parseLensFindings,
  CANONICAL_PERSONAS,
};
