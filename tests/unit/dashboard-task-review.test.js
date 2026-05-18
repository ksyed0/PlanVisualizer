'use strict';

const { deriveDisplayState } = require('../../tools/lib/dashboard-task-review');

describe('deriveDisplayState', () => {
  test('returns null when taskReview is null', () => {
    expect(deriveDisplayState(null)).toBeNull();
  });

  test('returns null when taskReview is undefined', () => {
    expect(deriveDisplayState(undefined)).toBeNull();
  });

  test('returns {skipped: true} when headSha === "none"', () => {
    expect(deriveDisplayState({ headSha: 'none' })).toEqual({ skipped: true });
  });

  test('initial spec_reviewing → specIcon=⟳, qualityIcon=null, overall=⟳', () => {
    const r = deriveDisplayState({
      status: 'spec_reviewing',
      specVerdict: null,
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('⟳');
    expect(r.qualityIcon).toBeNull();
    expect(r.escalated).toBe(false);
    expect(r.retryCount).toBeNull();
    expect(r.overall).toBe('⟳');
  });

  test('spec approved + quality_reviewing → specIcon=✓, qualityIcon=⟳, overall=⟳', () => {
    const r = deriveDisplayState({
      status: 'quality_reviewing',
      specVerdict: 'APPROVED',
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✓');
    expect(r.qualityIcon).toBe('⟳');
    expect(r.overall).toBe('⟳');
  });

  test('both approved → both ✓, overall=✓', () => {
    const r = deriveDisplayState({
      status: 'approved',
      specVerdict: 'APPROVED',
      qualityVerdict: 'APPROVED',
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✓');
    expect(r.qualityIcon).toBe('✓');
    expect(r.overall).toBe('✓');
    expect(r.escalated).toBe(false);
  });

  test('spec REQUEST_CHANGES + forge_retry → specIcon=✗, retryCount=1, overall=✗', () => {
    const r = deriveDisplayState({
      status: 'forge_retry',
      specVerdict: 'REQUEST_CHANGES',
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✗');
    expect(r.qualityIcon).toBeNull();
    expect(r.retryCount).toBe(1);
    expect(r.escalated).toBe(false);
    expect(r.overall).toBe('✗');
  });

  test('spec escalated → specIcon=✗, escalated=true', () => {
    const r = deriveDisplayState({
      status: 'escalated',
      specVerdict: 'REQUEST_CHANGES',
      qualityVerdict: null,
      forgeRetries: 2,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✗');
    expect(r.escalated).toBe(true);
    expect(r.overall).toBe('✗');
  });

  test('quality REQUEST_CHANGES + forge_retry → specIcon=✓, qualityIcon=✗, retryCount=1', () => {
    const r = deriveDisplayState({
      status: 'forge_retry',
      specVerdict: 'APPROVED',
      qualityVerdict: 'REQUEST_CHANGES',
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✓');
    expect(r.qualityIcon).toBe('✗');
    expect(r.retryCount).toBe(1);
    expect(r.overall).toBe('✗');
  });

  test('post-retry spec_reviewing (forgeRetries=1) → specIcon=⟳, retryCount=1', () => {
    const r = deriveDisplayState({
      status: 'spec_reviewing',
      specVerdict: null,
      qualityVerdict: null,
      forgeRetries: 1,
      headSha: 'def5678',
    });
    expect(r.specIcon).toBe('⟳');
    expect(r.retryCount).toBe(1);
    expect(r.overall).toBe('⟳');
  });

  test('quality escalated → specIcon=✓, qualityIcon=✗, escalated=true', () => {
    const r = deriveDisplayState({
      status: 'escalated',
      specVerdict: 'APPROVED',
      qualityVerdict: 'REQUEST_CHANGES',
      forgeRetries: 2,
      headSha: 'abc1234',
    });
    expect(r.specIcon).toBe('✓');
    expect(r.qualityIcon).toBe('✗');
    expect(r.escalated).toBe(true);
    expect(r.overall).toBe('✗');
  });

  test('retryCap reads from globalThis.pvTaskReviewCap, falls back to 2', () => {
    const r = deriveDisplayState({
      status: 'forge_retry',
      specVerdict: 'REQUEST_CHANGES',
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r.retryCap).toBe(2);

    globalThis.pvTaskReviewCap = 3;
    const r2 = deriveDisplayState({
      status: 'forge_retry',
      specVerdict: 'REQUEST_CHANGES',
      qualityVerdict: null,
      forgeRetries: 0,
      headSha: 'abc1234',
    });
    expect(r2.retryCap).toBe(3);
    delete globalThis.pvTaskReviewCap;
  });
});
