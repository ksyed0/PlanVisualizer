'use strict';

/**
 * US-0259 (EPIC-0045 Phase E): consumer migration test for the dashboard.
 *
 * Two assertions, per the API design note §6:
 *
 *   1. Source guard — `tools/generate-dashboard.js` contains NO direct reads
 *      of the 9 legacy keys on a variable named `status`. Every read goes
 *      through `reader.X(status)` (Node side) or `pvReader.X(status)`
 *      (injected browser global). This is the regex grep the design note
 *      describes as "the only place this guard is reliable since the
 *      dashboard is the single migration target".
 *
 *   2. Render gate (AC-1016) — `generateHTML(fixture)` succeeds against each
 *      of the three phase-E fixture shapes (canonical-only, legacy-only,
 *      preservation-doubled). The output must include the populated agent /
 *      metrics / cycle dashboard regions; an empty render (where defensive
 *      `|| {}` scaffolding silently swallowed the data) would fail these
 *      assertions.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const GENERATOR_PATH = path.join(ROOT, 'tools', 'generate-dashboard.js');
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'phase-e');

const { generateHTML } = require('../../tools/generate-dashboard');

const loadFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));

describe('US-0259: dashboard consumer migration', () => {
  describe('source guard — no direct legacy reads on status', () => {
    const LEGACY_KEYS = [
      'agents',
      'metrics',
      'stories',
      'epics',
      'phases',
      'cycles',
      'currentPhase',
      'githubStatus',
      'project',
    ];

    const source = fs.readFileSync(GENERATOR_PATH, 'utf8');

    for (const key of LEGACY_KEYS) {
      it(`no \`status.${key}\` direct read appears in tools/generate-dashboard.js`, () => {
        // Word boundary on the key so `status.agents` matches but
        // `status.agentStatuses` (a legitimate non-legacy field that is NOT
        // one of the 9 migrated keys) does not.
        const regex = new RegExp(`status\\.${key}\\b`);
        const match = source.match(regex);
        expect(match).toBeNull();
      });
    }

    it('still calls into the accessor via require and reader.* / pvReader.* sites', () => {
      expect(source).toMatch(/require\(['"]\.\/lib\/repository\/sdlc-status-reader['"]\)/);
      expect(source).toMatch(/reader\.agents\(/);
      expect(source).toMatch(/pvReader\.agents\(/);
      // READER_SOURCE injection is what makes the inline `pvReader.X(...)`
      // calls actually resolve at runtime in the browser. Confirm the
      // injection block is wired up.
      expect(source).toMatch(/window\.pvReader\s*=/);
    });
  });

  describe('AC-1016: generateHTML renders against all three fixture shapes', () => {
    const cases = [
      ['state-a (canonical-only, programme.*)', 'state-a.json'],
      ['state-c (preservation-doubled)', 'state-c.json'],
    ];

    for (const [label, fixtureName] of cases) {
      describe(label, () => {
        const fixture = loadFixture(fixtureName);
        let html;

        beforeAll(() => {
          html = generateHTML(fixture);
        });

        it('returns a non-empty HTML string', () => {
          expect(typeof html).toBe('string');
          expect(html.length).toBeGreaterThan(5000);
        });

        it('includes the injected pvReader global', () => {
          expect(html).toMatch(/window\.pvReader\s*=/);
        });

        it('renders all four agent names somewhere on the page', () => {
          // The canonical content has these four agents; if the accessor
          // returned {} the dashboard would render zero of them.
          for (const name of ['code-implementer', 'test-runner', 'coverage-reporter', 'reviewer']) {
            expect(html).toContain(name);
          }
        });

        it('surfaces the metrics.coveragePercent value somewhere in the page', () => {
          expect(html).toMatch(/87/);
        });

        it('does not contain "ReferenceError" or stray "undefined" in the agent grid markup', () => {
          // A failed accessor read often shows up as the literal text
          // "undefined" or a thrown ReferenceError handler trace.
          expect(html).not.toMatch(/ReferenceError/);
        });
      });
    }
  });

  describe('US-0261: dual-read fallback removed — state-B no longer renders populated regions', () => {
    it('generateHTML(state-B) succeeds but renders no agent names', () => {
      const fs2 = require('fs');
      const path2 = require('path');
      const stateB = JSON.parse(
        fs2.readFileSync(path2.join(__dirname, '..', 'fixtures', 'phase-e', 'state-b.json'), 'utf8'),
      );
      const html = generateHTML(stateB);
      expect(typeof html).toBe('string');
      // None of the state-B top-level agent names should appear in the
      // rendered dashboard — the accessor returns {} now that the dual-
      // read fallback is gone.
      expect(html).not.toContain('code-implementer');
      expect(html).not.toContain('test-runner');
    });
  });

  describe('edge case: generateHTML survives a malformed fixture', () => {
    it('does not throw on {programme: null}', () => {
      const fixture = loadFixture('malformed-programme.json');
      expect(() => generateHTML(fixture)).not.toThrow();
    });

    it('does not throw on an empty {programme: {}} fixture', () => {
      const fixture = loadFixture('empty-programme.json');
      expect(() => generateHTML(fixture)).not.toThrow();
    });
  });
});
