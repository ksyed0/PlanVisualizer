'use strict';

function deriveDisplayState(taskReview) {
  if (!taskReview) return null;
  if (taskReview.headSha === 'none') return { skipped: true };

  var status = taskReview.status;
  var specV = taskReview.specVerdict;
  var qualV = taskReview.qualityVerdict;
  var retries = taskReview.forgeRetries || 0;

  var specIcon = null;
  if (specV === 'APPROVED') specIcon = '✓';
  else if (specV === 'REQUEST_CHANGES') specIcon = '✗';
  else if (status === 'spec_reviewing') specIcon = '⟳';

  var qualityIcon = null;
  if (qualV === 'APPROVED') qualityIcon = '✓';
  else if (qualV === 'REQUEST_CHANGES') qualityIcon = '✗';
  else if (status === 'quality_reviewing') qualityIcon = '⟳';

  var retryCount = null;
  if (status === 'forge_retry') {
    retryCount = retries + 1;
  } else if (retries > 0 && (status === 'spec_reviewing' || status === 'quality_reviewing')) {
    retryCount = retries;
  }

  var escalated = status === 'escalated';

  var overall = null;
  if (specIcon === '✓' && qualityIcon === '✓') overall = '✓';
  else if (specIcon === '✗' || qualityIcon === '✗') overall = '✗';
  else if (specIcon === '⟳' || qualityIcon === '⟳') overall = '⟳';

  var cap =
    typeof globalThis !== 'undefined' && typeof globalThis.pvTaskReviewCap === 'number'
      ? globalThis.pvTaskReviewCap
      : 2;

  return {
    skipped: false,
    specIcon: specIcon,
    qualityIcon: qualityIcon,
    retryCount: retryCount,
    retryCap: cap,
    escalated: escalated,
    overall: overall,
  };
}

function renderReviewIconS(ds) {
  if (!ds || ds.skipped || !ds.overall) return '';
  var cls;
  var title;
  if (ds.overall === '✓') {
    cls = 'ok';
    title = 'Review cleared';
  } else if (ds.overall === '⟳') {
    cls = 'review';
    title = 'Review in progress';
  } else {
    cls = 'risk';
    title = 'Review needs changes or escalated';
  }
  return '<span class="pv-rev-icon ' + cls + '" title="' + title + '">' + ds.overall + '</span>';
}

function _chip(cls, label, title) {
  return '<span class="pv-rev-chip ' + cls + '" title="' + title + '">' + label + '</span>';
}

function renderReviewChipsM(ds) {
  if (!ds || ds.skipped) return '';
  var chips = [];

  if (ds.specIcon === '✓') chips.push(_chip('ok', 'SPEC ✓', 'Spec compliance review: approved'));
  else if (ds.specIcon === '⟳') chips.push(_chip('review', 'SPEC ⟳', 'Spec compliance review in progress'));
  else if (ds.specIcon === '✗') chips.push(_chip('risk', 'SPEC ✗', 'Spec compliance review: changes requested'));

  if (ds.qualityIcon === '✓') chips.push(_chip('ok', 'QUAL ✓', 'Code quality review: approved'));
  else if (ds.qualityIcon === '⟳') chips.push(_chip('review', 'QUAL ⟳', 'Code quality review in progress'));
  else if (ds.qualityIcon === '✗') chips.push(_chip('risk', 'QUAL ✗', 'Code quality review: changes requested'));

  if (ds.escalated) {
    chips.push(_chip('risk', 'ESCALATED', 'Review cap exhausted — manual review required'));
  } else if (ds.retryCount) {
    chips.push(_chip('warn', 'RETRY ' + ds.retryCount + '/' + ds.retryCap, 'Forge retry in progress'));
  }

  return chips.join(' ');
}

module.exports = { deriveDisplayState, renderReviewIconS, renderReviewChipsM };
