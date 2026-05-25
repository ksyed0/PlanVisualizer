'use strict';

const fs = require('fs');

// Lazy-load parsers/serializers via factories so a single bad import doesn't
// crash the harness when an audit kind isn't needed.
const PARSE_FNS = {
  'release-plan': (text) => {
    const m = require('../parse-release-plan');
    const r = m.parseReleasePlan(text);
    return { story: r.stories, epic: r.epics };
  },
  bugs: (text) => ({ bug: require('../parse-bugs').parseBugs(text) }),
  lessons: (text) => ({ lesson: require('../parse-lessons').parseLessons(text) }),
  'test-cases': (text) => ({ testCase: require('../parse-test-cases').parseTestCases(text) }),
};

const SERIALIZER_FNS = {
  story: () => require('./serializers/story-serializer'),
  epic: () => require('./serializers/epic-serializer'),
  bug: () => require('./serializers/bug-serializer'),
  lesson: () => require('./serializers/lesson-serializer'),
  testCase: () => require('./serializers/test-case-serializer'),
};

const KIND_ENTITIES = {
  'release-plan': ['story', 'epic'],
  bugs: ['bug'],
  lessons: ['lesson'],
  'test-cases': ['testCase'],
};

/**
 * Run the round-trip completeness audit against one file.
 *
 * Returns { entitiesParsed, divergences } where each divergence is
 *   { entityKind, entityId, field, original, roundTripped }.
 */
function auditFile({ path: filePath, kind }) {
  if (!fs.existsSync(filePath)) throw new Error(`auditFile: ${filePath} not found`);
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = PARSE_FNS[kind](text);
  let entitiesParsed = 0;
  const divergences = [];
  for (const entityKind of KIND_ENTITIES[kind]) {
    const entities = parsed[entityKind] || [];
    entitiesParsed += entities.length;
    const serializer = SERIALIZER_FNS[entityKind]();
    for (const ent of entities) {
      let serialized;
      try {
        serialized = serializer.serialize(ent);
      } catch (e) {
        divergences.push({
          entityKind,
          entityId: ent.id,
          field: '*serialize-error*',
          original: 'n/a',
          roundTripped: e.message,
        });
        continue;
      }
      let reparsed;
      try {
        const wrap = kind === 'release-plan' ? `# Test\n\n\`\`\`\n${serialized}\`\`\`\n` : serialized;
        const round = PARSE_FNS[kind](wrap);
        reparsed = (round[entityKind] || [])[0];
      } catch (e) {
        divergences.push({
          entityKind,
          entityId: ent.id,
          field: '*reparse-error*',
          original: 'n/a',
          roundTripped: e.message,
        });
        continue;
      }
      if (!reparsed) {
        divergences.push({
          entityKind,
          entityId: ent.id,
          field: '*reparse-missing*',
          original: 'present',
          roundTripped: 'null',
        });
        continue;
      }
      const allKeys = new Set([...Object.keys(ent), ...Object.keys(reparsed)]);
      for (const k of allKeys) {
        const a = JSON.stringify(ent[k]);
        const b = JSON.stringify(reparsed[k]);
        if (a !== b) {
          divergences.push({ entityKind, entityId: ent.id, field: k, original: ent[k], roundTripped: reparsed[k] });
        }
      }
    }
  }
  return { entitiesParsed, divergences };
}

function auditAll(targets) {
  const report = { totalFiles: targets.length, totalEntities: 0, totalDivergences: 0, perFile: [] };
  for (const t of targets) {
    const r = auditFile(t);
    report.totalEntities += r.entitiesParsed;
    report.totalDivergences += r.divergences.length;
    report.perFile.push({ ...t, ...r });
  }
  return report;
}

module.exports = { auditFile, auditAll };
