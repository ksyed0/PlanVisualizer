'use strict';

// Dual-read accessors over docs/sdlc-status.json. Each function reads
// programme.{key} first, falls back to the legacy top-level {key}, then to a
// safe default of the correct type. Total: never throws on missing/malformed
// input. See docs/superpowers/specs/2026-05-22-us-0259-accessor-api-design.md
// for the contract; the `|| json.{key}` fallback is transitional and is
// removed in US-0261 after Migration 006 has run.

function programme(json) {
  return (json && json.programme) || {};
}

function agents(json) {
  return programme(json).agents || (json && json.agents) || {};
}

function metrics(json) {
  return programme(json).metrics || (json && json.metrics) || {};
}

function stories(json) {
  return programme(json).stories || (json && json.stories) || {};
}

function epics(json) {
  return programme(json).epics || (json && json.epics) || {};
}

function phases(json) {
  return programme(json).phases || (json && json.phases) || [];
}

function cycles(json) {
  // The bare `||` chain is unsafe here: a non-array value (null, "", {}) at
  // programme.cycles must NOT shadow a valid top-level array. Type-check each
  // source. Matches the defensive Array.isArray() guard in dashboard.html.
  const fromProgramme = programme(json).cycles;
  if (Array.isArray(fromProgramme)) return fromProgramme;
  const fromTopLevel = json && json.cycles;
  if (Array.isArray(fromTopLevel)) return fromTopLevel;
  return [];
}

function currentPhase(json) {
  // Explicit `typeof === 'number'` check because `currentPhase: 0` is a valid
  // not-started value; a bare `||` chain would incorrectly fall through.
  const fromProgramme = programme(json).currentPhase;
  if (typeof fromProgramme === 'number') return fromProgramme;
  const fromTopLevel = json && json.currentPhase;
  if (typeof fromTopLevel === 'number') return fromTopLevel;
  return null;
}

function githubStatus(json) {
  // Only accessor (besides currentPhase) that returns null: the dashboard's
  // `if (!gs) return;` guard treats absence as a signal, not an empty object.
  const fromProgramme = programme(json).githubStatus;
  if (fromProgramme && typeof fromProgramme === 'object') return fromProgramme;
  const fromTopLevel = json && json.githubStatus;
  if (fromTopLevel && typeof fromTopLevel === 'object') return fromTopLevel;
  return null;
}

function project(json) {
  return programme(json).project || (json && json.project) || {};
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
