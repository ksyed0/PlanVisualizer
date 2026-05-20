// tests/unit/repository/validation.test.js
const { classify, TIER } = require('../../../tools/lib/repository/validation');

describe('validation tier classification', () => {
  test('duplicate ID is error tier', () => {
    expect(classify({ code: 'duplicate-id', entityId: 'AC-0001' })).toBe(TIER.ERROR);
  });
  test('invalid status enum is error tier', () => {
    expect(classify({ code: 'invalid-status', value: 'Foo' })).toBe(TIER.ERROR);
  });
  test('orphan AC is warning tier', () => {
    expect(classify({ code: 'orphan-ac', entityId: 'AC-0099' })).toBe(TIER.WARNING);
  });
  test('id-registry drift is warning tier', () => {
    expect(classify({ code: 'id-registry-drift', sequence: 'AC' })).toBe(TIER.WARNING);
  });
  test('sequential AC gap is report tier', () => {
    expect(classify({ code: 'ac-gap', range: ['AC-0010', 'AC-0012'] })).toBe(TIER.REPORT);
  });
});
