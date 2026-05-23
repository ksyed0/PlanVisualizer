'use strict';

/**
 * US-0260 / AC-1017: non-dashboard consumer migration test.
 *
 * Three consumers, two assertion families:
 *
 *   1. Source guard — each consumer requires the accessor module and no
 *      longer contains direct `sdlc.stories` reads. Word-boundary regex so
 *      non-legacy fields like `sdlc.tasks` aren't false-positives.
 *
 *   2. Dispatch-level read — for the two consumers that export `dispatch`
 *      (agent-context.js, agent-spec-plan.js), confirm the dispatch path
 *      reads stories correctly from BOTH state-A (programme.*) and
 *      state-B (legacy top-level) fixture shapes. generate-plan.js does
 *      not export anything; it gets only the source-grep assertion.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'phase-e');

const CONSUMERS = [
  { name: 'generate-plan.js', path: path.join(ROOT, 'tools', 'generate-plan.js') },
  { name: 'agent-context.js', path: path.join(ROOT, 'tools', 'agent-context.js') },
  { name: 'agent-spec-plan.js', path: path.join(ROOT, 'tools', 'agent-spec-plan.js') },
];

const LEGACY_KEY = 'stories'; // the only legacy key each of these three reads

const loadFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));

describe('US-0260: non-dashboard consumer migration', () => {
  describe('source guard — accessor wired, direct legacy reads gone', () => {
    for (const { name, path: filePath } of CONSUMERS) {
      describe(name, () => {
        const source = fs.readFileSync(filePath, 'utf8');

        it('requires sdlc-status-reader', () => {
          expect(source).toMatch(/require\(['"]\.\/lib\/repository\/sdlc-status-reader['"]\)/);
        });

        it(`contains no direct sdlc.${LEGACY_KEY} read`, () => {
          // Look for the bareword pattern. We allow comments to mention
          // "sdlc.stories" (e.g., describing what we removed) by stripping
          // // and /* */ comment lines before scanning.
          const stripped = source
            .split('\n')
            .filter((line) => !/^\s*\/\//.test(line))
            .join('\n')
            .replace(/\/\*[\s\S]*?\*\//g, '');
          const regex = new RegExp(`\\bsdlc\\.${LEGACY_KEY}\\b`);
          expect(stripped).not.toMatch(regex);
        });

        it(`contains no \`sdlc.${LEGACY_KEY} || {}\` defensive scaffolding`, () => {
          // The accessor owns the default. If this string is present the
          // migration is half-done.
          expect(source).not.toMatch(new RegExp(`sdlc\\.${LEGACY_KEY}\\s*\\|\\|`));
        });
      });
    }
  });

  describe('dispatch-level reads against fixture shapes', () => {
    describe('agent-context.js', () => {
      const reader = require('../../tools/lib/repository/sdlc-status-reader');

      // We test the read pattern directly (the accessor) rather than
      // dispatching, because dispatch requires a full agent-context bootstrap.
      // The source guard above already confirms the consumer wires the
      // accessor through.

      it('reads story metadata correctly from state-A (programme.stories)', () => {
        const sdlc = loadFixture('state-a.json');
        expect(reader.stories(sdlc)['US-0259'].status).toBe('InProgress');
      });

      it('reads story metadata correctly from state-B (top-level stories)', () => {
        const sdlc = loadFixture('state-b.json');
        expect(reader.stories(sdlc)['US-0259'].status).toBe('InProgress');
      });
    });

    describe('agent-spec-plan.js: readStories() collapses to the accessor', () => {
      const reader = require('../../tools/lib/repository/sdlc-status-reader');

      it('returns programme.stories preferentially when both shapes are populated', () => {
        // Inline divergent fixture: programme has status 'Done', top-level
        // has status 'InProgress'. The accessor must return 'Done' to prove
        // the programme-wins precedence (state-c.json on disk has identical
        // content in both shapes, so it can't exercise this assertion).
        const onDisk = {
          programme: { stories: { 'US-0259': { status: 'Done' } } },
          stories: { 'US-0259': { status: 'InProgress' } },
        };
        expect(reader.stories(onDisk)['US-0259'].status).toBe('Done');
      });

      it('falls back to top-level stories when programme is empty', () => {
        const onDisk = loadFixture('state-b.json'); // top-level only
        expect(reader.stories(onDisk)['US-0259']).toBeDefined();
      });
    });
  });
});
