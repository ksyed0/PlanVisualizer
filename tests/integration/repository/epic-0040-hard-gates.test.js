'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..');

// ---- Hard gate 1: round-trip byte-identity ----

const KIND_PARSE = {
  'release-plan': () => require('../../../tools/lib/parse-release-plan'),
  bugs: () => require('../../../tools/lib/parse-bugs'),
  lessons: () => require('../../../tools/lib/parse-lessons'),
  'test-cases': () => require('../../../tools/lib/parse-test-cases'),
};

const KIND_SER = {
  story: () => require('../../../tools/lib/repository/serializers/story-serializer'),
  epic: () => require('../../../tools/lib/repository/serializers/epic-serializer'),
  bug: () => require('../../../tools/lib/repository/serializers/bug-serializer'),
  lesson: () => require('../../../tools/lib/repository/serializers/lesson-serializer'),
  testCase: () => require('../../../tools/lib/repository/serializers/test-case-serializer'),
};

const TARGETS = [
  { rel: 'docs/RELEASE_PLAN.md', kind: 'release-plan', entityKinds: ['story', 'epic'] },
  { rel: 'docs/BUGS.md', kind: 'bugs', entityKinds: ['bug'] },
  { rel: 'docs/LESSONS.md', kind: 'lessons', entityKinds: ['lesson'] },
  { rel: 'docs/TEST_CASES.md', kind: 'test-cases', entityKinds: ['testCase'] },
];

function entitiesFor(text, kind, entityKind) {
  const parsers = KIND_PARSE[kind]();
  if (kind === 'release-plan') {
    const r = parsers.parseReleasePlan(text);
    return entityKind === 'story' ? r.stories : r.epics;
  }
  if (kind === 'bugs') return parsers.parseBugs(text);
  if (kind === 'lessons') return parsers.parseLessons(text);
  if (kind === 'test-cases') return parsers.parseTestCases(text);
  return [];
}

function reparseOne(serializedBody, kind, entityKind) {
  const wrapped = kind === 'release-plan' ? `# T\n\n\`\`\`\n${serializedBody}\`\`\`\n` : serializedBody;
  return entitiesFor(wrapped, kind, entityKind);
}

describe('US-0247 / AC-0962 + AC-0963 hard gate 1: round-trip byte-identity', () => {
  describe.each(TARGETS)('$rel', (target) => {
    const filePath = path.join(ROOT, target.rel);
    const exists = fs.existsSync(filePath);

    if (!exists) {
      it.skip('file missing — skipped', () => {});
      return;
    }

    const text = fs.readFileSync(filePath, 'utf8');

    for (const ek of target.entityKinds) {
      const entities = entitiesFor(text, target.kind, ek);
      const ser = KIND_SER[ek]();

      describe(`${ek} (${entities.length} entities)`, () => {
        if (entities.length === 0) {
          it.skip('no entities of this kind', () => {});
          return;
        }
        it.each(entities.map((e) => [e.id, e]))('%s round-trips deep-equal + serialize is idempotent', (id, ent) => {
          const out = ser.serialize(ent);
          const round = reparseOne(out, target.kind, ek);
          expect(round).toHaveLength(1);
          expect(round[0]).toEqual(ent);
          // Stronger: serialize twice must produce identical text.
          const out2 = ser.serialize(round[0]);
          expect(out2).toBe(out);
        });
      });
    }
  });
});

// ---- Hard gate 2: no managed-path writes in 3 migrated consumers ----

const MANAGED = new Set([
  'RELEASE_PLAN.md',
  'BUGS.md',
  'LESSONS.md',
  'TEST_CASES.md',
  'ID_REGISTRY.md',
  'sdlc-status.json',
]);
const CONSUMERS = ['tools/agent-context.js', 'tools/generate-plan.js', 'tools/sync-github.js'];

describe('US-0247 / AC-0963 hard gate 2: no managed-path writes in migrated consumers', () => {
  it.each(CONSUMERS)('%s has no fs.write/append targeting a managed file', (rel) => {
    const filePath = path.join(ROOT, rel);
    const source = fs.readFileSync(filePath, 'utf8');
    const re = /fs\.(writeFileSync|appendFileSync)\s*\(/g;
    const hits = [];
    let m;
    while ((m = re.exec(source)) !== null) {
      const lineNum = source.slice(0, m.index).split('\n').length;
      const ctx = source.slice(Math.max(0, m.index - 200), Math.min(source.length, m.index + 200));
      for (const fname of MANAGED) {
        if (ctx.includes(fname)) hits.push({ rel, line: lineNum, filename: fname });
      }
    }
    if (hits.length > 0) {
      throw new Error(`${rel} writes to managed paths:\n` + hits.map((h) => `  L${h.line} → ${h.filename}`).join('\n'));
    }
  });
});

// ---- Hard gate 3: plan:lint reports 0/0/0 ----

describe('US-0247 / AC-0963 hard gate 3: plan:lint reports 0/0/0', () => {
  it('npm run plan:lint exits 0 with zero errors', () => {
    let out;
    try {
      out = execSync('npm run plan:lint --silent', { cwd: ROOT, stdio: 'pipe' }).toString();
    } catch (e) {
      throw new Error(`plan:lint failed:\n${e.stdout?.toString() || ''}\n${e.stderr?.toString() || ''}`, { cause: e });
    }
    // Accept "0 errors" or "0/0/0" or "errors: 0" formatting.
    expect(out).toMatch(/(?:0\s*errors|errors:\s*0|0\s*\/\s*0\s*\/\s*0)/);
  });
});

// ---- Hard gate 4: per-consumer integration tests exist ----

describe('US-0247 / AC-0963 hard gate 4: per-consumer integration tests exist', () => {
  const REQUIRED_TESTS = [
    'tests/integration/agent-context-flow.test.js',
    'tests/integration/dashboard-uses-accessor.test.js',
    'tests/integration/sync-github-flow.test.js',
    'tests/integration/agent-context-grep-no-direct-writes.test.js',
    'tests/integration/generate-plan-grep-managed-writes.test.js',
    'tests/integration/sync-github-grep-no-managed-writes.test.js',
  ];
  it.each(REQUIRED_TESTS)('%s exists', (rel) => {
    expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
  });
});
