#!/usr/bin/env node
/**
 * watch-dashboard.js — Regenerate docs/dashboard.html every N seconds.
 *
 * Usage:
 *   node tools/watch-dashboard.js          # default 3s interval
 *   node tools/watch-dashboard.js 5        # 5s interval
 *
 * Open docs/dashboard.html in your browser; it reloads automatically
 * every 5s via the <meta refresh> tag. The watch loop keeps the file
 * up-to-date so reloads always show the latest agent state.
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const intervalSec = parseInt(process.argv[2], 10) || 3;

function regen() {
  try {
    execSync('node tools/generate-dashboard.js', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    process.stdout.write('.');
  } catch (e) {
    process.stderr.write(`[watch-dashboard] regen failed: ${e.message}\n`);
  }
}

console.log(`[watch-dashboard] Regenerating docs/dashboard.html every ${intervalSec}s.`);
console.log('[watch-dashboard] Open docs/dashboard.html in your browser. Press Ctrl+C to stop.\n');

regen(); // immediate first regen
setInterval(regen, intervalSec * 1000);
