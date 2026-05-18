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

describe('renderReviewIconS', () => {
  const { renderReviewIconS } = require('../../tools/lib/dashboard-task-review');

  test('returns empty string when ds is null', () => {
    expect(renderReviewIconS(null)).toBe('');
  });

  test('returns empty string when ds.skipped', () => {
    expect(renderReviewIconS({ skipped: true })).toBe('');
  });

  test('returns empty string when overall is null', () => {
    expect(renderReviewIconS({ skipped: false, overall: null })).toBe('');
  });

  test('cleared (overall=✓) renders ok-class span with title', () => {
    const html = renderReviewIconS({ skipped: false, overall: '✓' });
    expect(html).toContain('class="pv-rev-icon ok"');
    expect(html).toContain('>✓<');
    expect(html).toContain('title=');
  });

  test('reviewing (overall=⟳) renders review-class span', () => {
    const html = renderReviewIconS({ skipped: false, overall: '⟳' });
    expect(html).toContain('class="pv-rev-icon review"');
    expect(html).toContain('>⟳<');
  });

  test('failed/escalated (overall=✗) renders risk-class span', () => {
    const html = renderReviewIconS({ skipped: false, overall: '✗' });
    expect(html).toContain('class="pv-rev-icon risk"');
    expect(html).toContain('>✗<');
  });
});

describe('renderReviewChipsM', () => {
  const { renderReviewChipsM } = require('../../tools/lib/dashboard-task-review');

  test('returns empty string when ds is null', () => {
    expect(renderReviewChipsM(null)).toBe('');
  });

  test('returns empty string when ds.skipped', () => {
    expect(renderReviewChipsM({ skipped: true })).toBe('');
  });

  test('both APPROVED → two ok chips', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '✓',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '✓',
    });
    expect(html).toContain('pv-rev-chip ok');
    expect(html.match(/pv-rev-chip ok/g).length).toBe(2);
    expect(html).toContain('SPEC ✓');
    expect(html).toContain('QUAL ✓');
  });

  test('spec approved + quality reviewing → ok + review chips', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '⟳',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html).toContain('pv-rev-chip ok');
    expect(html).toContain('pv-rev-chip review');
    expect(html).toContain('SPEC ✓');
    expect(html).toContain('QUAL ⟳');
  });

  test('spec failed + retry → risk + warn retry chip', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✗',
      qualityIcon: null,
      retryCount: 1,
      retryCap: 2,
      escalated: false,
      overall: '✗',
    });
    expect(html).toContain('pv-rev-chip risk');
    expect(html).toContain('SPEC ✗');
    expect(html).toContain('pv-rev-chip warn');
    expect(html).toContain('RETRY 1/2');
  });

  test('spec escalated → risk + ESCALATED chip', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✗',
      qualityIcon: null,
      retryCount: null,
      retryCap: 2,
      escalated: true,
      overall: '✗',
    });
    expect(html).toContain('SPEC ✗');
    expect(html).toContain('ESCALATED');
    expect(html).not.toContain('RETRY');
  });

  test('quality failed + retry → ok + risk + warn retry chip', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '✗',
      retryCount: 1,
      retryCap: 2,
      escalated: false,
      overall: '✗',
    });
    expect(html).toContain('SPEC ✓');
    expect(html).toContain('QUAL ✗');
    expect(html).toContain('RETRY 1/2');
  });

  test('every chip has a title attribute', () => {
    const html = renderReviewChipsM({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '⟳',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html.match(/title="[^"]+"/g).length).toBe(2);
  });
});

describe('renderReviewLineL', () => {
  const { renderReviewLineL } = require('../../tools/lib/dashboard-task-review');

  test('returns empty string when ds is null', () => {
    expect(renderReviewLineL(null)).toBe('');
  });

  test('returns empty string when ds.skipped', () => {
    expect(renderReviewLineL({ skipped: true })).toBe('');
  });

  test('both APPROVED → "Spec ✓ · Quality ✓"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '✓',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '✓',
    });
    expect(html).toContain('pv-rev-line');
    expect(html).toContain('Spec ✓');
    expect(html).toContain('Quality ✓');
  });

  test('spec approved + quality reviewing → "Spec ✓ · Quality ⟳"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '⟳',
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html).toContain('Spec ✓');
    expect(html).toContain('Quality ⟳');
  });

  test('spec failed + retry → "Spec ✗ · retry 1/2"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✗',
      qualityIcon: null,
      retryCount: 1,
      retryCap: 2,
      escalated: false,
      overall: '✗',
    });
    expect(html).toContain('Spec ✗');
    expect(html).toContain('retry 1/2');
    expect(html).not.toContain('escalated');
  });

  test('spec escalated → "Spec ✗ · escalated"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✗',
      qualityIcon: null,
      retryCount: null,
      retryCap: 2,
      escalated: true,
      overall: '✗',
    });
    expect(html).toContain('Spec ✗');
    expect(html).toContain('escalated');
    expect(html).not.toContain('retry');
  });

  test('quality escalated → "Spec ✓ · Quality ✗ · escalated"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '✓',
      qualityIcon: '✗',
      retryCount: null,
      retryCap: 2,
      escalated: true,
      overall: '✗',
    });
    expect(html).toContain('Spec ✓');
    expect(html).toContain('Quality ✗');
    expect(html).toContain('escalated');
  });

  test('initial spec_reviewing (no retries) → "Spec ⟳" (no retry text)', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '⟳',
      qualityIcon: null,
      retryCount: null,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html).toContain('Spec ⟳');
    expect(html).not.toContain('retry');
  });

  test('post-retry spec_reviewing (forgeRetries=1) → "Spec ⟳ · retry 1/2"', () => {
    const html = renderReviewLineL({
      skipped: false,
      specIcon: '⟳',
      qualityIcon: null,
      retryCount: 1,
      retryCap: 2,
      escalated: false,
      overall: '⟳',
    });
    expect(html).toContain('Spec ⟳');
    expect(html).toContain('retry 1/2');
  });
});
