'use strict';

// Accessors over docs/sdlc-status.json. Each function reads
// programme.{key} and returns a safe default of the correct type if the
// key is absent. Total: never throws on missing/malformed input. The
// transitional `|| json.{key}` dual-read fallback was removed in US-0261
// once Migration 006 (US-0262) was confirmed to populate programme.* on
// every checkout that runs pv:upgrade. Pre-pv:upgrade clones now read
// the safe default; pv:doctor flags this state with a remediation hint.

function programme(json) {
  return (json && json.programme) || {};
}

function agents(json) {
  return programme(json).agents || {};
}

function metrics(json) {
  return programme(json).metrics || {};
}

function stories(json) {
  return programme(json).stories || {};
}

function epics(json) {
  return programme(json).epics || {};
}

function phases(json) {
  return programme(json).phases || [];
}

function cycles(json) {
  // Type-narrow check preserved: programme.cycles may be set to a
  // non-array value in old fixtures, and the consumer contract is that
  // cycles() always returns an array.
  const fromProgramme = programme(json).cycles;
  if (Array.isArray(fromProgramme)) return fromProgramme;
  return [];
}

function currentPhase(json) {
  // Explicit `typeof === 'number'` check because `currentPhase: 0` is a
  // valid not-started value; a bare `||` chain would incorrectly fall
  // through and return null.
  const fromProgramme = programme(json).currentPhase;
  if (typeof fromProgramme === 'number') return fromProgramme;
  return null;
}

function githubStatus(json) {
  // The only accessor (besides currentPhase) that returns null: the
  // dashboard's `if (!gs) return;` guard treats absence as a signal,
  // not an empty object.
  const fromProgramme = programme(json).githubStatus;
  if (fromProgramme && typeof fromProgramme === 'object') return fromProgramme;
  return null;
}

function project(json) {
  return programme(json).project || {};
}

module.exports = {
  programme,
  agents,
  metrics,
  stories,
  epics,
  phases,
  cycles,
  currentPhase,
  githubStatus,
  project,
};
