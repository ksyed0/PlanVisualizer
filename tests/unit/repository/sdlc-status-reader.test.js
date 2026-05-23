'use strict';

const fs = require('fs');
const path = require('path');

const reader = require('../../../tools/lib/repository/sdlc-status-reader');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'fixtures', 'phase-e');
const load = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));

const ACCESSOR_KEYS = [
  'programme',
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

describe('sdlc-status-reader', () => {
  describe('module shape', () => {
    it('exports exactly the 10 documented accessors', () => {
      expect(Object.keys(reader).sort()).toEqual([...ACCESSOR_KEYS].sort());
    });

    it('every export is a function', () => {
      for (const key of ACCESSOR_KEYS) {
        expect(typeof reader[key]).toBe('function');
      }
    });
  });

  describe('AC-1015: state-A (programme.*) and state-B (top-level) return equal values', () => {
    const stateA = load('state-a.json');
    const stateB = load('state-b.json');

    // programme() returns the container, not a dual-read value, so it is
    // legitimately different across the two shapes (populated vs {}).
    const DUAL_READ_KEYS = ACCESSOR_KEYS.filter((k) => k !== 'programme');

    for (const key of DUAL_READ_KEYS) {
      it(`reader.${key}(stateA) deep-equals reader.${key}(stateB)`, () => {
        expect(reader[key](stateA)).toEqual(reader[key](stateB));
      });
    }
  });

  describe('state-C (preservation-doubled) reads programme.* first', () => {
    const stateC = load('state-c.json');
    const stateCConflict = load('state-c-conflict.json');

    it('agents() returns programme.agents when both shapes are populated', () => {
      // state-c-conflict has top-level agents = {stale-agent} but programme.agents
      // is the canonical four-agent set. Accessor must prefer programme.
      const result = reader.agents(stateCConflict);
      expect(Object.keys(result).sort()).toEqual(['code-implementer', 'coverage-reporter', 'reviewer', 'test-runner']);
      expect(result).not.toHaveProperty('stale-agent');
    });

    it('state-c agents() and state-a agents() are equal (no divergence)', () => {
      const stateA = load('state-a.json');
      expect(reader.agents(stateC)).toEqual(reader.agents(stateA));
    });
  });

  describe('null/undefined/malformed input is safe', () => {
    const cases = [
      ['null', null],
      ['undefined', undefined],
      ['empty object', {}],
      ['malformed-programme (programme: null)', load('malformed-programme.json')],
      ['empty programme', load('empty-programme.json')],
    ];

    for (const [label, input] of cases) {
      it(`programme(${label}) returns {}`, () => {
        expect(reader.programme(input)).toEqual({});
      });
      it(`agents(${label}) returns {}`, () => {
        expect(reader.agents(input)).toEqual({});
      });
      it(`metrics(${label}) returns {}`, () => {
        expect(reader.metrics(input)).toEqual({});
      });
      it(`stories(${label}) returns {}`, () => {
        expect(reader.stories(input)).toEqual({});
      });
      it(`epics(${label}) returns {}`, () => {
        expect(reader.epics(input)).toEqual({});
      });
      it(`phases(${label}) returns []`, () => {
        expect(reader.phases(input)).toEqual([]);
      });
      it(`cycles(${label}) returns []`, () => {
        expect(reader.cycles(input)).toEqual([]);
      });
      it(`currentPhase(${label}) returns null`, () => {
        expect(reader.currentPhase(input)).toBeNull();
      });
      it(`githubStatus(${label}) returns null`, () => {
        expect(reader.githubStatus(input)).toBeNull();
      });
      it(`project(${label}) returns {}`, () => {
        expect(reader.project(input)).toEqual({});
      });
    }
  });

  describe('cycles() defensively handles non-array values', () => {
    it('returns [] when programme.cycles is null and top-level cycles is a string', () => {
      const fixture = load('wrong-type-cycles.json');
      expect(reader.cycles(fixture)).toEqual([]);
    });

    it('returns [] for an object value', () => {
      expect(reader.cycles({ cycles: { not: 'an array' } })).toEqual([]);
    });

    it('returns the array when top-level cycles is a valid array and programme is empty', () => {
      const fixture = {
        programme: {},
        cycles: [{ id: 'cycle-1', outcome: 'green' }],
      };
      expect(reader.cycles(fixture)).toEqual([{ id: 'cycle-1', outcome: 'green' }]);
    });
  });

  describe('currentPhase() regression: bare || chain would swallow 0', () => {
    it('returns 0 (not null) when programme.currentPhase === 0', () => {
      const fixture = load('current-phase-zero.json');
      expect(reader.currentPhase(fixture)).toBe(0);
    });

    it('returns 0 when top-level currentPhase === 0 and programme is empty', () => {
      expect(reader.currentPhase({ programme: {}, currentPhase: 0 })).toBe(0);
    });

    it('returns null when neither shape has a numeric currentPhase', () => {
      expect(reader.currentPhase({ programme: { currentPhase: 'oops' } })).toBeNull();
    });

    it('prefers programme.currentPhase over top-level', () => {
      expect(reader.currentPhase({ programme: { currentPhase: 3 }, currentPhase: 9 })).toBe(3);
    });
  });

  describe('githubStatus() is the absent-value signal accessor (returns null, not {})', () => {
    it('returns null when programme.githubStatus === null', () => {
      const fixture = load('github-status-null.json');
      expect(reader.githubStatus(fixture)).toBeNull();
    });

    it('returns null when both shapes are missing', () => {
      expect(reader.githubStatus({ programme: {} })).toBeNull();
    });

    it('returns the object when programme.githubStatus is populated', () => {
      const gs = { prs: [{ number: 1 }], ciSummary: {} };
      expect(reader.githubStatus({ programme: { githubStatus: gs } })).toEqual(gs);
    });

    it('returns null for a non-object githubStatus (corrupted fixture)', () => {
      expect(reader.githubStatus({ programme: { githubStatus: 'broken' } })).toBeNull();
    });
  });

  describe('content correctness against state-A fixture', () => {
    const stateA = load('state-a.json');

    it('programme() returns the full programme object', () => {
      const result = reader.programme(stateA);
      expect(result).toBe(stateA.programme);
    });

    it('agents() returns four agents keyed by name', () => {
      expect(Object.keys(reader.agents(stateA)).sort()).toEqual([
        'code-implementer',
        'coverage-reporter',
        'reviewer',
        'test-runner',
      ]);
    });

    it('metrics().coveragePercent matches fixture', () => {
      expect(reader.metrics(stateA).coveragePercent).toBe(87);
    });

    it('stories() includes US-0259 with InProgress status', () => {
      expect(reader.stories(stateA)['US-0259'].status).toBe('InProgress');
    });

    it('epics() includes EPIC-0045', () => {
      expect(reader.epics(stateA)['EPIC-0045'].name).toBe('Consumer Migration & Cleanup');
    });

    it('phases() returns an array of length 2', () => {
      const phases = reader.phases(stateA);
      expect(Array.isArray(phases)).toBe(true);
      expect(phases).toHaveLength(2);
    });

    it('cycles() returns an array of length 1', () => {
      expect(reader.cycles(stateA)).toHaveLength(1);
    });

    it('currentPhase() returns 2', () => {
      expect(reader.currentPhase(stateA)).toBe(2);
    });

    it('githubStatus() returns the GitHub status object', () => {
      expect(reader.githubStatus(stateA).prs[0].number).toBe(1100);
    });

    it('project() returns the project metadata', () => {
      expect(reader.project(stateA).name).toBe('PlanVisualizer');
    });
  });

  describe('purity: accessors do not mutate input', () => {
    it('multiple calls return the same reference for object-valued accessors', () => {
      const stateA = load('state-a.json');
      const snapshot = JSON.stringify(stateA);
      reader.agents(stateA);
      reader.phases(stateA);
      reader.cycles(stateA);
      reader.currentPhase(stateA);
      reader.githubStatus(stateA);
      expect(JSON.stringify(stateA)).toBe(snapshot);
    });
  });
});
