'use strict';

/**
 * Migration 001: Normalise fenced-block markdown to canonical serializer output.
 *
 * Targets: docs/RELEASE_PLAN.md, docs/BUGS.md, docs/LESSONS.md, docs/TEST_CASES.md.
 *
 * EXCLUDES docs/ID_REGISTRY.md — pipe-table format has no serializer; US-0241's
 * id-allocator manipulates rows in-place rather than via parse-serialize.
 *
 * Algorithm (spec §4.3):
 *   1. Snapshot each managed file to /tmp/docs-pre-norm/<basename>.
 *   2. Pass 1: render canonical text from parsed entities.
 *   3. Pass 2: render canonical text from the result of pass 1.
 *   4. If pass1 !== pass2: throw SerializerStabilityError + write diff sidecar.
 *   5. If pass2 === input: true no-op (skip rewrite, preserve mtime).
 *   6. Else: write pass2 back via tmp+rename + emit stderr guidance.
 */

const fs = require('fs');
const path = require('path');

const { SerializerStabilityError } = require('../repository/errors');
const { replaceBlockInText } = require('../repository/markdown-mutator');

const SNAPSHOT_DIR = '/tmp/docs-pre-norm';

/**
 * Write `content` to `filePath` refusing to follow symlinks at the final path
 * component (O_NOFOLLOW). Replaces `fs.writeFileSync` for paths under
 * /tmp/docs-pre-norm/ where CodeQL's js/insecure-temporary-file rule warns
 * about predictable temp paths. We keep the predictable location (the spec
 * mandates it for human review) but defend against symlink-clobber attacks.
 *
 * If the final component is a symlink, fs.openSync throws ELOOP and the
 * migration aborts — the caller MUST treat any failure here as a security
 * stop, not a transient I/O glitch.
 */
function writeFileNoFollow(filePath, content) {
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW;
  // codeql[js/insecure-temporary-file]: well-known path is intentional (spec
  // §4.3 mandates /tmp/docs-pre-norm/ for human review of the snapshot diff
  // after migration). The O_NOFOLLOW flag above closes the symlink-clobber
  // attack vector; regression test in data_001-normalise.test.js plants a
  // hostile symlink and asserts ELOOP.
  const fd = fs.openSync(filePath, flags, 0o644);
  try {
    fs.writeSync(fd, content);
  } finally {
    fs.closeSync(fd);
  }
}

function renderReleasePlan(text) {
  const { parseReleasePlan } = require('../parse-release-plan');
  const { serialize: serializeStory } = require('../repository/serializers/story-serializer');
  const { serialize: serializeEpic } = require('../repository/serializers/epic-serializer');

  let out = text;
  const parsed = parseReleasePlan(text);

  // Serialise stories
  for (const story of parsed.stories) {
    const body = serializeStory(story);
    try {
      out = replaceBlockInText(out, new RegExp(`^${story.id}\\b`), () => body);
    } catch (e) {
      // Block may not be in a fenced section — skip silently
    }
  }

  // Serialise epics
  for (const epic of parsed.epics) {
    const body = serializeEpic(epic);
    try {
      out = replaceBlockInText(out, new RegExp(`^${epic.id}\\b`), () => body);
    } catch (e) {
      // Block may not be in a fenced section — skip silently
    }
  }

  return out;
}

function renderBugs(text) {
  const { parseBugs } = require('../parse-bugs');
  const { serialize: serializeBug } = require('../repository/serializers/bug-serializer');

  const bugs = parseBugs(text);
  if (bugs.length === 0) return text;

  const body = bugs.map(serializeBug).join('\n');
  const firstIdx = text.indexOf(bugs[0].id);
  const header = firstIdx > 0 ? text.slice(0, firstIdx) : '';
  return header + body;
}

function renderLessons(text) {
  const { parseLessons } = require('../parse-lessons');
  const { serialize: serializeLesson } = require('../repository/serializers/lesson-serializer');

  const lessons = parseLessons(text);
  if (lessons.length === 0) return text;

  const body = lessons.map(serializeLesson).join('\n');
  const firstIdx = text.indexOf(`## ${lessons[0].id}`);
  const header = firstIdx > 0 ? text.slice(0, firstIdx) : '';
  return header + body;
}

function renderTestCases(text) {
  const { parseTestCases } = require('../parse-test-cases');
  const { serialize: serializeTC } = require('../repository/serializers/test-case-serializer');

  const tcs = parseTestCases(text);
  if (tcs.length === 0) return text;

  const body = tcs.map(serializeTC).join('\n');
  const firstIdx = text.indexOf(tcs[0].id);
  const header = firstIdx > 0 ? text.slice(0, firstIdx) : '';
  return header + body;
}

const KIND_RENDER = {
  'release-plan': renderReleasePlan,
  bugs: renderBugs,
  lessons: renderLessons,
  'test-cases': renderTestCases,
};

const TARGETS = [
  { rel: 'docs/RELEASE_PLAN.md', kind: 'release-plan' },
  { rel: 'docs/BUGS.md', kind: 'bugs' },
  { rel: 'docs/LESSONS.md', kind: 'lessons' },
  { rel: 'docs/TEST_CASES.md', kind: 'test-cases' },
];

const touches = TARGETS.map((t) => t.rel);

async function up({ root }) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const results = [];

  for (const target of TARGETS) {
    const filePath = path.join(root, target.rel);
    if (!fs.existsSync(filePath)) {
      results.push({ rel: target.rel, status: 'missing' });
      continue;
    }

    const input = fs.readFileSync(filePath, 'utf8');
    const snapPath = path.join(SNAPSHOT_DIR, path.basename(filePath));
    writeFileNoFollow(snapPath, input);

    const render = KIND_RENDER[target.kind];
    const pass1 = render(input);
    const pass2 = render(pass1);

    if (pass1 !== pass2) {
      const diffPath = path.join(SNAPSHOT_DIR, `_pass1-vs-pass2-${path.basename(filePath)}.diff`);
      writeFileNoFollow(diffPath, `=== pass1 ===\n${pass1}\n=== pass2 ===\n${pass2}\n`);
      throw new SerializerStabilityError(`Migration 001: pass1 !== pass2 for ${target.rel}; see ${diffPath}`, {
        pass1,
        pass2,
        diffPath,
      });
    }

    if (pass2 === input) {
      results.push({ rel: target.rel, status: 'no-op' });
      continue;
    }

    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, pass2);
    fs.renameSync(tmp, filePath);
    results.push({ rel: target.rel, status: 'normalised', snapshot: snapPath });
    process.stderr.write(`normalised ${target.rel} (snapshot at ${snapPath})\n`);
  }

  const anyNormalised = results.some((r) => r.status === 'normalised');
  if (anyNormalised) {
    process.stderr.write(
      `\n✅ Normalised ${results.filter((r) => r.status === 'normalised').length} file(s). Review with:\n     diff -r ${SNAPSHOT_DIR}/ docs/\n   or just \`git diff\`.\n   Then \`git commit\` to keep the changes, or \`git checkout .\` to revert.\n`,
    );
  }

  return { results };
}

module.exports = { up, touches };
