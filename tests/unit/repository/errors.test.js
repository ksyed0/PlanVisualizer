'use strict';

const { ValidationError, SerializerStabilityError } = require('../../../tools/lib/repository/errors');

describe('ValidationError', () => {
  it('extends Error, carries code + details, is throwable', () => {
    const e = new ValidationError('bad status', {
      code: 'INVALID_STATUS',
      details: { got: 'Maybe', expected: ['To Do', 'In Progress', 'Done'] },
    });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ValidationError);
    expect(e.code).toBe('INVALID_STATUS');
    expect(e.details).toEqual({ got: 'Maybe', expected: ['To Do', 'In Progress', 'Done'] });
    expect(e.message).toBe('bad status');
  });

  it('defaults code to "VALIDATION" and details to {} when omitted', () => {
    const e = new ValidationError('plain');
    expect(e.code).toBe('VALIDATION');
    expect(e.details).toEqual({});
  });

  it('serialises to JSON with name + message + code + details', () => {
    const e = new ValidationError('bad', { code: 'X', details: { y: 1 } });
    expect(JSON.parse(JSON.stringify(e))).toEqual({
      name: 'ValidationError',
      message: 'bad',
      code: 'X',
      details: { y: 1 },
    });
  });
});

describe('SerializerStabilityError', () => {
  it('extends Error, exposes pass1 / pass2 / diffPath for the migration harness', () => {
    const e = new SerializerStabilityError('pass1 !== pass2', {
      pass1: 'a',
      pass2: 'b',
      diffPath: '/tmp/docs-pre-norm/_pass1-vs-pass2-X.diff',
    });
    expect(e).toBeInstanceOf(SerializerStabilityError);
    expect(e.pass1).toBe('a');
    expect(e.pass2).toBe('b');
    expect(e.diffPath).toBe('/tmp/docs-pre-norm/_pass1-vs-pass2-X.diff');
  });
});
