'use strict';

const { serialize } = require('../../../../tools/lib/repository/serializers/ac-serializer');
const { ValidationError } = require('../../../../tools/lib/repository/errors');

describe('ac-serializer', () => {
  it('emits unchecked AC', () => {
    expect(serialize({ id: 'AC-0938', text: 'hello', checked: false })).toBe('- [ ] AC-0938: hello');
  });

  it('emits checked AC', () => {
    expect(serialize({ id: 'AC-0938', text: 'hello', checked: true })).toBe('- [x] AC-0938: hello');
  });

  it('accepts AC-TBD id', () => {
    expect(serialize({ id: 'AC-TBD', text: 'pending', checked: false })).toBe('- [ ] AC-TBD: pending');
  });

  it('throws ValidationError when id is not AC-\\d+ or AC-TBD', () => {
    expect(() => serialize({ id: 'BAD-1', text: 'x', checked: false })).toThrow(ValidationError);
  });

  it('throws ValidationError when text is empty', () => {
    expect(() => serialize({ id: 'AC-0938', text: '', checked: false })).toThrow(ValidationError);
  });
});
