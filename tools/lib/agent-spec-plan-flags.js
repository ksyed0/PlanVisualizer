'use strict';
const fs = require('fs');
const path = require('path');

const FLAG_REGEX = /^(approve|reject)-(US-[\w]+)-(ac|spec|plan)\.flag$/;

/**
 * Parse a flag filename into its components.
 * Returns { action, story, gate } or null if invalid.
 */
function parseFlagFilename(name) {
  const m = name.match(FLAG_REGEX);
  if (!m) return null;
  return { action: m[1], story: m[2], gate: m[3] };
}

/**
 * Read and validate a flag file.
 * Returns { ok: true, payload } or { ok: false, reason }.
 */
function readFlag(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return { ok: false, reason: `read failed: ${e.message}` };
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: `JSON parse failed: ${e.message}` };
  }
  const required = ['story', 'gate', 'action', 'timestamp'];
  for (const f of required) {
    if (!payload[f]) return { ok: false, reason: `missing field '${f}'` };
  }
  if (payload.action === 'reject' && !payload.reason) {
    return { ok: false, reason: `missing field 'reason' for reject action` };
  }
  return { ok: true, payload };
}

/**
 * Scan a directory for .flag files. Returns sorted-by-timestamp array.
 * Each entry: { filePath, name, parsed, ok, payload | reason }.
 * Malformed flags have ok:false and reason.
 */
function scanPendingDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.flag'))
    .map((name) => {
      const filePath = path.join(dir, name);
      const parsed = parseFlagFilename(name);
      if (!parsed) {
        return { filePath, name, parsed: null, ok: false, reason: `invalid filename '${name}'` };
      }
      const r = readFlag(filePath);
      if (!r.ok) return { filePath, name, parsed, ok: false, reason: r.reason };
      return { filePath, name, parsed, ok: true, payload: r.payload };
    });
  // Sort by timestamp (malformed entries get sorted last using string fallback)
  entries.sort((a, b) => {
    const aTs = a.ok ? a.payload.timestamp : 'z';
    const bTs = b.ok ? b.payload.timestamp : 'z';
    return aTs.localeCompare(bTs);
  });
  return entries;
}

module.exports = {
  parseFlagFilename,
  readFlag,
  scanPendingDir,
};
