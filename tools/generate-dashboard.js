#!/usr/bin/env node
/**
 * SDLC Live Dashboard Generator
 * Reads sdlc-status.json and project files, generates a self-contained HTML dashboard.
 *
 * Usage:
 *   node tools/generate-dashboard.js          # Generate once
 *   node tools/generate-dashboard.js --watch   # Watch and regenerate on changes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// US-0125 (EPIC-0016): shared semantic badge helpers extracted from
// tools/lib/render-html.js. Imported here so later stories
// (US-0118/US-0119/US-0120) can wire the Agentic Dashboard's status
// pills (agent-status, story-status, epic-status) into the same
// semantic vocabulary as the Plan Visualizer. Existing pill rendering
// is intentionally left inline until those stories add matching
// .badge/.badge-* CSS scaffolding to dashboard.html — see US-0125
// report notes for the rationale.
// eslint-disable-next-line no-unused-vars
const { badge, BADGE_TONE } = require('./lib/theme');

const ROOT = path.resolve(__dirname, '..');

// sdlc-status.json is gitignored and only exists in the main repo checkout,
// not in worktrees. Walk up to the git root so worktree invocations find it.
function findGitRoot(start) {
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start; // filesystem root — fall back
    dir = parent;
  }
}
const GIT_ROOT = findGitRoot(ROOT);
const STATUS_PATH = path.join(GIT_ROOT, 'docs', 'sdlc-status.json');
const PLAN_STATUS_PATH = path.join(ROOT, 'docs', 'plan-status.json');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'dashboard.html');

// Git + version metadata (mirrors tools/generate-plan.js helpers) so the About
// modal can display "This Project" / "Dashboard Tool" sections with parity
// to the Plan Visualizer's About modal (US-0109).
function getCommitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}
function getBuildNumber() {
  try {
    return execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '0';
  }
}
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}
function getProjectPkg() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return { name: pkg.name || 'project', version: pkg.version || '0.0.0' };
  } catch {
    return { name: 'project', version: '0.0.0' };
  }
}
// The tool (PlanVisualizer) lives in the same repo for self-hosted use.
// When installed into another project, the tool pkg is one level up from tools/.
function getToolPkg() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return { name: pkg.name || 'plan-visualizer', version: pkg.version || '0.0.0' };
  } catch {
    return { name: 'plan-visualizer', version: '0.0.0' };
  }
}

// Load agent config (colors, icons, roles) from agents.config.json
function loadAgentConfig() {
  const cfgPath = path.join(ROOT, 'agents.config.json');
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return {};
  }
}

const AGENT_CONFIG = loadAgentConfig();

// Dashboard title/subtitle/footer from config, defaulting to repo name from package.json
function getDashboardMeta() {
  const dashCfg = AGENT_CONFIG.dashboard || {};
  let fallbackName = 'SDLC Dashboard';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    if (pkg.name) fallbackName = pkg.name;
  } catch {
    /* ignore */
  }
  return {
    title: dashCfg.title || fallbackName,
    subtitle: dashCfg.subtitle || 'Agentic AI SDLC',
    footer: dashCfg.footer || `Agentic AI SDLC | ${fallbackName}`,
    repoUrl: dashCfg.repoUrl || '',
    primaryColor: dashCfg.primaryColor || '#D52B1E',
    platform: dashCfg.platform || 'Agentic AI',
    agentCount: Object.keys(AGENT_CONFIG.agents || {}).length,
    author: dashCfg.author || '',
    authorTitle: dashCfg.authorTitle || '',
  };
}

const DASH_META = getDashboardMeta();

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// US-0121 AC-0411: Normalize a log time string to bracketed [HH:MM:SS].
// sdlc-status.json log entries historically stored HH:MM; pad seconds so
// the terminal-aesthetic format stays consistent for old and new rows.
function formatLogTime(raw) {
  const t = String(raw || '').trim();
  if (!t) return '--:--:--';
  // ISO format (contains 'T'): parse as Date and extract HH:MM:SS
  if (t.includes('T')) {
    const d = new Date(t);
    if (!isNaN(d)) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
  }
  const parts = t.split(':');
  if (parts.length < 2) return t;
  const h = parts[0].padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  const s = (parts[2] || '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// US-0121 AC-0413: Derive a filter category from the message body by
// case-insensitive substring match. Order matters: "error" wins over the
// rest so a "bug review error" row surfaces under the Errors chip first.
function logCategory(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('error')) return 'errors';
  if (m.includes('review')) return 'reviews';
  if (m.includes('test')) return 'tests';
  if (m.includes('bug')) return 'bugs';
  return 'other';
}

// Read the Plan Visualizer's derived project data (produced by tools/generate-plan.js)
// so the dashboard can show authoritative story/epic/task/bug counts instead of the
// hand-maintained sdlc-status.json metric fields, which drift. Returns null if the
// file is missing or malformed — callers must handle the null case.
function loadPlanData() {
  try {
    return JSON.parse(fs.readFileSync(PLAN_STATUS_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// US-0120 AC-0408: format a duration between startedAt and now as "6h 23m",
// "12m", or "45s". Returns null if the input is missing/invalid so callers can
// choose whether to render the pill at all. Negative durations clamp to 0s so
// clock-skew between the writer and this renderer never produces "-3m".
function formatElapsed(startedAt, nowMs) {
  if (!startedAt) return null;
  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs)) return null;
  const deltaMs = Math.max(0, (typeof nowMs === 'number' ? nowMs : Date.now()) - startMs);
  const totalSeconds = Math.floor(deltaMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function generateHTML(status) {
  const now = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  // Build-time metadata for the About modal (US-0109 parity with plan-status.html)
  const PROJECT_PKG = getProjectPkg();
  const TOOL_PKG = getToolPkg();
  const COMMIT_SHA = getCommitSha();
  const BUILD_NUMBER = getBuildNumber();
  const GIT_BRANCH = getCurrentBranch();
  const agents = status.agents;
  const phases = status.phases;
  const metrics = { ...status.metrics };
  const stories = status.stories;
  const log = status.log || [];

  // BUG-0164 / BUG-0166 — enrich with authoritative project data from plan-status.json.
  // sdlc-status.json's metric fields and epic/story titles drift because nothing
  // recomputes them; when plan-status.json is present we derive the truth instead.
  const planData = loadPlanData();
  const storyTitles = {};
  const epicTitles = {};
  if (planData) {
    planData.stories.forEach((s) => {
      storyTitles[s.id] = s.title;
    });
    planData.epics.forEach((e) => {
      epicTitles[e.id] = e.title;
    });
    const isDone = (s) => /^(Complete|Done)$/i.test(s.status);
    const isBugOpen = (b) => !/^(Fixed|Retired|Cancelled|Verified|Closed)/i.test(b.status);
    const isBugFixed = (b) => /^(Fixed|Verified|Closed)/i.test(b.status);
    metrics.storiesTotal = planData.stories.length;
    metrics.storiesCompleted = planData.stories.filter(isDone).length;
    metrics.tasksTotal = planData.tasks.length;
    metrics.tasksCompleted = planData.tasks.filter(isDone).length;
    metrics.bugsOpen = planData.bugs.filter(isBugOpen).length;
    metrics.bugsFixed = planData.bugs.filter(isBugFixed).length;
    if (
      planData.coverage &&
      planData.coverage.available !== false &&
      typeof planData.coverage.statements === 'number'
    ) {
      metrics.coveragePercent = planData.coverage.statements;
    }
  }

  // Agent colors, icons, roles, and avatars derived from agents.config.json
  const agentColors = {};
  const agentIcons = {};
  const agentRoles = {};
  const agentAvatars = {};
  for (const [name, cfg] of Object.entries(AGENT_CONFIG.agents || {})) {
    agentColors[name] = cfg.color || '#888';
    agentIcons[name] = cfg.icon || '🤖';
    agentRoles[name] = cfg.role || name;
    agentAvatars[name] = cfg.avatar || name.toLowerCase();
  }

  const phasesComplete = phases.filter((p) => p.status === 'complete').length;
  const pipelineComplete = phasesComplete === phases.length && phases.length > 0;

  const phasePercent = phases.length > 0 ? Math.round((phasesComplete / phases.length) * 100) : 0;

  // US-0114: compute current phase label for center zone
  const currentPhaseObj =
    phases.find((p) => p.status === 'in-progress') ||
    (pipelineComplete ? null : phases.filter((p) => p.status === 'complete').pop());
  const phaseLabel = pipelineComplete
    ? 'COMPLETE'
    : currentPhaseObj
      ? `PHASE ${phases.indexOf(currentPhaseObj) + 1} / ${(currentPhaseObj.name || currentPhaseObj.id || '').toUpperCase()}`
      : 'STANDBY';

  // US-0114: detect if any agent or phase is BLOCKED for header accent
  const anyBlocked =
    phases.some((p) => p.status === 'blocked') || Object.values(agents || {}).some((a) => a && a.status === 'blocked');

  const storyPercent =
    metrics.storiesTotal > 0 ? Math.round((metrics.storiesCompleted / metrics.storiesTotal) * 100) : 0;

  // US-0118 AC-0397: coverage threshold → semantic tone.
  //   green  ≥ 80%
  //   amber  60–80%
  //   red    <  60%
  const coveragePct = typeof metrics.coveragePercent === 'number' ? metrics.coveragePercent : 0;
  const coverageTone = coveragePct >= 80 ? 'green' : coveragePct >= 60 ? 'amber' : 'red';

  // US-0118 AC-0396: sparkline bar heights keyed to phase status. Complete
  // phases render at full height, in-progress at ~60%, pending at a short
  // baseline so the shape still reads as a mini chart.
  const sparkHeights = phases.map((p) => {
    if (p.status === 'complete') return 100;
    if (p.status === 'in-progress') return 60;
    return 18;
  });

  // US-0115 (EPIC-0016): cycle counter + per-phase fill ratio.
  //
  // Cycle N is defined as "completed stories + 1" (AC-0384). The active
  // implementation target is the currently In Progress story (or null →
  // "STANDBY"). The active-phase fill ratio (AC-0385) uses the same
  // storiesCompleted / storiesTotal ratio; when totals are missing we fall
  // back to 50% so the bar still reads as partial progress rather than
  // empty. The cycle "elapsed HH:MM:SS" timer is kicked off client-side
  // (see updateCycleElapsed() below) from a data-started-at attribute on
  // #cycle-elapsed; the server renders 00:00:00 as a placeholder.
  const cycleStories = (status && status.stories) || {};
  const cycleStoryEntries = Object.entries(cycleStories).map(([id, s]) => ({ id, ...s }));
  const cycleCompletedCount = cycleStoryEntries.filter((s) => /^(Complete|Done)$/i.test(s.status)).length;
  const cycleNumber = cycleCompletedCount + 1;
  const cycleActiveStory = cycleStoryEntries.find((s) => /^In[ -]?Progress$/i.test(s.status)) || null;
  const cycleTargetId = cycleActiveStory ? cycleActiveStory.id : null;
  const cycleLabel = cycleTargetId ? `CYCLE ${cycleNumber} \u00B7 IMPLEMENTING ${cycleTargetId}` : 'STANDBY';
  // Partial fill ratio for the in-progress phase (AC-0385). Prefer story
  // completion within the metrics object (authoritative after BUG-0166),
  // fall back to 50% so the fill still reads as partial-progress when the
  // source data hasn't caught up yet.
  const cycleFillRatio =
    metrics && metrics.storiesTotal > 0
      ? Math.max(0.04, Math.min(1, metrics.storiesCompleted / metrics.storiesTotal))
      : 0.5;
  const cycleFillPct = Math.round(cycleFillRatio * 100);
  // Elapsed-ms helper for completed phases (AC-0386). Returns a formatted
  // "HH:MM:SS" string (with leading zeros) when both timestamps are valid,
  // empty string otherwise. The client-side refresh never rewrites these
  // strings — completed-phase elapsed is static.
  function formatPhaseElapsed(startedAt, completedAt) {
    if (!startedAt || !completedAt) return '';
    const ms = Date.parse(completedAt) - Date.parse(startedAt);
    if (!isFinite(ms) || ms < 0) return '';
    const totalS = Math.floor(ms / 1000);
    const h = Math.floor(totalS / 3600);
    const m = Math.floor((totalS % 3600) / 60);
    const s = totalS % 60;
    const pad = (n) => (n < 10 ? '0' : '') + n;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  // AC-0384: ISO start for the cycle elapsed ticker. Prefer the active
  // story's startedAt, fall back to the in-progress phase's startedAt,
  // else empty string (client keeps 00:00:00).
  const cycleStartedAt =
    (cycleActiveStory && cycleActiveStory.startedAt) ||
    (phases.find((p) => p.status === 'in-progress') || {}).startedAt ||
    '';

  // US-0118 AC-0398: pull the most recent review verdicts from status.log.
  // Canonical messages emitted by tools/update-sdlc-status.js are
  //   "approve review of US-XXXX" / "block review of US-XXXX".
  // We also match the raw tokens "approved"/"blocked" for safety.
  const reviewRegex = /^(approve|block)\s+review\s+of\s+(US-\d{4}|[A-Za-z0-9_-]+)/i;
  const reviewEntries = [];
  for (let i = log.length - 1; i >= 0 && reviewEntries.length < 5; i--) {
    const entry = log[i] || {};
    const msg = String(entry.message || '');
    const m = msg.match(reviewRegex);
    if (m) {
      reviewEntries.push({
        agent: entry.agent || 'Reviewer',
        verdict: m[1].toLowerCase() === 'block' ? 'block' : 'approve',
        target: m[2],
        time: entry.time || '',
      });
    }
  }

  // US-0118 AC-0400: "LAST UPDATED HH:MM" footer stamp — server-rendered
  // from current generation time. refreshState() rewrites it on each fetch.
  const stampHHMM = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // SVG doughnut geometry. With r=15.9155 the circumference is exactly 100,
  // so stroke-dasharray can be written as "<percent> 100" without extra math.
  const doughnutOffset = (100 - Math.max(0, Math.min(100, coveragePct))).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${DASH_META.title} — SDLC Live Dashboard</title>
<!-- US-0110 AC-0361: Departure Mono (display numerics) + Geist (sans), font-display:swap via Google Fonts. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Departure+Mono&family=Geist:wght@400;500;600;700&display=swap">
<!-- US-0111 AC-0366: JetBrains Mono for the "Last updated: N ago" live-tick ticker. -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
  :root {
    --brand-primary: ${DASH_META.primaryColor};
    /* US-0110 AC-0361: scoped font stacks — do NOT reassign existing typography
       to avoid cascade into unrelated surfaces; only .section-header opts in. */
    --font-display: 'Departure Mono', 'SF Mono', Menlo, Consolas, monospace;
    --font-sans: 'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    /* US-0110: canvas bg aligned with Plan Visualizer dark canvas (US-0094/US-0095). */
    --bg-primary: #0b0d12;
    --bg-card: #16213e;
    --bg-card-inner: #1a1a3e;
    --bg-card-border: #2a2a5a;
    --bg-phase-pending: #2a2a4a;
    --bg-phase-border: #3a3a5a;
    --bg-phase-complete: #1a3a2a;
    --bg-progress: #2a2a4a;
    --text-primary: #e0e0e0;
    --text-secondary: #aaa;
    --text-muted: #999;
    --text-dim: #777;
    --divider: #2a2a4a;
    --story-title: #ccc;
    --footer-text: #666;
    --status-planned-bg: #2a2a4a;
    --status-planned-color: #888;
    --status-inprogress-bg: #3a2a0a;
    --status-complete-bg: #1a3a2a;
    --live-accent:      oklch(72% 0.19 38);
    --live-accent-soft: oklch(72% 0.19 38 / 0.18);
    --live-accent-ink:  oklch(55% 0.18 38);
    --plan-accent:      oklch(62% 0.19 268);
    --plan-accent-soft: oklch(62% 0.19 268 / 0.14);
    --plan-accent-ink:  oklch(42% 0.18 268);
    --ok:               oklch(68% 0.15 150);
    --warn:             oklch(74% 0.16 78);
    --risk:             oklch(64% 0.20 25);
    --info:             oklch(66% 0.14 240);
  }
  [data-theme="light"] {
    --bg-primary: #f0f2f5;
    --bg-card: #ffffff;
    --bg-card-inner: #f5f5f5;
    --bg-card-border: #e0e0e0;
    --bg-phase-pending: #f5f5f5;
    --bg-phase-border: #ddd;
    --bg-phase-complete: #e8f5e9;
    --bg-progress: #e0e0e0;
    --text-primary: #1a1a2e;
    --text-secondary: #555;
    --text-muted: #666;
    --text-dim: #999;
    --divider: #e8e8e8;
    --story-title: #333;
    --footer-text: #999;
    --status-planned-bg: #e8e8e8;
    --status-planned-color: #666;
    --status-inprogress-bg: #fff3e0;
    --status-complete-bg: #e8f5e9;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: var(--bg-primary);
    /* US-0110 AC-0360: subtle dot-grid — scoped to dark theme only, visible but low-key. */
    background-image: radial-gradient(circle, rgba(148,163,184,0.06) 1px, transparent 1px);
    background-size: 24px 24px;
    color: var(--text-primary);
    min-height: 100vh;
    transition: background 0.3s, color 0.3s;
  }
  [data-theme="light"] body { background-image: none; }

  /* Header gradient — deep blue provides z-separation from dark body. */
  .header { background: linear-gradient(135deg, #002060 0%, #003087 40%, #0050b3 100%); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 14px 32px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .header.header-blocked { border-top: 2px solid #ef4444; }
  .header-left { display: flex; flex-direction: column; min-width: 0; }
  .header-left .header-title { font-family: var(--font-sans); font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .header-left .header-subtitle { font-family: var(--font-display), 'Departure Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.6); letter-spacing: 0.04em; margin-top: 2px; }
  .header-center { display: flex; align-items: center; gap: 8px; font-family: var(--font-display), 'Departure Mono', monospace; font-size: 12px; color: rgba(255,255,255,0.9); letter-spacing: 0.04em; white-space: nowrap; }
  .header-right { display: flex; align-items: center; gap: 12px; }
  .header-right .clock { text-align: right; }
  .header-right .clock .time { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 22px; font-weight: 600; color: #fff; font-variant-numeric: tabular-nums; }
  .header-right .clock .label { font-size: 11px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1px; }
  [data-theme="light"] .header { background: linear-gradient(135deg, #003087 0%, #0050b3 40%, #1976d2 100%); }
  /* Light theme header keeps white text — gradient is blue in both modes. */
  [data-theme="light"] .header-left .header-title { color: #fff; }
  [data-theme="light"] .header-left .header-subtitle { color: rgba(255,255,255,0.75); }
  [data-theme="light"] .header-center { color: rgba(255,255,255,0.9); }
  [data-theme="light"] .header-right .clock .time { color: #fff; }
  [data-theme="light"] .header-right .clock .label { color: rgba(255,255,255,0.75); }
  [data-theme="light"] .btn-header { background: rgba(255,255,255,0.2); color: #fff; }
  [data-theme="light"] .btn-header:hover { background: rgba(255,255,255,0.35); }
  [data-theme="light"] #theme-toggle { background: rgba(255,255,255,0.2); color: #fff; }
  [data-theme="light"] #theme-toggle:hover { background: rgba(255,255,255,0.35); }
  #theme-toggle { background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; transition: background 0.2s; }
  #theme-toggle:hover { background: rgba(255,255,255,0.35); }

  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

  /* ===== US-0115 BEGIN: 6-phase pipeline timeline =====
     Replaces the earlier .pipeline flex-row with a horizontal timeline of
     phase "stations". Each station shows a phase number (Departure Mono
     32px per AC-0383) above the phase name, a status icon/checkmark, and
     either a partial-progress fill (active, AC-0385), an elapsed-time
     footer in JetBrains Mono (complete, AC-0386), or a rotating beacon
     (blocked, AC-0387). 1px rules connect adjacent stations.

     The structural needle <div class="phase-name">[name]</div> is
     preserved so the US-0124 harness (AC-0427) keeps passing, and stable
     ids (phase-N, phase-N-icon/-check/-elapsed/-fill/-num) keep patchDOM()
     from US-0111 able to mutate live without a page reload. */
  .cycle-counter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-family: var(--font-display), 'Departure Mono', 'SF Mono', Menlo, Consolas, monospace;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: var(--text-secondary);
    margin-bottom: 10px;
    text-transform: uppercase;
  }
  .cycle-counter .cycle-label { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
  .cycle-counter .cycle-elapsed {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .cycle-counter .cycle-elapsed::before { content: 'ELAPSED '; color: var(--text-dim); margin-right: 6px; }

  .pipeline {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin-bottom: 24px;
    background: var(--bg-card);
    border: 1px solid var(--bg-card-border);
    border-radius: 12px;
    padding: 16px 8px 14px;
    position: relative;
    overflow: hidden;
  }
  .phase-block {
    flex: 1;
    position: relative;
    padding: 6px 10px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    min-width: 0;
    transition: opacity 0.3s;
    z-index: 1;
  }
  /* 1px horizontal rule connecting adjacent phase stations (AC-0383). The
     connector sits at the vertical middle of the phase-number row. The
     first station omits the left half of the connector. */
  .phase-block::before {
    content: '';
    position: absolute;
    top: 22px; /* centred on the ~32px phase-number line */
    left: 0;
    right: 50%;
    height: 1px;
    background: var(--bg-phase-border);
    z-index: 0;
  }
  .phase-block::after {
    content: '';
    position: absolute;
    top: 22px;
    left: 50%;
    right: 0;
    height: 1px;
    background: var(--bg-phase-border);
    z-index: 0;
  }
  .phase-block:first-child::before { background: transparent; }
  .phase-block:last-child::after { background: transparent; }
  .phase-block.complete::before,
  .phase-block.complete::after,
  .phase-block.in-progress::before { background: #2E7D32; }

  .phase-number {
    font-family: var(--font-display), 'Departure Mono', 'SF Mono', Menlo, Consolas, monospace;
    font-size: 32px;
    line-height: 1;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    margin-bottom: 8px;
    padding: 0 8px;
    background: var(--bg-card);
    position: relative;
    z-index: 2;
  }
  .phase-block.in-progress .phase-number { color: #F57C00; }
  .phase-block.complete .phase-number { color: #34A853; }
  [data-theme="light"] .phase-block.in-progress .phase-number { color: #E65100; }
  [data-theme="light"] .phase-block.complete .phase-number { color: #2E7D32; }
  .phase-block.blocked .phase-number { color: #ef4444; }

  .phase-name {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-primary);
    margin-bottom: 6px;
    position: relative;
    z-index: 2;
  }
  .phase-block.pending .phase-name { color: var(--text-muted); }

  .phase-status {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 14px;
    opacity: 0.6;
    z-index: 2;
  }
  .phase-agents { font-size: 10px; color: var(--text-muted); margin-top: 2px; letter-spacing: 0.04em; }
  .phase-deliverables { font-size: 9px; color: var(--text-dim); margin-top: 4px; letter-spacing: 0.04em; }

  /* AC-0385: partial-progress fill under the active phase. Width is set
     inline from storiesCompleted/storiesTotal at render time and patched
     by refreshState(). Rendered underneath the text so it reads as a
     station "load bar", not a label. */
  .phase-fill-track {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 4px;
    height: 3px;
    background: var(--bg-phase-pending);
    border-radius: 2px;
    overflow: hidden;
    z-index: 1;
  }
  .phase-fill-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #F57C00, #FFB74D);
    transition: width 0.6s ease;
    border-radius: 2px;
  }
  .phase-block.complete .phase-fill-bar { background: linear-gradient(90deg, #2E7D32, #66BB6A); width: 100%; }

  /* AC-0386: completed phase checkmark + elapsed footer. Shown only when
     .complete class is present; hidden for pending/in-progress/blocked. */
  .phase-check {
    display: none;
    font-size: 14px;
    color: #34A853;
    margin-right: 4px;
  }
  .phase-block.complete .phase-check { display: inline-block; }
  [data-theme="light"] .phase-check { color: #2E7D32; }
  .phase-elapsed {
    display: none;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    margin-top: 4px;
  }
  .phase-block.complete .phase-elapsed[data-has-elapsed="1"] { display: block; }

  /* AC-0387: BLOCKED rotating beacon. A conic-gradient sweep rides over
     the phase station on a 1s rotation. prefers-reduced-motion disables
     the rotation and substitutes a static red overlay so the blocked
     state is still perceivable without motion. */
  .phase-block.blocked {
    background: rgba(239, 68, 68, 0.08);
    border-radius: 8px;
  }
  .phase-block.blocked::before,
  .phase-block.blocked::after { background: #ef4444; }
  .phase-block .phase-beacon {
    display: none;
    position: absolute;
    inset: 0;
    border-radius: 8px;
    pointer-events: none;
    z-index: 0;
    background: conic-gradient(from 0deg, transparent 0deg, rgba(239, 68, 68, 0.35) 60deg, transparent 120deg, transparent 360deg);
    opacity: 0.85;
    mix-blend-mode: screen;
  }
  .phase-block.blocked .phase-beacon { display: block; }
  @media (prefers-reduced-motion: no-preference) {
    .phase-block.blocked .phase-beacon {
      animation: phase-beacon-sweep 1s linear infinite;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .phase-block.blocked .phase-beacon {
      animation: none;
      background: rgba(239, 68, 68, 0.18);
    }
  }
  @keyframes phase-beacon-sweep {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 124, 0, 0.4); } 50% { box-shadow: 0 0 20px 4px rgba(245, 124, 0, 0.2); } }
  /* ===== US-0115 END ===== */

  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
  .grid-2 > * { min-width: 0; }

  .card { background: var(--bg-card); border-radius: 12px; padding: 20px; border: 1px solid var(--bg-card-border); transition: background 0.3s, border-color 0.3s; }
  .card h2 { font-size: 15px; font-weight: 700; margin-bottom: 16px; color: var(--brand-primary); text-transform: uppercase; letter-spacing: 1px; }

  /* US-0110 AC-0362: tracked-out muted section label (Geist, 11px, 700, 0.14em).
     Overrides .card h2 brand color/sizing when both classes apply. */
  .section-header,
  .card h2.section-header {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 12px;
    display: block;
  }

  /* Metrics */
  .metric-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--divider); }
  .metric-row:last-child { border-bottom: none; }
  .metric-label { font-size: 13px; color: var(--text-secondary); }
  .metric-value { font-size: 20px; font-weight: 700; }
  .metric-value.green { color: #34A853; }
  .metric-value.red { color: var(--brand-primary); }
  .metric-value.blue { color: #1565C0; }
  .metric-value.orange { color: #F57C00; }
  [data-theme="light"] .metric-value.orange { color: #E65100; }
  [data-theme="light"] .metric-value.green { color: #2E7D32; }

  /* Progress bars */
  .progress-bar { height: 8px; background: var(--bg-progress); border-radius: 4px; overflow: hidden; margin-top: 6px; }
  .progress-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .progress-fill.red { background: linear-gradient(90deg, var(--brand-primary), #F44336); }
  .progress-fill.green { background: linear-gradient(90deg, #2E7D32, #4CAF50); }
  .progress-fill.blue { background: linear-gradient(90deg, #1565C0, #42A5F5); }

  /* US-0119 AC-0401: Agent spotlight banner — broadcast "on air" stage.
     240px tall with a 160px portrait thumbnail, Geist Display 28px name,
     small-caps role micro-copy, JetBrains Mono current-task and elapsed
     ticker. Two-column flex layout (portrait | info) replaces the earlier
     full-bleed background + absolute overlay so the composition is
     legible at higher sizes without depending on a gradient to mask the
     image. */
  .agent-spotlight { position: relative; border-radius: 12px; overflow: hidden; margin-bottom: 14px; height: 240px; background: var(--bg-card-inner); display: flex; align-items: stretch; gap: 20px; padding: 20px; border: 1px solid var(--bg-card-border); }
  .agent-spotlight.no-active { display: flex; align-items: center; justify-content: center; height: 100px; padding: 12px; }
  .agent-spotlight.no-active .spotlight-waiting { color: var(--text-muted); font-size: 13px; font-style: italic; }
  .spotlight-portrait-wrap { flex: 0 0 160px; width: 160px; height: 100%; border-radius: 10px; overflow: hidden; position: relative; border: 3px solid; background: var(--bg-primary); }
  .spotlight-img { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }
  .spotlight-info { position: relative; flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 8px; justify-content: center; }
  .spotlight-name { font-family: var(--font-sans); font-size: 28px; font-weight: 700; letter-spacing: -0.01em; color: var(--text-primary); display: flex; align-items: center; gap: 10px; line-height: 1.1; }
  [data-theme="light"] .spotlight-name { color: var(--text-primary); }
  .spotlight-role { font-family: var(--font-sans); font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-muted); }
  .spotlight-task { font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; color: var(--text-secondary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
  .spotlight-elapsed { font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; color: var(--text-dim); letter-spacing: 0.04em; font-variant-numeric: tabular-nums; margin-top: 2px; }
  .spotlight-elapsed::before { content: 'ELAPSED '; color: var(--text-muted); letter-spacing: 0.14em; }

  /* US-0119 AC-0402/0403/0404/0405: Vertical station cards. Portrait on
     top (80x80 circle, 2px agent-color ring), then name, role micro-copy,
     status pill. Active station gets a 3px agent-color box-shadow glow
     (variable --agent-color set inline per card) plus a pulsing green
     "now on air" dot. Idle stations fade to 0.5 opacity. Hover replaces
     the old filter:brightness(1.12) — invisible in light mode (BUG-0161)
     — with a 4px agent-color outline glow. */
  .agent-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .agent-card { position: relative; background: var(--bg-card-inner); border-radius: 10px; padding: 14px 10px; transition: transform 150ms ease, box-shadow 150ms ease, opacity 0.2s; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; border: 1px solid var(--bg-card-border); }
  .agent-card.idle { opacity: 0.5; }
  .agent-card:hover { transform: translateY(-1px); box-shadow: 0 0 0 4px var(--agent-color-ring, rgba(136,136,136,0.35)); opacity: 1; }
  .agent-card.active { box-shadow: 0 0 0 3px var(--agent-color, #888), 0 6px 24px rgba(0,0,0,0.35); }
  .agent-card.active:hover { box-shadow: 0 0 0 3px var(--agent-color, #888), 0 0 0 7px var(--agent-color-ring, rgba(136,136,136,0.35)); }
  .agent-card .on-air-dot { position: absolute; top: 8px; right: 10px; display: none; }
  .agent-card.active .on-air-dot { display: inline-block; }
  /* US-0142: status-class prominence — is-active tinted bg + accent border */
  .agent-card.is-active { border-color: var(--live-accent); background: color-mix(in oklab, var(--live-accent) 6%, var(--surface, #16213e)); box-shadow: 0 0 0 1px var(--live-accent), var(--shadow, 0 4px 16px rgba(0,0,0,0.3)); }
  .agent-card.is-blocked { border-color: rgba(234,67,53,0.5); }
  .agent-card.is-review { border-color: rgba(66,133,244,0.4); }
  /* US-0142: left accent rail — position absolute, requires overflow:hidden on card */
  .agent-rail { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--live-accent); border-radius: 10px 0 0 10px; }
  /* US-0142: pulsing live dot for active agents */
  .agent-live-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--text-muted, #999); }
  .dot-pulse { background: var(--live-accent) !important; box-shadow: 0 0 0 3px var(--live-accent-soft); animation: pv-pulse 1.4s ease-in-out infinite; }
  @keyframes pv-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  #agent-portrait-popup { position: fixed; z-index: 999; width: 200px; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.7); pointer-events: none; display: none; transition: opacity 0.15s; border: 2px solid rgba(255,255,255,0.12); }
  #agent-portrait-popup img { width: 100%; display: block; border-radius: 12px; object-fit: cover; object-position: center top; }
  .agent-avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; object-position: center top; border: 2px solid var(--agent-color, #888); flex-shrink: 0; }
  .agent-avatar-fallback { width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--agent-color, #888); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 32px; background: var(--bg-phase-pending); }
  .agent-info { min-width: 0; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
  .agent-name { font-family: var(--font-sans); font-size: 13px; font-weight: 700; letter-spacing: 0.01em; }
  .agent-role { font-family: var(--font-sans); font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
  .agent-status { font-size: 10px; font-weight: 600; padding: 2px 10px; border-radius: 10px; display: inline-block; text-transform: uppercase; letter-spacing: 0.06em; }
  .agent-task { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 10px; color: var(--text-secondary); margin-top: 4px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Story table */
  .story-list { display: flex; flex-direction: column; gap: 10px; }
  .epic-group { }
  /* US-0120 AC-0409: epic header reuses .section-header tracked-out treatment
     (Departure Mono-aligned via var(--font-display), uppercase, 0.14em) for
     visual consistency with the other "SECTION" labels across the dashboard. */
  .epic-header { font-family: var(--font-display), 'Departure Mono', 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.14em; padding: 0 4px 4px; border-bottom: 1px solid var(--divider); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
  .epic-header:hover { color: var(--text-secondary); }
  .epic-toggle { font-size: 9px; margin-left: auto; opacity: 0.6; transition: transform 0.2s; }
  .epic-group.collapsed .epic-toggle { transform: rotate(-90deg); }
  .epic-group.collapsed .epic-stories { display: none; }
  .epic-id { color: var(--brand-primary); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; }
  .epic-stories { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .epic-stories > * { min-width: 0; }
  /* US-0120 AC-0407: 3px vertical status strip on the left of each story row.
     Colour is swapped via .status-complete / .status-inprogress / .status-planned
     modifiers so patchDOM() could later retune it without re-rendering. */
  .story-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--bg-card-inner); border-radius: 6px; font-size: 12px; transition: all 0.2s; min-width: 0; border-left: 3px solid #64748b; }
  .story-row:hover { filter: brightness(1.1); }
  .story-row.status-complete { border-left-color: #22c55e; }
  .story-row.status-inprogress { border-left-color: #f59e0b; }
  .story-row.status-planned { border-left-color: #64748b; }
  .story-id { font-weight: 700; color: var(--brand-primary); width: 65px; flex-shrink: 0; }
  /* US-0120 AC-0410: keep .story-title's min-width:0 intact (BUG-0164 fix) so
     long titles still truncate correctly when an agent dot is present. */
  .story-title { flex: 1; min-width: 0; color: var(--story-title); margin: 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
  .story-title-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .story-agent { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; font-size: 10px; font-weight: 600; color: var(--text-secondary); }
  .story-agent-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  /* US-0120 AC-0408: elapsed-time pill in JetBrains Mono next to the status
     badge. Rendered only for In Progress stories that carry a startedAt stamp. */
  .story-elapsed {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    flex-shrink: 0;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    margin-right: 6px;
  }
  [data-theme="light"] .story-elapsed { color: #b45309; }
  .story-status { font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; flex-shrink: 0; white-space: nowrap; }
  .story-status.Planned { background: var(--status-planned-bg); color: var(--status-planned-color); }
  .story-status.InProgress { background: var(--status-inprogress-bg); color: #F57C00; }
  [data-theme="light"] .story-status.InProgress { color: #E65100; }
  .story-status.Complete { background: var(--status-complete-bg); color: #34A853; }
  [data-theme="light"] .story-status.Complete { color: #2E7D32; }

  /* ===== US-0121 BEGIN: Terminal-aesthetic activity log ===== */
  /* AC-0411..AC-0415: monospace log rows with agent-color left bar, bracketed
     [HH:MM:SS] [AGENT] message format, filter chips, tail-mode toggle, and a
     blinking-cursor empty state. Colors honour the three-token split
     (AC-0412): muted gray timestamps, agent-color AGENT token, primary
     foreground for the message body. */
  .log-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace;
  }
  .log-filters { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; min-width: 0; }
  .log-filter-chip {
    font-family: inherit;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 4px 10px;
    border-radius: 10px;
    border: 1px solid var(--divider);
    background: var(--bg-card-inner);
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .log-filter-chip:hover { color: var(--text-primary); border-color: var(--text-muted); }
  .log-filter-chip.active {
    background: rgba(66, 165, 245, 0.18);
    color: #1565C0;
    border-color: rgba(66, 165, 245, 0.55);
  }
  [data-theme="light"] .log-filter-chip.active { color: #0D47A1; background: rgba(21, 101, 192, 0.12); }
  .log-tail-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    cursor: pointer;
    user-select: none;
  }
  .log-tail-toggle input { margin: 0; cursor: pointer; }
  .log-tail-toggle .tail-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--text-muted);
    display: inline-block;
  }
  .log-tail-toggle.on .tail-dot { background: #34A853; box-shadow: 0 0 6px rgba(52, 168, 83, 0.6); }
  [data-theme="light"] .log-tail-toggle.on .tail-dot { background: #2E7D32; }

  .log-scroll {
    max-height: 240px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
  }
  .log-entry {
    display: block;
    padding: 4px 10px;
    margin-bottom: 2px;
    border-left: 3px solid #888;            /* AC-0411: agent-color left bar */
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-primary);             /* AC-0412: message uses primary fg */
    white-space: pre-wrap;
    word-break: break-word;
    font-variant-numeric: tabular-nums;
  }
  [data-theme="light"] .log-entry { background: rgba(0, 0, 0, 0.02); }
  .log-entry:last-child { margin-bottom: 0; }
  .log-entry.log-hidden { display: none; }
  .log-time { color: var(--text-muted); margin-right: 6px; }     /* AC-0412 */
  .log-agent { font-weight: 700; margin-right: 6px; }            /* agent color inline */
  .log-msg { color: var(--text-primary); }

  /* AC-0415: empty state — blinking terminal cursor + waiting message. */
  .log-empty {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--text-muted);
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .log-cursor {
    display: inline-block;
    width: 0.55em;
    height: 1em;
    background: currentColor;
    vertical-align: -0.1em;
    margin-right: 2px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .log-cursor { animation: blink-cursor 1.05s steps(2, start) infinite; }
  }
  @media (prefers-reduced-motion: reduce) {
    .log-cursor { animation: none; opacity: 0.85; }
  }
  @keyframes blink-cursor {
    to { visibility: hidden; }
  }
  /* ===== US-0121 END ===== */

  /* US-0111 AC-0366: live-fetch "Last updated" ticker. Rendered in JetBrains Mono
     for a console/telemetry feel, with a .stale variant that turns red when
     refreshState() can't reach sdlc-status.json. */
  .last-updated {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.75);
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
  }
  .last-updated.stale { color: #f87171; }
  [data-theme="light"] .last-updated { color: var(--text-muted); }
  [data-theme="light"] .last-updated.stale { color: #dc2626; }

  /* Footer */
  .footer { text-align: center; padding: 16px; color: var(--footer-text); font-size: 11px; }
  .footer span { color: var(--brand-primary); }
  .footer a { color: var(--brand-primary); text-decoration: none; }
  .footer a:hover { text-decoration: underline; }

  /* About button */
  .btn-header { background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; transition: background 0.2s; }
  .btn-header:hover { background: rgba(255,255,255,0.35); }

  /* About modal */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
  .modal-overlay.open { display: flex; }
  .modal { background: var(--bg-card); border: 1px solid var(--bg-card-border); border-radius: 16px; padding: 28px; max-width: 720px; width: 92%; max-height: 88vh; overflow-y: auto; text-align: left; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
  .modal h3 { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: var(--brand-primary); }
  .modal p { font-size: 14px; color: var(--text-secondary); margin-bottom: 6px; }
  .modal .author { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 16px 0 8px; }
  .modal .repo-link { display: inline-block; margin: 10px 0 14px; background: var(--brand-primary); color: white; padding: 7px 16px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; transition: background 0.2s; }
  .modal .repo-link:hover { filter: brightness(0.85); text-decoration: none; }

  /* US-0123: two-column About modal (playbill image | mission + roster + meta) */
  .modal .about-layout { display: grid; grid-template-columns: 200px 1fr; gap: 20px; align-items: start; }
  .modal .about-playbill { border: 2px solid var(--divider); border-radius: 8px; padding: 8px; background: #0b0d12; display: flex; align-items: center; justify-content: center; }
  .modal .about-playbill img { width: 100%; display: block; border-radius: 4px; }
  .modal .about-right { min-width: 0; }
  .modal .about-mission { font-size: 13px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.45; }
  .modal .about-roster-title,
  .modal .about-links-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-muted); margin: 0 0 6px; }
  .modal .about-roster { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; margin-bottom: 14px; list-style: none; padding: 0; }
  .modal .about-roster li { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-primary); min-width: 0; }
  .modal .about-roster img,
  .modal .about-roster .about-roster-fallback { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid var(--bg-card-border); background: var(--bg-card-inner); }
  .modal .about-roster .about-roster-fallback { display: flex; align-items: center; justify-content: center; font-size: 14px; }
  .modal .about-roster-name { font-weight: 600; font-size: 12px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .modal .about-roster-role { font-size: 10px; color: var(--text-muted); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .modal .about-roster-text { min-width: 0; display: flex; flex-direction: column; }
  .modal .about-links { font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; }
  .modal .about-links a { color: var(--brand-primary); text-decoration: none; word-break: break-all; }
  .modal .about-links a:hover { text-decoration: underline; }
  .modal .about-links-row { margin-bottom: 2px; }

  .modal .meta-divider { border-top: 1px solid var(--bg-card-border); padding-top: 14px; margin-top: 14px; text-align: left; font-size: 12px; color: var(--text-muted); }
  .modal .meta-section { margin-bottom: 12px; }
  .modal .meta-section:last-child { margin-bottom: 0; }
  .modal .meta-supertitle { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-muted); margin-bottom: 6px; }
  .modal .meta-row { padding-left: 8px; margin-bottom: 3px; }
  .modal .meta-label { color: var(--text-muted); }
  .modal .meta-value { color: var(--text-primary); font-family: 'JetBrains Mono', 'Menlo', monospace; font-size: 11px; }
  .modal .meta-attribution { margin-top: 14px; font-size: 11px; color: var(--text-muted); text-align: center; }
  .modal-close { position: absolute; top: 12px; right: 16px; background: none; border: none; color: var(--text-muted); font-size: 22px; cursor: pointer; line-height: 1; padding: 4px 8px; border-radius: 6px; transition: background 0.2s; }
  .modal-close:hover { background: var(--bg-card-inner); color: var(--text-primary); }

  /* US-0123: responsive fallback — single column below 640px */
  @media (max-width: 640px) {
    .modal { padding: 20px; }
    .modal .about-layout { grid-template-columns: 1fr; gap: 14px; }
    .modal .about-playbill { max-width: 240px; margin: 0 auto; }
    .modal .about-roster { grid-template-columns: 1fr; }
  }

  /* ===== US-0112 BEGIN: .live-dot indicator (keep contiguous for mechanical rebase) ===== */
  /* Reusable presence indicator — base dot + .ok/.warn/.err variants + pulse halo.
     Color alone is not an accessibility signal (§16): callers must add aria-label+title. */
  .live-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 6px;
    background: #22c55e; /* default to ok-green so unset variant still renders */
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
    flex-shrink: 0;
  }
  /* OK — green #22c55e — contrast vs dark surface #16213e ≈ 6.3:1, vs light #ffffff ≈ 3.1:1 (AA large / non-text 3:1 pass) */
  .live-dot.ok {
    background: #22c55e;
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
  }
  /* WARN — amber #f59e0b — contrast vs dark #16213e ≈ 7.8:1, vs light #ffffff ≈ 2.4:1 bg → uses darker halo in light mode via [data-theme="light"] override below */
  .live-dot.warn {
    background: #f59e0b;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3);
  }
  /* ERR — red #ef4444 — contrast vs dark #16213e ≈ 5.6:1, vs light #ffffff ≈ 3.8:1 */
  .live-dot.err {
    background: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
  }
  /* Light-theme halo boost for warn (amber has low contrast on white) — swap halo for a slightly darker outline so the dot still reads at ≥3:1 */
  [data-theme="light"] .live-dot.warn {
    background: #d97706;
    box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.35);
  }
  [data-theme="light"] .live-dot.ok {
    background: #16a34a;
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.35);
  }
  [data-theme="light"] .live-dot.err {
    background: #dc2626;
    box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.35);
  }

  @keyframes live-dot-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.18); opacity: 0.72; }
  }

  /* Animation only for users who haven't requested reduced motion (AGENTS.md §16). */
  @media (prefers-reduced-motion: no-preference) {
    .live-dot { animation: live-dot-pulse 2.4s ease-in-out infinite; }
  }
  @media (prefers-reduced-motion: reduce) {
    .live-dot { animation: none; }
  }
  /* ===== US-0112 END ===== */

  /* ===== US-0122: BLOCKED full-viewport border + incident ticker ===== */
  /* AC-0416: Red 4px border overlay shown whenever any agent or phase is
     blocked. position:fixed + inset:0 + pointer-events:none guarantees it
     does not intercept clicks or affect layout. Fades in/out on toggle and
     pulses while active; prefers-reduced-motion disables the pulse. */
  .blocked-border {
    position: fixed;
    inset: 0;
    pointer-events: none;
    border: 4px solid #ef4444;
    z-index: 9999;
    opacity: 0;
    transition: opacity 180ms ease;
  }
  .blocked-border.active {
    opacity: 1;
    animation: blocked-border-pulse 1.6s ease-in-out infinite;
  }
  @keyframes blocked-border-pulse {
    0%, 100% { box-shadow: inset 0 0 0 0 rgba(239, 68, 68, 0.0); }
    50%      { box-shadow: inset 0 0 24px 0 rgba(239, 68, 68, 0.35); }
  }
  @media (prefers-reduced-motion: reduce) {
    .blocked-border.active { animation: none; }
  }

  /* AC-0417: Incident ticker beneath the header. Uses --font-display
     (Departure Mono from US-0110) for the terminal aesthetic, a red accent,
     subtle shimmer while active, and display:none when hidden so it
     collapses rather than leaves a blank strip. */
  .incident-ticker {
    font-family: var(--font-display), 'Departure Mono', 'SF Mono', Menlo, monospace;
    color: #ef4444;
    font-size: 12px;
    padding: 6px 16px;
    text-align: center;
    background: rgba(239, 68, 68, 0.08);
    border-bottom: 1px solid rgba(239, 68, 68, 0.25);
    letter-spacing: 0.06em;
    display: none;
  }
  .incident-ticker.active {
    display: block;
    animation: incident-shimmer 3s linear infinite;
    background-size: 200% 100%;
    background-image: linear-gradient(90deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.18) 50%, rgba(239,68,68,0.08) 100%);
  }
  @keyframes incident-shimmer {
    0% { background-position: 0% 0; }
    100% { background-position: -200% 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .incident-ticker.active { animation: none; background-image: none; }
  }
  /* ===== US-0122 END ===== */

  /* ===== US-0118 BEGIN: Differentiated metric cards ===== */
  /* Each of the three TELEMETRY cards tells its own story:
     - Phase Progress: hero number + sparkline (six phase blocks),
     - Quality: SVG doughnut keyed to coverage threshold,
     - Reviews: avatar-chip list derived from status.log entries.
     Semantic colors (AC-0399) match the same thresholds used by the
     progress-fill gradients elsewhere in the dashboard. */
  .metric-card { position: relative; display: flex; flex-direction: column; }
  .metric-hero {
    font-family: var(--font-display), 'Departure Mono', monospace;
    font-size: 56px;
    line-height: 1;
    letter-spacing: 0.02em;
    margin: 4px 0 2px;
    font-variant-numeric: tabular-nums;
  }
  .metric-hero .hero-sep { font-size: 36px; color: var(--text-muted); margin: 0 4px; }
  .metric-hero .hero-den { font-size: 32px; color: var(--text-muted); }
  .metric-hero.blue { color: #1565C0; }
  .metric-hero.green { color: #34A853; }
  .metric-hero.amber { color: #F57C00; }
  .metric-hero.red { color: var(--brand-primary); }
  [data-theme="light"] .metric-hero.green { color: #2E7D32; }
  [data-theme="light"] .metric-hero.amber { color: #E65100; }

  .metric-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: 12px;
  }

  /* Sparkline: one bar per phase, height keyed to per-phase story-complete
     ratio or a fixed "pending" baseline. Pure CSS, no Chart.js needed. */
  .phase-sparkline { height: 32px; display: flex; gap: 4px; align-items: flex-end; margin-bottom: 12px; }
  .phase-sparkline .spark-bar {
    flex: 1;
    min-height: 4px;
    border-radius: 2px;
    background: var(--bg-phase-pending);
    transition: height 0.3s ease, background 0.3s ease;
    position: relative;
  }
  .phase-sparkline .spark-bar.complete { background: linear-gradient(180deg, #42A5F5, #1565C0); }
  .phase-sparkline .spark-bar.in-progress { background: linear-gradient(180deg, #F57C00, #E65100); }
  @media (prefers-reduced-motion: no-preference) {
    .phase-sparkline .spark-bar.in-progress { animation: spark-pulse 1.8s ease-in-out infinite; }
  }
  @keyframes spark-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

  /* Doughnut chart: SVG ring driven by stroke-dasharray.
     viewBox 36x36 keeps circumference tidy (2*pi*15.9155 ~= 100). */
  .doughnut-wrap { display: flex; justify-content: center; align-items: center; padding: 4px 0 6px; }
  .doughnut { position: relative; width: 132px; height: 132px; }
  .doughnut svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .doughnut .d-track { fill: none; stroke: var(--bg-phase-pending); stroke-width: 3.2; }
  .doughnut .d-fill {
    fill: none;
    stroke-width: 3.2;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease;
  }
  .doughnut .d-fill.green { stroke: #34A853; }
  .doughnut .d-fill.amber { stroke: #F57C00; }
  .doughnut .d-fill.red { stroke: var(--brand-primary); }
  [data-theme="light"] .doughnut .d-fill.green { stroke: #2E7D32; }
  [data-theme="light"] .doughnut .d-fill.amber { stroke: #E65100; }
  .doughnut-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    pointer-events: none;
  }
  .doughnut-center .d-num {
    font-family: var(--font-display), 'Departure Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .doughnut-center .d-num.green { color: #34A853; }
  .doughnut-center .d-num.amber { color: #F57C00; }
  .doughnut-center .d-num.red { color: var(--brand-primary); }
  [data-theme="light"] .doughnut-center .d-num.green { color: #2E7D32; }
  [data-theme="light"] .doughnut-center .d-num.amber { color: #E65100; }
  .doughnut-center .d-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.16em;
    margin-top: 2px;
  }

  .quality-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-top: 6px;
    text-align: center;
  }
  .quality-stats .qs-cell { padding: 4px 0; }
  .quality-stats .qs-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    display: block;
    margin-bottom: 3px;
  }
  .quality-stats .qs-val { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .quality-stats .qs-val.green { color: #34A853; }
  .quality-stats .qs-val.red { color: var(--brand-primary); }
  .quality-stats .qs-val.muted { color: var(--text-secondary); }
  [data-theme="light"] .quality-stats .qs-val.green { color: #2E7D32; }

  /* Reviews list with avatar chips. Summary row on top, scrollable list below. */
  .reviews-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
    text-align: center;
  }
  .reviews-summary .rs-cell { padding: 6px 4px; border-radius: 6px; background: var(--bg-card-inner); }
  .reviews-summary .rs-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    display: block;
    margin-bottom: 2px;
  }
  .reviews-summary .rs-val {
    font-family: var(--font-display), 'Departure Mono', monospace;
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .reviews-summary .rs-approved .rs-val { color: #34A853; }
  .reviews-summary .rs-blocked .rs-val { color: var(--brand-primary); }
  [data-theme="light"] .reviews-summary .rs-approved .rs-val { color: #2E7D32; }
  [data-theme="light"] .reviews-summary .rs-blocked .rs-val.zero { color: var(--text-muted); }
  .reviews-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 4px;
    max-height: 172px; overflow-y: auto;
  }
  .review-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 2px;
    border-bottom: 1px solid var(--divider);
  }
  .review-item:last-child { border-bottom: none; }
  .review-chip {
    width: 28px; height: 28px; border-radius: 50%;
    object-fit: cover; object-position: center top;
    border: 2px solid; flex-shrink: 0;
  }
  .review-chip-fallback {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2px solid; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px;
    background: var(--bg-phase-pending);
  }
  .review-body { flex: 1; min-width: 0; }
  .review-line {
    display: flex; align-items: baseline; gap: 6px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .review-agent { font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .review-target {
    font-size: 11px; color: var(--text-secondary);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .review-time {
    font-size: 10px; color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    font-variant-numeric: tabular-nums;
    margin-top: 1px;
  }
  .review-verdict {
    font-size: 9px; font-weight: 700;
    padding: 3px 8px; border-radius: 10px;
    text-transform: uppercase; letter-spacing: 0.06em;
    font-family: 'JetBrains Mono', monospace;
    flex-shrink: 0;
  }
  .review-verdict.approve { color: #34A853; background: rgba(52, 168, 83, 0.14); }
  .review-verdict.block { color: var(--brand-primary); background: rgba(213, 43, 30, 0.16); }
  [data-theme="light"] .review-verdict.approve { color: #2E7D32; background: rgba(46, 125, 50, 0.12); }
  .reviews-empty {
    font-size: 12px; color: var(--text-muted); font-style: italic;
    padding: 16px 0; text-align: center;
  }

  /* AC-0400: hairline footer with "LAST UPDATED HH:MM" stamp. */
  .card-footer {
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid var(--divider);
    display: flex;
    justify-content: flex-start;
    align-items: center;
  }
  .card-footer .stamp {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .card-footer .stamp b { color: var(--text-secondary); font-weight: 600; font-variant-numeric: tabular-nums; }

  @media (max-width: 480px) {
    .metric-hero { font-size: 40px; }
    .metric-hero .hero-den { font-size: 22px; }
    .doughnut { width: 108px; height: 108px; }
    .doughnut-center .d-num { font-size: 22px; }
    .reviews-summary .rs-val { font-size: 18px; }
  }
  /* ===== US-0118 END ===== */

  /* ===== RESPONSIVE: Tablet portrait (768-1024px) ===== */
  @media (max-width: 1024px) {
    .header { padding: 12px 20px; }
    .header-left .header-title { font-size: 13px; }
    .header-center { font-size: 11px; }
    .header-right .clock .time { font-size: 18px; }
    .container { padding: 16px; }
    .grid { grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-2 { grid-template-columns: 1fr; gap: 16px; }
    .agent-grid { grid-template-columns: repeat(3, 1fr); }
    .epic-stories { grid-template-columns: 1fr 1fr; }
  }

  /* ===== RESPONSIVE: Tablet landscape adjustments ===== */
  @media (max-width: 1024px) and (orientation: landscape) {
    .pipeline { flex-wrap: wrap; }
    .phase-block { flex: 1 1 calc(33.33% - 4px); min-width: 120px; }
    .phase-block::before, .phase-block::after { display: none; }
    .grid { grid-template-columns: 1fr 1fr 1fr; }
    .grid-2 { grid-template-columns: 1fr 1fr; }
  }

  /* ===== RESPONSIVE: Phone landscape (up to 767px landscape) ===== */
  @media (max-width: 767px) and (orientation: landscape) {
    .header { padding: 10px 16px; }
    .header-left .header-title { font-size: 13px; }
    .header-left .header-subtitle { font-size: 10px; }
    .header-right .clock .time { font-size: 18px; }
    .container { padding: 10px; }
    /* US-0115: at narrow widths wrap the 6 phases into two rows of 3 so
       the Departure Mono 32px phase number still reads. */
    .pipeline { flex-wrap: wrap; gap: 4px; padding: 10px 4px 8px; }
    .phase-block { flex: 1 1 calc(33.33% - 4px); min-width: 80px; padding: 4px 6px 8px; }
    .phase-number { font-size: 24px; }
    .phase-name { font-size: 11px; }
    .phase-agents { display: none; }
    .phase-deliverables { display: none; }
    /* 1px connector at wrap boundaries looks broken; hide on phone. */
    .phase-block::before, .phase-block::after { display: none; }
    .grid { grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .grid-2 { grid-template-columns: 1fr 1fr; gap: 10px; }
    .card { padding: 12px; }
    .card h2 { font-size: 12px; margin-bottom: 10px; }
    /* US-0119: scale spotlight + station cards for phone landscape. */
    .agent-spotlight { height: 160px; padding: 12px; gap: 12px; }
    .spotlight-portrait-wrap { flex-basis: 110px; width: 110px; }
    .spotlight-name { font-size: 20px; }
    .spotlight-role { font-size: 10px; }
    .agent-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .agent-card { padding: 10px 6px; gap: 6px; }
    .agent-avatar, .agent-avatar-fallback { width: 56px; height: 56px; font-size: 24px; }
    .agent-name { font-size: 11px; }
    .epic-stories { grid-template-columns: 1fr; }
    .log-scroll { max-height: 150px; }
    .metric-value { font-size: 16px; }
  }

  /* ===== RESPONSIVE: Phone portrait (up to 480px) ===== */
  @media (max-width: 480px) {
    .header { padding: 10px 16px; flex-wrap: wrap; gap: 6px; }
    .header-left .header-title { font-size: 13px; }
    .header-left .header-subtitle { font-size: 10px; }
    .header-center { display: none; }
    .header-right { gap: 8px; }
    .header-right .clock .time { font-size: 18px; }
    .header-right .clock .label { font-size: 9px; }
    .container { padding: 10px; }
    /* US-0115: phone portrait — vertical timeline (row-per-phase), number
       on left, name on right, 1px connectors hidden. */
    .pipeline { flex-direction: column; gap: 6px; padding: 10px 10px; }
    .phase-block { padding: 8px 10px; flex-direction: row; align-items: center; text-align: left; gap: 10px; }
    .phase-block::before, .phase-block::after { display: none; }
    .phase-number { font-size: 20px; margin-bottom: 0; padding: 0; background: transparent; }
    .phase-block .phase-status { position: static; font-size: 16px; }
    .phase-block .phase-name { margin-bottom: 0; font-size: 13px; flex: 1; }
    .phase-block .phase-agents { display: none; }
    .phase-block .phase-deliverables { display: none; }
    .phase-fill-track { position: static; margin-left: auto; width: 40px; flex: 0 0 40px; }
    .grid { grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px; }
    .grid-2 { grid-template-columns: 1fr; gap: 12px; }
    .card { padding: 14px; border-radius: 10px; }
    .card h2 { font-size: 13px; margin-bottom: 12px; }
    /* US-0119: phone portrait — stack spotlight into vertical, smaller stations. */
    .agent-spotlight { height: auto; min-height: 180px; padding: 12px; gap: 12px; flex-direction: column; align-items: center; }
    .spotlight-portrait-wrap { flex-basis: 120px; width: 120px; height: 120px; }
    .spotlight-info { align-items: center; text-align: center; }
    .spotlight-name { font-size: 18px; }
    .spotlight-role { font-size: 10px; }
    .spotlight-task { display: none; }
    .spotlight-elapsed { font-size: 10px; }
    .agent-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .agent-card { padding: 10px 6px; gap: 6px; }
    .agent-avatar, .agent-avatar-fallback { width: 52px; height: 52px; font-size: 22px; }
    .agent-name { font-size: 11px; }
    .agent-role { font-size: 9px; }
    .agent-status { font-size: 9px; padding: 1px 6px; }
    .agent-task { display: none; }
    .story-grid { grid-template-columns: 1fr; gap: 4px; }
    .story-row { padding: 8px 10px; }
    .story-title { font-size: 11px; }
    .metric-value { font-size: 18px; }
    .metric-label { font-size: 12px; }
    .log-scroll { max-height: 180px; }
    .log-entry { font-size: 11px; }
    .footer { font-size: 10px; padding: 12px; }
    .modal { padding: 24px 20px; }
  }

  /* ===== RESPONSIVE: Small phone (up to 375px) ===== */
  @media (max-width: 375px) {
    .header-left .header-title { font-size: 12px; }
    .agent-spotlight { min-height: 160px; }
    .spotlight-portrait-wrap { flex-basis: 96px; width: 96px; height: 96px; }
    .spotlight-name { font-size: 16px; }
    .agent-grid { grid-template-columns: repeat(2, 1fr); }
    .agent-avatar, .agent-avatar-fallback { width: 48px; height: 48px; font-size: 20px; }
    .header-right .clock .time { font-size: 16px; }
    #theme-toggle, .btn-header { font-size: 11px; padding: 4px 10px; }
  }
  /* US-0133: Cycle history cards */
  .cycle-card { flex: 0 0 auto; background: var(--bg-card); border: 1px solid var(--bg-card-border); border-radius: 8px; padding: 8px 12px; min-width: 120px; font-family: var(--font-sans); font-size: 11px; }
  .cycle-card-id { font-family: var(--font-display), monospace; font-size: 18px; font-weight: 700; color: var(--text-primary); }
  .cycle-card-stat { color: var(--text-muted); margin-top: 2px; }
  .cycle-telemetry-tile { background: var(--bg-card); border: 1px solid var(--bg-card-border); border-radius: 8px; padding: 8px 14px; text-align: center; font-family: var(--font-sans); min-width: 100px; }
  .cycle-telemetry-tile .tile-value { font-family: var(--font-display), monospace; font-size: 20px; font-weight: 700; color: var(--text-primary); }
  .cycle-telemetry-tile .tile-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin-top: 2px; }
  /* US-0145: Event log primary column widget */
  .pv-event-log { margin-bottom: 16px; }
  .pv-log-row { display: grid; grid-template-columns: 72px 90px 1fr; gap: 10px; padding: 4px 14px; border-bottom: 1px dashed rgba(255,255,255,0.06); font-size: 12px; }
  .pv-log-row:last-child { border-bottom: 0; }
  .evt-time { color: var(--text-muted); font-family: monospace; }
  .evt-agent { color: var(--text-secondary); font-weight: 600; }
  .evt-msg { color: var(--text-secondary); }
  .evt-start .evt-agent { color: var(--live-accent-ink, oklch(55% 0.18 38)); }
  .evt-done .evt-agent { color: var(--ok, oklch(68% 0.15 150)); }
  .evt-block .evt-agent { color: var(--risk, oklch(64% 0.20 25)); }
  .evt-review .evt-agent { color: var(--info, oklch(66% 0.14 240)); }
  .pv-log-status { font-family: monospace; font-size: 10px; letter-spacing: 0.1em; padding: 2px 6px; border-radius: 4px; background: var(--live-accent, oklch(72% 0.19 38)); color: #1a0f00; margin-left: auto; }
  .card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .card-head h3 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; }
  /* US-0144: Simplified phase fill bar — number/name/group/fill only */
  .pv-phase-fill-bg { height: 4px; background: var(--bg-progress, rgba(255,255,255,0.1)); border-radius: 3px; overflow: hidden; margin-top: auto; }
  .pv-phase-fill { height: 100%; border-radius: 3px; background: var(--ok, oklch(68% 0.15 150)); transition: width 0.3s; }
  /* US-0146: Live bar — ON AIR chip, cycle display, ticker, HH:MM:SS clock */
  .pv-live-bar { display: flex; align-items: center; gap: 14px; padding: 8px 18px; background: linear-gradient(90deg, color-mix(in oklab, var(--live-accent, oklch(72% 0.19 38)) 14%, transparent) 0%, transparent 80%); border-bottom: 1px solid var(--bg-card-border, #2a2a5a); min-height: 48px; border-left: 3px solid var(--live-accent, oklch(72% 0.19 38)); margin-bottom: 0; }
  .pv-on-air { font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; padding: 4px 8px; background: var(--live-accent, oklch(72% 0.19 38)); color: #1a0f00; border-radius: 4px; flex-shrink: 0; }
  .pv-live-cycle { font-family: monospace; font-size: 12.5px; color: var(--text-secondary, #aaa); flex-shrink: 0; }
  .pv-live-ticker { flex: 1; font-family: monospace; font-size: 12px; color: var(--text-secondary, #aaa); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 14px; border-left: 1px solid var(--divider, #2a2a4a); }
  .pv-live-clock { font-family: monospace; font-size: 14px; font-weight: 600; color: var(--text-primary, #e0e0e0); flex-shrink: 0; }
  @media (prefers-reduced-motion: reduce) { .pv-live-ticker { animation: none; } }
</style>
</head>
<body>

<div class="header${anyBlocked ? ' header-blocked' : ''}" id="main-header">
  <div class="header-left">
    <div class="header-title">${esc(DASH_META.title)}</div>
    <div class="header-subtitle">${esc(DASH_META.subtitle)}</div>
  </div>
  <div class="header-center" id="header-phase-label">
    <span class="live-dot ok" aria-label="live" title="live" id="clock-live-dot"></span>
    <span>${esc(phaseLabel)}</span>
  </div>
  <div class="header-right">
    <div class="clock">
      <div class="time">${now}</div>
      <div class="label">Last Updated</div>
      <!-- US-0111 AC-0366: live ticker in JetBrains Mono; refreshState() updates this every tick. -->
      <div id="last-updated-ticker" class="last-updated" aria-live="polite">Last updated: just now</div>
    </div>
    <a href="plan-status.html" class="btn-header" style="text-decoration:none">&#8592; Plan Dashboard</a>
    <button class="btn-header" onclick="document.getElementById('about-modal').classList.add('open')">ℹ️ About</button>
    <button id="notif-btn" class="btn-header" onclick="requestAlerts()">🔔 Alerts</button>
    <button id="theme-toggle" onclick="toggleTheme()">☀️ Light</button>
  </div>
</div>

<!-- US-0122 AC-0417: incident ticker (hidden by default, .active shown beneath header when any agent/phase is blocked). -->
<div id="incident-ticker" class="incident-ticker" aria-live="polite" aria-atomic="true"></div>

<!-- US-0146: Live bar — always visible ON AIR status strip -->
<div class="pv-live-bar" id="pv-live-bar" role="status" aria-live="polite">
  <span class="pv-on-air">ON AIR</span>
  <div class="pv-live-cycle" id="pv-live-cycle">CYCLE — · —:——</div>
  <div class="pv-live-ticker" id="pv-live-ticker" aria-hidden="true"></div>
  <div class="pv-live-clock" id="pv-live-clock">00:00:00</div>
</div>

<div class="container">

${
  pipelineComplete
    ? `<!-- Pipeline Complete Banner -->
<div style="background: linear-gradient(135deg, #1a3a2a 0%, #0d2b1a 100%); border: 1px solid #2d6a4f; border-left: 4px solid #34A853; border-radius: 8px; padding: 14px 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 14px;">
  <span style="font-size: 28px;">🎉</span>
  <div>
    <div style="color: #34A853; font-size: 16px; font-weight: 700; letter-spacing: 0.5px;">PIPELINE COMPLETE — v1.0.0-poc</div>
    <div style="color: #aaa; font-size: 12px; margin-top: 2px;">All ${phases.length} phases complete · ${metrics.storiesCompleted}/${metrics.storiesTotal} stories · ${metrics.testsPassed} tests passing · ${metrics.coveragePercent}% coverage · ${metrics.bugsFixed} bugs fixed</div>
  </div>
</div>`
    : ''
}

<!-- Phase Pipeline — US-0115: 6-phase timeline with cycle counter. -->
<h2 class="section-header">PIPELINE</h2>
<!-- AC-0384: cycle counter above the timeline. The #cycle-elapsed node
     carries data-started-at (ISO8601) and is re-rendered every second by
     updateCycleElapsed() client-side so the HH:MM:SS ticks smoothly. -->
<div class="cycle-counter" id="cycle-counter" aria-live="polite">
  <span class="cycle-label">
    <span class="live-dot ok" aria-label="live" title="live"></span>
    <span id="cycle-label-text">${esc(cycleLabel)}</span>
  </span>
  <span class="cycle-elapsed" id="cycle-elapsed" data-started-at="${esc(cycleStartedAt)}">00:00:00</span>
</div>
<div class="pipeline">
${phases
  .map((p, i) => {
    const phaseNum = String(i + 1).padStart(2, '0');
    const icon =
      p.status === 'complete' ? '✅' : p.status === 'in-progress' ? '🔄' : p.status === 'blocked' ? '⚠️' : '⏳';
    const elapsed = p.status === 'complete' ? formatPhaseElapsed(p.startedAt, p.completedAt) : '';
    const hasElapsed = elapsed ? '1' : '0';
    // AC-0385: the in-progress phase gets the partial-fill width; all
    // other phases render the track with either 0 (pending/blocked) or
    // 100 (complete, via CSS) so patchDOM() only needs to flip the class
    // to transition states.
    const fillWidth = p.status === 'in-progress' ? cycleFillPct : p.status === 'complete' ? 100 : 0;
    const agents = Array.isArray(p.agents) ? p.agents : [];
    const deliverables = Array.isArray(p.deliverables) ? p.deliverables : [];
    // US-0111 AC-0364 + US-0115: stable IDs so refreshState() / patchDOM() can
    // update only the changed phase nodes instead of reloading the page.
    // New helper ids (-check, -elapsed, -fill, -num) support the timeline
    // footer/fill elements added here.
    return `  <div class="phase-block ${p.status}" id="phase-${p.id}" data-phase-status="${p.status}">
    <div class="phase-beacon" aria-hidden="true"></div>
    <div class="phase-status" id="phase-${p.id}-icon" aria-hidden="true">${icon}</div>
    <div class="phase-number" id="phase-${p.id}-num">${phaseNum}</div>
    <div class="phase-name">${p.name}</div>
    <div class="phase-agents">${agents.join(' \u00B7 ')}</div>
    <div class="phase-deliverables">${deliverables.join(' \u00B7 ')}</div>
    <div class="phase-elapsed" id="phase-${p.id}-elapsed" data-has-elapsed="${hasElapsed}"><span class="phase-check" id="phase-${p.id}-check" aria-label="complete">\u2713</span>${esc(elapsed)}</div>
    <div class="phase-fill-track"><div class="phase-fill-bar pv-phase-fill" id="phase-${p.id}-fill" style="width: ${fillWidth}%"></div></div>
  </div>`;
  })
  .join('\n')}
</div>

<!-- US-0130: Epic progress strip — rendered by patchDOM on each tick -->
<div id="epic-strip" style="display:none; margin-bottom:16px; background:var(--bg-card); border:1px solid var(--bg-card-border); border-radius:10px; padding:10px 16px; font-family:var(--font-sans); font-size:12px;">
  <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-dim); margin-bottom:8px;">Epic Progress</div>
  <div id="epic-strip-rows"></div>
</div>

<!-- US-0133: Cycle history — lap strip + telemetry -->
<div id="cycle-history-section" style="display:none; margin-bottom:24px;">
  <div style="font-family:var(--font-display),monospace; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-dim); margin-bottom:8px;">Cycle History</div>
  <div id="cycle-telemetry" style="display:flex; gap:16px; margin-bottom:10px; flex-wrap:wrap;"></div>
  <div id="cycle-lap-strip" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;"></div>
</div>

<!-- Metrics Row — US-0118 differentiated cards.
     AC-0399: semantic color keyed to state: Phase=blue, Quality=green/amber/red
     by coverage threshold, Reviews=green(approve)/red(block).
     Metric IDs (id="metric-*") are preserved so patchDOM() from US-0111 can
     mutate values in-place on live refresh. -->
<h2 class="section-header">TELEMETRY</h2>
<div class="grid">

  <!-- AC-0396: Phase Progress card — hero number in Departure Mono 56px +
       sparkline below (one bar per phase, height keyed to status). -->
  <div class="card metric-card" id="card-phase-progress">
    <h2>Phase Progress</h2>
    <div class="metric-sub">Phases Complete</div>
    <div class="metric-hero blue" id="metric-phaseHero"><span id="metric-phasesCompleteNum">${phases.filter((p) => p.status === 'complete').length}</span><span class="hero-sep">/</span><span class="hero-den" id="metric-phasesTotalNum">${phases.length}</span></div>
    <!-- Legacy ids preserved for patchDOM() compatibility. -->
    <span id="metric-phasesComplete" hidden>${phases.filter((p) => p.status === 'complete').length} / ${phases.length}</span>
    <div class="phase-sparkline" id="metric-phasesSparkline" aria-hidden="true">
${phases
  .map(
    (p, i) =>
      `      <div class="spark-bar ${p.status}" data-phase-id="${esc(p.id)}" data-phase-status="${esc(p.status)}" style="height: ${sparkHeights[i]}%" title="${esc(p.name)}: ${esc(p.status)}"></div>`,
  )
  .join('\n')}
    </div>
    <div class="progress-bar"><div class="progress-fill blue" id="metric-phasesBar" style="width: ${phasePercent}%"></div></div>
    <div class="metric-sub" style="margin-top: 14px">Stories Done · <span id="metric-storiesDone">${metrics.storiesCompleted} / ${metrics.storiesTotal}</span> · Tasks <span id="metric-tasksDone">${metrics.tasksTotal > 0 ? `${metrics.tasksCompleted} / ${metrics.tasksTotal}` : '—'}</span></div>
    <div class="progress-bar"><div class="progress-fill green" id="metric-storiesBar" style="width: ${storyPercent}%"></div></div>
    <div class="progress-bar" style="margin-top: 4px"><div class="progress-fill red" id="metric-tasksBar" style="width: ${metrics.tasksTotal > 0 ? Math.round((metrics.tasksCompleted / metrics.tasksTotal) * 100) : 0}%"></div></div>
    <div class="card-footer">
      <span class="stamp">Last updated <b id="stamp-phase-progress">${stampHHMM}</b></span>
    </div>
  </div>

  <!-- AC-0397: Quality card — SVG doughnut (circle + stroke-dasharray) with
       center coverage number. Tint green ≥80%, amber 60–80%, red <60%. -->
  <div class="card metric-card" id="card-quality">
    <h2><span class="live-dot ok" aria-label="live" title="live" id="quality-live-dot"></span>Quality</h2>
    <div class="doughnut-wrap">
      <div class="doughnut" id="metric-coverageDoughnut" data-coverage="${coveragePct}" data-tone="${coverageTone}" role="img" aria-label="Code coverage ${coveragePct}%">
        <svg viewBox="0 0 36 36">
          <circle class="d-track" cx="18" cy="18" r="15.9155"></circle>
          <circle class="d-fill ${coverageTone}" id="metric-coverageDoughnutFill" cx="18" cy="18" r="15.9155"
                  stroke-dasharray="100 100" stroke-dashoffset="${doughnutOffset}"></circle>
        </svg>
        <div class="doughnut-center">
          <div class="d-num ${coverageTone}" id="metric-coveragePercent">${coveragePct}%</div>
          <div class="d-label">Coverage</div>
        </div>
      </div>
    </div>
    <div class="quality-stats">
      <div class="qs-cell">
        <span class="qs-label">Passed</span>
        <span class="qs-val green" id="metric-testsPassed">${metrics.testsPassed}</span>
      </div>
      <div class="qs-cell">
        <span class="qs-label">Failed</span>
        <span class="qs-val ${metrics.testsFailed > 0 ? 'red' : 'muted'}" id="metric-testsFailed">${metrics.testsFailed}</span>
      </div>
      <div class="qs-cell">
        <span class="qs-label">Bugs Open</span>
        <span class="qs-val ${metrics.bugsOpen > 0 ? 'red' : 'green'}" id="metric-bugsOpen">${metrics.bugsOpen}</span>
      </div>
    </div>
    <span id="metric-testsTotal" hidden>${metrics.testsTotal}</span>
    <div class="card-footer">
      <span class="stamp">Last updated <b id="stamp-quality">${stampHHMM}</b></span>
    </div>
  </div>

  <!-- AC-0398: Reviews card — compact list of recent review verdicts from
       status.log, each row with an agent avatar chip (small circular image
       from agents.config.json, path agents/images/optimized/AVATAR-64.png). -->
  <div class="card metric-card" id="card-reviews">
    <h2>Reviews</h2>
    <div class="reviews-summary">
      <div class="rs-cell rs-approved">
        <span class="rs-label">Approved</span>
        <span class="rs-val" id="metric-reviewsApproved">${metrics.reviewsApproved}</span>
      </div>
      <div class="rs-cell rs-blocked">
        <span class="rs-label">Blocked</span>
        <span class="rs-val ${metrics.reviewsBlocked > 0 ? '' : 'zero'}" id="metric-reviewsBlocked">${metrics.reviewsBlocked}</span>
      </div>
    </div>
    <ul class="reviews-list" id="metric-reviewsList">
${
  reviewEntries.length === 0
    ? `      <li class="reviews-empty">No reviews yet — awaiting first verdict.</li>`
    : reviewEntries
        .map((r) => {
          const color = agentColors[r.agent] || '#888';
          const icon = agentIcons[r.agent] || '🔍';
          const avatar = agentAvatars[r.agent] || r.agent.toLowerCase();
          const imgBase = 'agents/images';
          const chipImg = `<img class="review-chip" src="${imgBase}/optimized/${esc(avatar)}-64.png" alt="${esc(r.agent)}" style="border-color: ${color}" onerror="this.onerror=function(){this.outerHTML='<div class=\\'review-chip-fallback\\' style=\\'border-color: ${color}\\'>${icon}</div>'};this.src='${imgBase}/headshots/${esc(r.agent.toLowerCase())}.png'">`;
          return `      <li class="review-item">
        ${chipImg}
        <div class="review-body">
          <div class="review-line">
            <span class="review-agent" style="color: ${color}">${esc(r.agent)}</span>
            <span class="review-target">${esc(r.target)}</span>
          </div>
          <div class="review-time">${esc(r.time)}</div>
        </div>
        <span class="review-verdict ${r.verdict}">${r.verdict === 'approve' ? 'Approve' : 'Block'}</span>
      </li>`;
        })
        .join('\n')
}
    </ul>
    <span id="metric-bugsFixed" hidden>${metrics.bugsFixed}</span>
    <div class="card-footer">
      <span class="stamp">Last updated <b id="stamp-reviews">${stampHHMM}</b></span>
    </div>
  </div>
</div>

<!-- Agents + Stories -->
<div class="grid-2">
  <div class="card">
    <h2 class="section-header">ACTIVE AGENT</h2>
${(() => {
  const roles = agentRoles;
  const imgBase = 'agents/images';
  // US-0119 AC-0401: Spotlight banner — broadcast stage for the current on-air
  // agent. Prefer non-Conductor active agent (BUG-0079). Uses the 160px
  // optimized portrait from US-0113's config, Geist 28px name, small-caps
  // role, JetBrains Mono task line, and an elapsed-time ticker seeded from
  // agent.startedAt (ISO 8601) when available — the client-side ticker in
  // the main <script> block re-renders the elapsed text every second.
  const dmAgentName = (AGENT_CONFIG.orchestrator || {}).dmAgent || 'Conductor';
  const activeAgent =
    Object.entries(agents).find(([name, a]) => a.status === 'active' && name !== dmAgentName) ||
    Object.entries(agents).find(([, a]) => a.status === 'active');
  let spotlight;
  if (activeAgent) {
    const [aName, aData] = activeAgent;
    const aColor = agentColors[aName] || '#888';
    const aAvatar = agentAvatars[aName] || aName.toLowerCase();
    const startedAt = aData.startedAt || '';
    const fullPortrait = `${imgBase}/optimized/${aAvatar}-320.png`;
    spotlight = `    <div class="agent-spotlight" id="agent-spotlight" data-agent-name="${esc(aName)}" data-started-at="${esc(startedAt)}">
      <div class="spotlight-portrait-wrap" style="border-color: ${aColor}"
        onmouseenter="showAgentPortrait(this,'${fullPortrait}')" onmouseleave="hideAgentPortrait()">
        <img class="spotlight-img" src="${imgBase}/optimized/${aAvatar}-160.png" alt="${esc(aName)}" onerror="this.onerror=null; this.src='${imgBase}/headshots/${esc(aName.toLowerCase())}.png'">
      </div>
      <div class="spotlight-info">
        <div class="spotlight-name" id="agent-spotlight-name" style="color: ${aColor}"><span class="live-dot ok" aria-label="live" title="live" id="spotlight-live-dot"></span>${esc(aName)}</div>
        <div class="spotlight-role" id="agent-spotlight-role">${esc(roles[aName] || aName)}</div>
        <div class="spotlight-task" id="agent-spotlight-task">${esc(aData.currentTask || 'Awaiting assignment')}</div>
        <div class="spotlight-elapsed" id="agent-spotlight-elapsed" data-started-at="${esc(startedAt)}">${startedAt ? '—' : 'IDLE'}</div>
      </div>
    </div>`;
  } else {
    spotlight = `    <div class="agent-spotlight no-active" id="agent-spotlight">
      <div class="spotlight-waiting">Waiting for ${(AGENT_CONFIG.orchestrator || {}).dmAgent || 'orchestrator'} to activate agents...</div>
    </div>`;
  }
  return spotlight;
})()}
    <div class="agent-grid">
${Object.entries(agents)
  .map(([name, agent]) => {
    const color = agentColors[name] || '#888';
    const icon = agentIcons[name] || '🤖';
    const imgBase = 'agents/images';
    const statusBg = agent.status === 'active' ? 'rgba(52,168,83,0.2)' : 'rgba(136,136,136,0.15)';
    const statusColor = agent.status === 'active' ? '#34A853' : agent.status === 'complete' ? '#1565C0' : '#888';
    const roles = agentRoles;
    // US-0119 AC-0402: vertical layout — 80x80 circle portrait with 2px
    // agent-color ring on top, then name, role micro-copy, status pill.
    // Active station (AC-0403) gets .active class → 3px agent-color glow
    // box-shadow + pulsing green "now on air" live-dot. Idle stations
    // (AC-0404) get .idle class → opacity 0.5. Hover (AC-0405) applies a
    // 4px agent-color outline glow via --agent-color-ring CSS variable,
    // replacing the previous filter:brightness(1.12) which was invisible
    // in light mode (BUG-0161).
    const avatar = agentAvatars[name] || name.toLowerCase();
    const avatarImg = `<img class="agent-avatar" src="${imgBase}/optimized/${avatar}-64.png" alt="${esc(name)}" onerror="this.onerror=function(){this.outerHTML='<div class=\\'agent-avatar-fallback\\'>${icon}</div>'};this.src='${imgBase}/headshots/${esc(name.toLowerCase())}.png'">`;
    const fullPortrait = `${imgBase}/optimized/${avatar}-320.png`;
    const isActive = agent.status === 'active';
    const isIdle =
      !isActive && agent.status !== 'complete' && agent.status !== 'blocked' && agent.status !== 'needs-review';
    // US-0142: status-specific CSS classes for visual prominence
    const statusCls =
      agent.status === 'active'
        ? 'is-active'
        : agent.status === 'blocked'
          ? 'is-blocked'
          : agent.status === 'needs-review'
            ? 'is-review'
            : 'is-idle';
    const stationClasses = ['agent-card', statusCls];
    if (isActive) stationClasses.push('active');
    if (isIdle) stationClasses.push('idle');
    // --agent-color drives the 3px active glow; --agent-color-ring is the
    // translucent variant used for the 4px hover outline (AC-0405).
    const styleVars = `--agent-color: ${color}; --agent-color-ring: ${color}40;`;
    // US-0142: accent rail (only when active) and pulsing dot class
    const rail = isActive ? '<div class="agent-rail"></div>' : '';
    const dotCls = isActive ? 'dot-pulse' : '';
    // US-0111 AC-0364: keep stable IDs on card + inner pills so patchDOM()
    // can update status/task text without re-rendering the whole grid.
    return `      <div class="${stationClasses.join(' ')}" id="agent-${esc(name)}" data-agent-name="${esc(name)}" data-agent-status="${esc(agent.status)}" style="${styleVars}"
        onmouseenter="showAgentPortrait(this,'${fullPortrait}')" onmouseleave="hideAgentPortrait()">
        ${rail}<span class="live-dot ok on-air-dot${dotCls ? ' ' + dotCls : ''}" aria-label="now on air" title="now on air"></span>
        ${avatarImg}
        <div class="agent-info">
          <div class="agent-name" style="color: ${color}">${esc(name)}</div>
          <div class="agent-role">${esc(roles[name] || name)}</div>
          <div class="agent-status" id="agent-${esc(name)}-status" style="background: ${statusBg}; color: ${statusColor}">${esc(agent.status)}</div>
          <div class="agent-task" id="agent-${esc(name)}-task"${agent.currentTask ? '' : ' style="display:none"'}>${esc(agent.currentTask || '')}</div>
        </div>
      </div>`;
  })
  .join('\n')}
    </div>
  </div>

  <div class="card">
    <h2>User Stories</h2>
    <div class="story-list">
${(() => {
  const epics = status.epics || {};
  // Group stories by epic
  const groups = {};
  Object.entries(stories).forEach(([id, story]) => {
    const epicId = story.epic || 'OTHER';
    if (!groups[epicId]) groups[epicId] = [];
    groups[epicId].push({ id, ...story });
  });
  return Object.entries(groups)
    .map(([epicId, epicStories]) => {
      const epicName = epicTitles[epicId] || epics[epicId] || '';
      const nowMs = Date.now();
      const storyRows = epicStories
        .map((s) => {
          const statusClass = s.status === 'In Progress' ? 'InProgress' : s.status;
          // US-0120 AC-0407: map the story status to a status-strip modifier.
          // Anything that isn't Complete/Done or In Progress falls through to
          // "planned" so ToDo, Planned, Backlog, and unknown values all share
          // the muted slate strip.
          const isComplete = s.status === 'Complete' || s.status === 'Done';
          const isInProgress = s.status === 'In Progress';
          const stripClass = isComplete ? 'status-complete' : isInProgress ? 'status-inprogress' : 'status-planned';
          const title = storyTitles[s.id] || s.title || '';
          // US-0120 AC-0410: agent color-dot + initial next to the title.
          // Only render when assignedAgent resolves to a known agent colour so
          // legacy rows (assignedAgent: null, or a name we don't track) stay
          // unchanged and patchDOM-friendly.
          const agentName = s.assignedAgent || '';
          const agentColor = agentName ? agentColors[agentName] : null;
          const agentInitial = agentName ? agentName.charAt(0).toUpperCase() : '';
          const agentChip =
            agentName && agentColor
              ? `<span class="story-agent" title="${esc(agentName)}"><span class="story-agent-dot" style="background:${agentColor}"></span><span class="story-agent-initial">${esc(agentInitial)}</span></span>`
              : '';
          // US-0120 AC-0408: elapsed-time pill for In Progress stories that
          // carry a startedAt timestamp. Skipped silently otherwise.
          const elapsed = isInProgress ? formatElapsed(s.startedAt, nowMs) : null;
          const elapsedPill = elapsed
            ? `<span class="story-elapsed" title="elapsed since startedAt">${esc(elapsed)}</span>`
            : '';
          return `        <div class="story-row ${stripClass}">
          <span class="story-id">${s.id}</span>
          <span class="story-title"><span class="story-title-text">${esc(title)}</span>${agentChip}</span>
          ${elapsedPill}<span class="story-status ${statusClass}">${s.status}</span>
        </div>`;
        })
        .join('\n');
      const epicStoryStatuses = epicStories.map((s) => s.status);
      const epicDone = epicStoryStatuses.every((s) => s === 'Complete' || s === 'Done');
      const epicInProgress = !epicDone && epicStoryStatuses.some((s) => s === 'In Progress');
      const epicStatus = epicDone ? 'Complete' : epicInProgress ? 'In Progress' : 'Planned';
      const epicStatusColor = epicDone ? '#34A853' : epicInProgress ? '#F57C00' : '#888';
      const epicStatusBg = epicDone
        ? 'rgba(52,168,83,0.15)'
        : epicInProgress
          ? 'rgba(245,124,0,0.15)'
          : 'rgba(136,136,136,0.15)';
      return `      <div class="epic-group${epicDone ? ' collapsed' : ''}">
        <div class="epic-header" onclick="this.closest('.epic-group').classList.toggle('collapsed')">
          <span class="epic-id">${epicId}</span>${epicName ? ' ' + esc(epicName) : ''}
          <span style="margin-left:8px; font-size:10px; padding:2px 8px; border-radius:10px; background:${epicStatusBg}; color:${epicStatusColor}; font-weight:600;">${epicStatus}</span>
          <span class="epic-toggle">▼</span>
        </div>
        <div class="epic-stories">
${storyRows}
        </div>
      </div>`;
    })
    .join('\n');
})()}
    </div>
  </div>
</div>

<!-- US-0145: Event Log — primary column widget with monospace rows, auto-scroll, pause-on-hover -->
<div class="card pv-event-log" id="pv-event-log">
  <div class="card-head">
    <h3>Event Log</h3>
    <span class="pv-log-status" id="pv-log-status">LIVE</span>
  </div>
  <div class="pv-log-body" id="pv-log-body" style="max-height:360px;overflow:auto;font-family:var(--font-sans);font-size:12px;line-height:1.55;"></div>
</div>

<!-- Activity Log — US-0121 terminal aesthetic -->
<div class="card" style="margin-top: 24px">
  <h2><span class="live-dot ok" aria-label="live" title="live" id="activity-live-dot"></span>Activity Log</h2>
  <!-- US-0121 AC-0413/AC-0414: filter chips + tail-mode toggle. Chip clicks
       toggle filtering via data-log-filter; tail-mode persists to
       localStorage('dashboard-tail-mode'). -->
  <div class="log-toolbar" role="toolbar" aria-label="Activity log controls">
    <div class="log-filters" role="group" aria-label="Filter log entries">
      <button class="log-filter-chip active" data-log-filter="all" aria-pressed="true">All</button>
      <button class="log-filter-chip" data-log-filter="errors" aria-pressed="false">Errors</button>
      <button class="log-filter-chip" data-log-filter="reviews" aria-pressed="false">Reviews</button>
      <button class="log-filter-chip" data-log-filter="tests" aria-pressed="false">Tests</button>
      <button class="log-filter-chip" data-log-filter="bugs" aria-pressed="false">Bugs</button>
    </div>
    <label class="log-tail-toggle on" id="log-tail-toggle">
      <input type="checkbox" id="log-tail-checkbox" checked>
      <span class="tail-dot" aria-hidden="true"></span>
      <span>Tail mode</span>
    </label>
  </div>
  <div class="log-scroll" id="log-scroll" data-active-filter="all">
${
  log.length > 0
    ? log
        .slice(-20)
        .reverse()
        .map((entry) => {
          const agentColor = agentColors[entry.agent] || '#888';
          // US-0111 AC-0364: data-log-key lets patchDOM() dedupe and prepend only new entries.
          const key = `${entry.time || ''}|${entry.agent || ''}|${entry.message || ''}`;
          const category = logCategory(entry.message);
          const agentToken = entry.agent || 'System';
          const timeFormatted = formatLogTime(entry.time);
          return (
            `    <div class="log-entry" data-log-key="${esc(key)}" data-category="${category}" style="border-left-color: ${agentColor}">` +
            `<span class="log-time" data-log-time="${esc(entry.time || '')}">[${esc(timeFormatted)}]</span>` +
            `<span class="log-agent" style="color: ${agentColor}">[${esc(agentToken)}]</span>` +
            `<span class="log-msg">${esc(entry.message || '')}</span>` +
            `</div>`
          );
        })
        .join('\n')
    : `    <div class="log-empty" id="log-empty"><span class="log-cursor" aria-hidden="true"></span><span>Awaiting agent activity&hellip;</span></div>`
}
  </div>
</div>

</div>

<!-- About Modal — US-0123: two-column (playbill image | mission + roster + meta).
     Parity target: plan-status.html About modal (US-0109). -->
<div id="about-modal" class="modal-overlay" onclick="if(event.target===this)this.classList.remove('open')">
  <div class="modal">
    <button class="modal-close" onclick="document.getElementById('about-modal').classList.remove('open')">&times;</button>
    <div class="about-layout">
      <!-- AC-0421: left column — playbill-framed team image -->
      <div class="about-playbill">
        <img src="agents/images/team.png" alt="Agent team" onerror="this.style.display='none'">
      </div>
      <!-- AC-0422: right column — mission, roster, links, version info -->
      <div class="about-right">
        <h3>${esc(DASH_META.title)}</h3>
        <p>${esc(DASH_META.subtitle)}</p>
        <p class="about-mission">
          An agentic SDLC mission-control dashboard. Nine role-specialised AI
          agents plan, build, review, and ship software across a six-phase
          pipeline — Blueprint, Architect, Build, Integration, Test, Polish —
          while this view surfaces live progress, blockers, and telemetry.
        </p>
        ${DASH_META.repoUrl ? `<a class="repo-link" href="${esc(DASH_META.repoUrl)}" target="_blank" rel="noopener">View on GitHub</a>` : ''}
        <div class="about-roster-title">Agent Roster</div>
        <ul class="about-roster">
          ${Object.entries(AGENT_CONFIG.agents || {})
            .map(([name, cfg]) => {
              const avatar = cfg.avatar || name.toLowerCase();
              const icon = cfg.icon || '🤖';
              return `<li>
            <img src="agents/images/optimized/${esc(avatar)}-64.png" alt="${esc(name)}" onerror="this.outerHTML='&lt;span class=&quot;about-roster-fallback&quot;&gt;${esc(icon)}&lt;/span&gt;'">
            <span class="about-roster-text">
              <span class="about-roster-name">${esc(name)}</span>
              <span class="about-roster-role">${esc(cfg.role || '')}</span>
            </span>
          </li>`;
            })
            .join('')}
        </ul>
        <div class="about-links-title">Links</div>
        <div class="about-links">
          ${DASH_META.repoUrl ? `<div class="about-links-row"><span class="meta-label">Repo:</span> <a href="${esc(DASH_META.repoUrl)}" target="_blank" rel="noopener">${esc(DASH_META.repoUrl)}</a></div>` : ''}
          <div class="about-links-row"><span class="meta-label">Dashboard:</span> <a href="dashboard.html">dashboard.html</a></div>
          <div class="about-links-row"><span class="meta-label">Plan:</span> <a href="plan-status.html">plan-status.html</a></div>
        </div>
        <div class="meta-divider">
          <div class="meta-section">
            <div class="meta-supertitle">This Project</div>
            <div class="meta-row"><span class="meta-label">Name:</span> <span class="meta-value">${esc(PROJECT_PKG.name)}</span></div>
            <div class="meta-row"><span class="meta-label">Version:</span> <span class="meta-value">v${esc(PROJECT_PKG.version)}</span></div>
            <div class="meta-row"><span class="meta-label">Branch:</span> <span class="meta-value">${esc(GIT_BRANCH)}</span></div>
            <div class="meta-row"><span class="meta-label">Build:</span> <span class="meta-value">#${esc(BUILD_NUMBER)} ${esc(COMMIT_SHA)}</span></div>
          </div>
          <div class="meta-section">
            <div class="meta-supertitle">Dashboard Tool</div>
            <div class="meta-row"><span class="meta-label">View:</span> <span class="meta-value">Agentic SDLC Dashboard</span></div>
            <div class="meta-row"><span class="meta-label">Generated by:</span> <span class="meta-value">${esc(TOOL_PKG.name)} v${esc(TOOL_PKG.version)}</span></div>
            <div class="meta-row"><span class="meta-label">Generated at:</span> <span class="meta-value">${esc(now)}</span></div>
          </div>
          ${DASH_META.author ? `<div class="meta-attribution">Implemented by ${esc(DASH_META.author)}${DASH_META.authorTitle ? ', ' + esc(DASH_META.authorTitle) : ''}</div>` : ''}
        </div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  ${DASH_META.footer} | Last refreshed: ${now}
</div>

<script>
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('dashboard-theme', next);
  updateToggleButton(next);
}
function updateToggleButton(theme) {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
}
(function() {
  var saved = localStorage.getItem('dashboard-theme') || 'dark';
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
  updateToggleButton(saved);
})();
// Shared client-side helpers used by patchDOM() and related rendering code.
// escH: HTML-escape a value before inserting into innerHTML (prevents XSS).
function escH(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// US-0143: Conductor dispatch hold — keeps Conductor card in is-active state
// for conductorHoldMs ms after each dispatch, then reverts to is-idle.
var conductorHoldMs = 3000;
var _conductorHoldTimer = null;

function appendEventLog(entry) {
  var body = document.getElementById('pv-log-body');
  if (!body) return;
  var tag = entry.tag || 'start';
  var tone = tag === 'done' ? 'evt-done' : tag === 'block' ? 'evt-block' : tag === 'review' ? 'evt-review' : 'evt-start';
  var row = document.createElement('div');
  row.className = 'pv-log-row ' + tone;
  row.innerHTML = '<span class="evt-time">' + escH(entry.t || '') + '</span>' +
    '<span class="evt-agent">' + escH(entry.a || '') + '</span>' +
    '<span class="evt-msg">' + escH(entry.m || '') + '</span>';
  body.insertBefore(row, body.firstChild);
  if (!body.dataset.paused) body.scrollTop = 0;
}

// US-0145: pause event log scroll on hover so user can read entries
(function () {
  // Runs after DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    var lb = document.getElementById('pv-log-body');
    if (!lb) return;
    lb.addEventListener('mouseenter', function () {
      this.dataset.paused = '1';
    });
    lb.addEventListener('mouseleave', function () {
      delete this.dataset.paused;
    });
  });
})();

function setConductorActive(dispatchMsg) {
  var card = document.querySelector('[data-agent="Conductor"]');
  if (card) {
    card.classList.add('is-active');
    card.classList.remove('is-idle');
  }
  appendEventLog({ t: new Date().toLocaleTimeString(), a: 'Conductor', m: dispatchMsg || 'Dispatched task', tag: 'dispatch' });
  clearTimeout(_conductorHoldTimer);
  _conductorHoldTimer = setTimeout(function () {
    if (card) {
      card.classList.remove('is-active');
      card.classList.add('is-idle');
    }
  }, conductorHoldMs);
}

// US-0121 helpers: _formatLogTime formats ISO timestamps as HH:MM:SS;
// _logCategory classifies log entries for colour coding.
function _formatLogTime(raw) {
  var t = String(raw || '').trim();
  if (!t) return '--:--:--';
  // ISO format (contains 'T'): parse as Date and extract HH:MM:SS
  if (t.indexOf('T') !== -1) {
    var d = new Date(t);
    if (!isNaN(d)) {
      var h = ('00' + d.getHours()).slice(-2);
      var m = ('00' + d.getMinutes()).slice(-2);
      var s = ('00' + d.getSeconds()).slice(-2);
      return h + ':' + m + ':' + s;
    }
  }
  var parts = t.split(':');
  if (parts.length < 2) return t;
  var h = ('00' + parts[0]).slice(-2);
  var m = ('00' + (parts[1] || '00')).slice(-2);
  var s = ('00' + (parts[2] || '00')).slice(-2);
  return h + ':' + m + ':' + s;
}
function _logCategory(message) {
  var m = String(message || '').toLowerCase();
  if (m.indexOf('error') !== -1) return 'errors';
  if (m.indexOf('review') !== -1) return 'reviews';
  if (m.indexOf('test') !== -1) return 'tests';
  if (m.indexOf('bug') !== -1) return 'bugs';
  return 'other';
}

// US-0121 AC-0414: Tail mode — scroll newest entries into view. Newest is
// at the top in this log (server renders .slice(-20).reverse()), so tailing
// means scrollTop = 0. Persisted in localStorage.
function _isTailModeOn() {
  var v = localStorage.getItem('dashboard-tail-mode');
  // Default ON when unset.
  return v === null || v === 'true';
}
function _applyTailIfOn() {
  if (!_isTailModeOn()) return;
  var scroll = document.getElementById('log-scroll');
  if (scroll) scroll.scrollTop = 0;
}

// US-0121 AC-0413: Apply the currently-selected filter chip. Rows are shown
// when data-category === active filter, or when filter === 'all'.
function _applyLogFilter(filter) {
  var scroll = document.getElementById('log-scroll');
  if (!scroll) return;
  scroll.setAttribute('data-active-filter', filter);
  var rows = scroll.querySelectorAll('.log-entry');
  for (var i = 0; i < rows.length; i++) {
    var cat = rows[i].getAttribute('data-category') || 'other';
    if (filter === 'all' || cat === filter) rows[i].classList.remove('log-hidden');
    else rows[i].classList.add('log-hidden');
  }
}

// Initialize filter chips + tail-mode toggle once the DOM is parsed.
(function() {
  function init() {
    var chips = document.querySelectorAll('.log-filter-chip');
    chips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        var filter = chip.getAttribute('data-log-filter') || 'all';
        chips.forEach(function(c) {
          var on = c === chip;
          c.classList.toggle('active', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        _applyLogFilter(filter);
      });
    });

    var tailOn = _isTailModeOn();
    var toggleWrap = document.getElementById('log-tail-toggle');
    var toggleBox = document.getElementById('log-tail-checkbox');
    if (toggleWrap) toggleWrap.classList.toggle('on', tailOn);
    if (toggleBox) {
      toggleBox.checked = tailOn;
      toggleBox.addEventListener('change', function() {
        var on = !!toggleBox.checked;
        localStorage.setItem('dashboard-tail-mode', on ? 'true' : 'false');
        if (toggleWrap) toggleWrap.classList.toggle('on', on);
        if (on) _applyTailIfOn();
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ── Dashboard Alert System ────────────────────────────────────────────────────
// Detects state changes across page refreshes using localStorage, then plays
// a Web Audio tone and fires a browser Notification when attention is needed.
var DASH_SNAPSHOT = ${JSON.stringify({
    currentPhase: status.currentPhase,
    bugsOpen: metrics.bugsOpen,
    agentStatuses: Object.fromEntries(Object.entries(agents).map(([k, v]) => [k, v.status])),
    phaseStatuses: phases.map((p) => ({ id: p.id, status: p.status })),
    pipelineComplete: phasesComplete === phases.length && phases.length > 0,
  })};

// US-0111: expose agent colors to the client so patchDOM() can restyle
// agent-status pills when an agent transitions between idle/active/blocked
// without the server-side renderer being involved.
var DASH_AGENT_COLORS = ${JSON.stringify(agentColors)};

// US-0122 AC-0419 / BUG-0160: Singleton AudioContext. Previously, every
// playBeep() call instantiated a new AudioContext, leaking a context on each
// invocation — over many BLOCKED transitions this accumulated dozens of
// orphaned contexts. getAudioContext() lazily constructs a single module-level
// context on first use, then reuses it for all subsequent beeps. If the
// browser suspended the context due to its autoplay policy, we call resume()
// on demand (any beep triggered by an alert state change implies a user-
// initiated path they opted into).
var _audioCtx = null;
function getAudioContext() {
  if (!_audioCtx) {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      _audioCtx = new Ctor();
    } catch (e) {
      return null;
    }
  }
  return _audioCtx;
}

function playBeep(frequency, duration, type) {
  try {
    var ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume(); }
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type || 'sine';
    osc.frequency.value = frequency || 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (duration || 0.5));
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (duration || 0.5));
  } catch(e) {}
}

function sendNotification(title, body) {
  if (localStorage.getItem('dashboard-alerts-enabled') !== 'true') return;
  if (Notification && Notification.permission === 'granted') {
    new Notification(title, { body: body, icon: '' });
  }
}

function _updateAlertBtn(enabled) {
  var btn = document.getElementById('notif-btn');
  if (!btn) return;
  if (enabled) {
    btn.textContent = '🔔 On';
    btn.style.background = 'rgba(52,168,83,0.25)';
  } else {
    btn.textContent = '🔕 Off';
    btn.style.background = '';
  }
}

function requestAlerts() {
  if (!('Notification' in window)) {
    alert('Browser notifications not supported.');
    return;
  }
  var currentlyEnabled = localStorage.getItem('dashboard-alerts-enabled') === 'true';
  var perm = Notification.permission;

  // If already enabled → turn off
  if (currentlyEnabled) {
    localStorage.setItem('dashboard-alerts-enabled', 'false');
    _updateAlertBtn(false);
    return;
  }

  // If permission denied by browser → inform user
  if (perm === 'denied') {
    alert('Notifications are blocked by your browser. Enable them in browser settings, then try again.');
    return;
  }

  // Request permission if needed, then enable
  function enable() {
    localStorage.setItem('dashboard-alerts-enabled', 'true');
    _updateAlertBtn(true);
    playBeep(660, 0.2);
    setTimeout(function() { playBeep(880, 0.3); }, 220);
  }

  if (perm === 'granted') {
    enable();
  } else {
    Notification.requestPermission().then(function(p) {
      if (p === 'granted') { enable(); }
      else { alert('Notification permission denied.'); }
    });
  }
}

// US-0111 AC-0363: the alert-delta logic was previously an IIFE that ran once
// at page load, reading DASH_SNAPSHOT from its closure. It is now a named
// function callable on every refreshState() tick with the latest fetched
// status, so notifications and audio cues continue to fire on live state
// transitions — not only the first render.
//
// Input shape matches the DASH_SNAPSHOT structure produced at generate time:
//   { currentPhase, bugsOpen, agentStatuses, phaseStatuses, pipelineComplete }
// We derive it here from the raw sdlc-status.json on each tick so the function
// is self-contained and callers can pass the untransformed fetch result.
function buildSnapshotFromStatus(status) {
  var phases = (status && status.phases) || [];
  var agents = (status && status.agents) || {};
  var metrics = (status && status.metrics) || {};
  var complete = phases.filter(function(p) { return p.status === 'complete'; }).length;
  var agentStatuses = {};
  Object.keys(agents).forEach(function(k) { agentStatuses[k] = (agents[k] || {}).status; });
  return {
    currentPhase: status && status.currentPhase,
    bugsOpen: typeof metrics.bugsOpen === 'number' ? metrics.bugsOpen : null,
    agentStatuses: agentStatuses,
    phaseStatuses: phases.map(function(p) { return { id: p.id, status: p.status }; }),
    pipelineComplete: phases.length > 0 && complete === phases.length,
  };
}

// US-0122 AC-0416/AC-0417: derive "is anything blocked right now?" from
// either a raw sdlc-status.json object (agents keyed by name, phases array)
// or a pre-built snapshot (agentStatuses / phaseStatuses maps). Returns
// { blocked: bool, agent: string|null, story: string|null } so the ticker
// can render "INCIDENT HH:MM:SS · <agent> blocked on <story>" with correct
// first-blocked-wins selection. When multiple agents/phases are blocked we
// report the FIRST one encountered (chosen for simplicity over rotation —
// DM agent briefing called this out explicitly). Falls back through agent
// currentStory → currentTask → 'unknown' per AC-0417.
function _findFirstBlocked(status) {
  if (!status) return { blocked: false, agent: null, story: null };
  var agents = status.agents || null;
  var agentStatuses = status.agentStatuses || null;
  var phases = status.phases || null;
  var phaseStatuses = status.phaseStatuses || null;

  if (agents && typeof agents === 'object') {
    var names = Object.keys(agents);
    for (var i = 0; i < names.length; i++) {
      var a = agents[names[i]] || {};
      if (a.status === 'blocked') {
        return {
          blocked: true,
          agent: names[i],
          story: a.currentStory || a.currentTask || 'unknown',
        };
      }
    }
  } else if (agentStatuses && typeof agentStatuses === 'object') {
    var keys = Object.keys(agentStatuses);
    for (var j = 0; j < keys.length; j++) {
      if (agentStatuses[keys[j]] === 'blocked') {
        return { blocked: true, agent: keys[j], story: 'unknown' };
      }
    }
  }

  if (phases && phases.length) {
    for (var k = 0; k < phases.length; k++) {
      if (phases[k] && phases[k].status === 'blocked') {
        return { blocked: true, agent: phases[k].id || 'phase', story: 'unknown' };
      }
    }
  } else if (phaseStatuses && phaseStatuses.length) {
    for (var m = 0; m < phaseStatuses.length; m++) {
      if (phaseStatuses[m] && phaseStatuses[m].status === 'blocked') {
        return { blocked: true, agent: phaseStatuses[m].id || 'phase', story: 'unknown' };
      }
    }
  }

  return { blocked: false, agent: null, story: null };
}

function _pad2(n) { return n < 10 ? '0' + n : String(n); }

function _applyBlockedUI(info) {
  var border = document.getElementById('blocked-border');
  var ticker = document.getElementById('incident-ticker');
  if (info.blocked) {
    if (border) border.classList.add('active');
    if (ticker) {
      var d = new Date();
      var hhmmss = _pad2(d.getHours()) + ':' + _pad2(d.getMinutes()) + ':' + _pad2(d.getSeconds());
      ticker.textContent = 'INCIDENT ' + hhmmss + ' · ' + info.agent + ' blocked on ' + info.story;
      ticker.classList.add('active');
    }
  } else {
    if (border) border.classList.remove('active');
    if (ticker) ticker.classList.remove('active');
  }
}

function runAlertCheck(status) {
  // US-0122 AC-0416/AC-0417: toggle the BLOCKED overlay + incident ticker on
  // every tick, independent of the delta-alert path below. This runs first
  // so the UI reflects current state even when no transition fired audio.
  _applyBlockedUI(_findFirstBlocked(status));

  var prevRaw = localStorage.getItem('dashboard-prev-snapshot');
  // Accept either a pre-built snapshot (initial DASH_SNAPSHOT) or a raw
  // sdlc-status.json object from refreshState().
  var curr = (status && (status.phaseStatuses || status.agentStatuses))
    ? status
    : buildSnapshotFromStatus(status);

  // Always save current as baseline for next refresh.
  try {
    localStorage.setItem('dashboard-prev-snapshot', JSON.stringify(curr));
  } catch (e) {
    // localStorage can be unavailable (Safari private mode, quota) — log
    // but do not break the tick; alerts simply reset on the next load.
    console.warn('[runAlertCheck] localStorage write failed', { t: new Date().toISOString(), err: String(e) });
  }

  if (!prevRaw) return; // first visit — no comparison yet
  var prev;
  try { prev = JSON.parse(prevRaw); } catch(e) { return; }

  var alerts = [];

  // Phase completion (a phase just became complete)
  if (curr.phaseStatuses && prev.phaseStatuses) {
    curr.phaseStatuses.forEach(function(p) {
      var old = prev.phaseStatuses.find(function(x) { return x.id === p.id; });
      if (old && old.status !== 'complete' && p.status === 'complete') {
        alerts.push({ title: 'Phase ' + p.id + ' Complete', body: 'Phase ' + p.id + ' just finished — ready for your review.', urgent: false });
      }
    });
  }

  // Agent blocked or needs review
  if (curr.agentStatuses && prev.agentStatuses) {
    Object.keys(curr.agentStatuses).forEach(function(agent) {
      var newStatus = curr.agentStatuses[agent];
      var oldStatus = prev.agentStatuses[agent];
      if (oldStatus !== newStatus && (newStatus === 'blocked' || newStatus === 'needs-review')) {
        alerts.push({ title: agent + ' Needs Attention', body: agent + ' status changed to: ' + newStatus, urgent: true });
      }
    });
  }

  // Pipeline just completed
  if (!prev.pipelineComplete && curr.pipelineComplete) {
    alerts.push({ title: 'Pipeline Complete!', body: 'All phases done — pipeline finished. Return to terminal.', urgent: false });
  }

  // New bugs opened
  if (typeof prev.bugsOpen === 'number' && typeof curr.bugsOpen === 'number' && curr.bugsOpen > prev.bugsOpen) {
    var delta = curr.bugsOpen - prev.bugsOpen;
    alerts.push({ title: delta + ' New Bug' + (delta > 1 ? 's' : '') + ' Opened', body: 'Bugs open: ' + curr.bugsOpen + '. Your attention may be needed.', urgent: false });
  }

  if (alerts.length === 0) return;

  var hasUrgent = alerts.some(function(a) { return a.urgent; });

  // Play audio: urgent = two-tone alarm, normal = single ding
  if (hasUrgent) {
    playBeep(440, 0.25, 'square');
    setTimeout(function() { playBeep(880, 0.25, 'square'); }, 280);
    setTimeout(function() { playBeep(440, 0.25, 'square'); }, 560);
  } else {
    playBeep(880, 0.3);
    setTimeout(function() { playBeep(1046, 0.4); }, 350);
  }

  // Browser notifications
  alerts.forEach(function(a) { sendNotification(a.title, a.body); });
}

// Page-load initialization: restore button state and fire initial delta check
// against DASH_SNAPSHOT so behavior matches the previous IIFE exactly.
(function() {
  _updateAlertBtn(localStorage.getItem('dashboard-alerts-enabled') === 'true');
  runAlertCheck(DASH_SNAPSHOT);
})();
// ─────────────────────────────────────────────────────────────────────────────

// Agent portrait popup
var _portraitPopup = document.getElementById('agent-portrait-popup');
var _portraitImg = _portraitPopup ? _portraitPopup.querySelector('img') : null;

function showAgentPortrait(cardEl, imgSrc) {
  if (!_portraitPopup || !_portraitImg) return;
  _portraitImg.src = imgSrc;
  _portraitPopup.style.display = 'block';
  var rect = cardEl.getBoundingClientRect();
  var popupW = 200;
  var left = rect.right + 14;
  if (left + popupW > window.innerWidth - 8) left = rect.left - popupW - 14;
  var top = rect.top;
  if (top + 200 > window.innerHeight - 8) top = window.innerHeight - 208;
  _portraitPopup.style.left = left + 'px';
  _portraitPopup.style.top = top + 'px';
}

function hideAgentPortrait() {
  if (_portraitPopup) _portraitPopup.style.display = 'none';
}

// ── US-0111: Live fetch-and-patch ─────────────────────────────────────────────
// Replaces the prior 30s location.reload() loop (BUG-0159). Every 5s we fetch
// docs/sdlc-status.json, diff its fields against the current DOM, and patch
// only the changed nodes — preserving scroll position, open modals, filter
// chip state, and portrait popups (AC-0364, AC-0365, AC-0367, AC-0434).

var _lastFetchedAt = Date.now();
var _lastFetchOk = true;

function _agentStatusColors(stat) {
  // Mirrors the server-side renderer's pill color logic so patchDOM() can
  // recompute styles client-side when an agent transitions. Keep in sync
  // with the statusBg/statusColor ternaries in generateHTML.
  if (stat === 'active') return { bg: 'rgba(52,168,83,0.2)', color: '#34A853' };
  if (stat === 'complete') return { bg: 'rgba(21,101,192,0.15)', color: '#1565C0' };
  if (stat === 'blocked' || stat === 'needs-review') return { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' };
  return { bg: 'rgba(136,136,136,0.15)', color: '#888' };
}

function patchDOM(status) {
  if (!status || typeof status !== 'object') return;

  // --- Project identity (US-0128) ------------------------------------------
  var proj = status.project;
  if (proj) {
    var titleEl = document.querySelector('.header-title');
    if (titleEl && proj.name) titleEl.textContent = proj.name;
    var subtitleEl = document.querySelector('.header-subtitle');
    if (subtitleEl && proj.description) subtitleEl.textContent = proj.description;
    var aboutH3 = document.querySelector('.about-right h3');
    if (aboutH3 && proj.name) aboutH3.textContent = proj.name;
    var aboutDesc = document.querySelector('.about-right p');
    if (aboutDesc && proj.description) aboutDesc.textContent = proj.description;
    if (proj.repoUrl) {
      document.querySelectorAll('a.repo-link, .about-links-row a[href*="yourorg"]').forEach(function(a) {
        a.href = proj.repoUrl;
      });
    }
    if (!document._projectTitlePatched && proj.name) {
      document.title = proj.name + ' \u2014 SDLC Live Dashboard';
      document._projectTitlePatched = true;
    }
  }

  // --- Epic progress strip (US-0130) ----------------------------------------
  var epics = status.epics || {};
  var epicKeys = Object.keys(epics);
  var epicStripEl = document.getElementById('epic-strip');
  var epicRowsEl = document.getElementById('epic-strip-rows');
  if (epicStripEl && epicRowsEl) {
    if (epicKeys.length === 0) {
      epicStripEl.style.display = 'none';
    } else {
      epicStripEl.style.display = '';
      epicRowsEl.innerHTML = epicKeys.map(function(id) {
        var ep = epics[id];
        var pct = ep.storiesTotal > 0 ? Math.round((ep.storiesCompleted / ep.storiesTotal) * 100) : 0;
        var badgeColor = ep.status === 'complete' ? '#34A853' : ep.status === 'in-progress' ? '#F57C00' : '#888';
        return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
          + '<span style="font-weight:600;color:var(--text-primary);min-width:90px;">' + escH(id) + '</span>'
          + '<span style="color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escH(ep.name || '') + '</span>'
          + '<span style="min-width:60px;text-align:right;color:var(--text-muted);">' + ep.storiesCompleted + '/' + ep.storiesTotal + '</span>'
          + '<div style="width:80px;height:4px;background:var(--bg-progress);border-radius:2px;overflow:hidden;">'
          + '<div style="height:100%;width:' + pct + '%;background:' + badgeColor + ';border-radius:2px;transition:width 0.6s;"></div>'
          + '</div>'
          + '<span style="min-width:32px;text-align:right;color:' + badgeColor + ';font-weight:600;">' + pct + '%</span>'
          + '</div>';
      }).join('');
    }
  }

  // --- Cycle history (US-0133) -----------------------------------------------
  var cycles = Array.isArray(status.cycles) ? status.cycles : [];
  var cycleSection = document.getElementById('cycle-history-section');
  var lapStrip = document.getElementById('cycle-lap-strip');
  var telemetryRow = document.getElementById('cycle-telemetry');
  if (cycleSection && lapStrip && telemetryRow) {
    if (cycles.length === 0) {
      cycleSection.style.display = 'none';
    } else {
      cycleSection.style.display = '';
      var avgTotalSec = cycles.reduce(function(sum, c) {
        var total = Object.values(c.phaseDurations || {}).reduce(function(a, b) { return a + b; }, 0);
        return sum + total;
      }, 0) / cycles.length;
      var avgMin = Math.round(avgTotalSec / 60);
      var today = new Date().toDateString();
      var cyclesToday = cycles.filter(function(c) { return c.completedAt && new Date(c.completedAt).toDateString() === today; }).length;
      var successRate = cycles.length > 0 ? Math.round((cycles.filter(function(c) { return (c.testsFailed || 0) === 0; }).length / cycles.length) * 100) : 0;
      telemetryRow.innerHTML = [
        { label: 'Cycles Total', value: cycles.length },
        { label: 'Today', value: cyclesToday },
        { label: 'Avg Cycle (min)', value: avgMin || '–' },
        { label: 'Success Rate', value: successRate + '%' },
      ].map(function(t) {
        return '<div class="cycle-telemetry-tile"><div class="tile-value">' + escH(String(t.value)) + '</div><div class="tile-label">' + escH(t.label) + '</div></div>';
      }).join('');
      var recent = cycles.slice(-10).reverse();
      var prevLen = parseInt(lapStrip.getAttribute('data-cycle-count') || '0', 10);
      lapStrip.innerHTML = recent.map(function(c) {
        return '<div class="cycle-card">'
          + '<div class="cycle-card-id">#' + escH(String(c.id)) + '</div>'
          + '<div class="cycle-card-stat">' + escH(String(c.storiesCompleted)) + ' stories</div>'
          + '<div class="cycle-card-stat">' + escH((c.coveragePercent || 0).toFixed(1)) + '% cov</div>'
          + '</div>';
      }).join('');
      if (cycles.length > prevLen && prevLen > 0 && typeof playBeep === 'function') {
        playBeep(523, 0.15);
        setTimeout(function() { playBeep(659, 0.15); }, 150);
        setTimeout(function() { playBeep(784, 0.2); }, 300);
      }
      lapStrip.setAttribute('data-cycle-count', String(cycles.length));
    }
  }

  // --- Phase timeline (US-0115) ---------------------------------------------
  // Toggle status class, swap status icon, flip blocked beacon, reveal
  // completed-phase checkmark + elapsed footer, and resize the active
  // phase's partial-progress fill — all without remounting the block.
  var phases = Array.isArray(status.phases) ? status.phases : [];
  var _storiesTotal = (status.metrics && status.metrics.storiesTotal) || 0;
  var _storiesDone = (status.metrics && status.metrics.storiesCompleted) || 0;
  var _fillRatio = _storiesTotal > 0 ? Math.max(0.04, Math.min(1, _storiesDone / _storiesTotal)) : 0.5;
  var _fillPct = Math.round(_fillRatio * 100);
  phases.forEach(function(p) {
    var el = document.getElementById('phase-' + p.id);
    if (!el) return;
    var prevStatus = el.getAttribute('data-phase-status');
    if (prevStatus !== p.status) {
      // Replace only the status class on the block — preserves the block
      // element itself (and hence any inner elements, event listeners, ids).
      el.classList.remove('pending', 'in-progress', 'complete', 'blocked');
      el.classList.add(p.status);
      el.setAttribute('data-phase-status', p.status);
      var iconEl = document.getElementById('phase-' + p.id + '-icon');
      if (iconEl) {
        iconEl.textContent = p.status === 'complete' ? '✅'
          : p.status === 'in-progress' ? '🔄'
          : p.status === 'blocked' ? '⚠️'
          : '⏳';
      }
    }
    // US-0115 AC-0385/0386: patch fill width + elapsed-footer text.
    var fillEl = document.getElementById('phase-' + p.id + '-fill');
    if (fillEl) {
      var newWidth = p.status === 'in-progress' ? _fillPct
        : p.status === 'complete' ? 100
        : 0;
      fillEl.style.width = newWidth + '%';
    }
    var elapsedEl = document.getElementById('phase-' + p.id + '-elapsed');
    if (elapsedEl) {
      if (p.status === 'complete' && p.startedAt && p.completedAt) {
        var ms = Date.parse(p.completedAt) - Date.parse(p.startedAt);
        if (isFinite(ms) && ms >= 0) {
          var totalS = Math.floor(ms / 1000);
          var h = Math.floor(totalS / 3600);
          var mi = Math.floor((totalS % 3600) / 60);
          var se = totalS % 60;
          function pad2(n) { return (n < 10 ? '0' : '') + n; }
          var newElapsed = pad2(h) + ':' + pad2(mi) + ':' + pad2(se);
          // Preserve the .phase-check span sibling; only rewrite the
          // trailing text node so the ✓ keeps its styling.
          var checkSpan = elapsedEl.querySelector('.phase-check');
          elapsedEl.textContent = '';
          if (checkSpan) elapsedEl.appendChild(checkSpan);
          elapsedEl.appendChild(document.createTextNode(newElapsed));
          elapsedEl.setAttribute('data-has-elapsed', '1');
        }
      } else if (p.status !== 'complete') {
        elapsedEl.setAttribute('data-has-elapsed', '0');
      }
    }
  });

  // --- Agents ----------------------------------------------------------------
  var agents = status.agents || {};
  Object.keys(agents).forEach(function(name) {
    var a = agents[name] || {};
    var card = document.getElementById('agent-' + name);
    if (!card) return;
    var prevStatus = card.getAttribute('data-agent-status');
    if (prevStatus !== a.status) {
      card.setAttribute('data-agent-status', a.status || '');
      // US-0119 AC-0403/0404: toggle active (3px color glow + on-air dot)
      // and idle (0.5 opacity) classes so the station visually reflects
      // the live status without re-rendering the card.
      if (a.status === 'active') card.classList.add('active');
      else card.classList.remove('active');
      var isIdle = a.status !== 'active' && a.status !== 'complete'
        && a.status !== 'blocked' && a.status !== 'needs-review';
      if (isIdle) card.classList.add('idle');
      else card.classList.remove('idle');
      var pill = document.getElementById('agent-' + name + '-status');
      if (pill) {
        pill.textContent = a.status || '';
        var colors = _agentStatusColors(a.status);
        pill.style.background = colors.bg;
        pill.style.color = colors.color;
      }
    }
    var taskEl = document.getElementById('agent-' + name + '-task');
    if (taskEl) {
      var newTask = a.currentTask || '';
      if (taskEl.textContent !== newTask) taskEl.textContent = newTask;
      taskEl.style.display = newTask ? '' : 'none';
    }
  });

  // --- Spotlight (US-0119 AC-0401) ------------------------------------------
  // Keep the live spotlight panel in sync with the active (non-Conductor)
  // agent. We only patch text/attribute fields — the portrait <img> is NOT
  // swapped because the server-side renderer already chose the correct
  // agent at generation time, and swapping image sources here would cause
  // the 5s refresh loop to thrash the browser cache on every tick.
  var spotlightEl = document.getElementById('agent-spotlight');
  if (spotlightEl) {
    var spotlightAgentName = spotlightEl.getAttribute('data-agent-name');
    if (spotlightAgentName && agents[spotlightAgentName]) {
      var sa = agents[spotlightAgentName];
      var spotlightTask = document.getElementById('agent-spotlight-task');
      if (spotlightTask) {
        var newSpotlightTask = sa.currentTask || 'Awaiting assignment';
        if (spotlightTask.textContent !== newSpotlightTask) spotlightTask.textContent = newSpotlightTask;
      }
      var spotlightElapsedEl = document.getElementById('agent-spotlight-elapsed');
      if (spotlightElapsedEl && sa.startedAt) {
        spotlightElapsedEl.setAttribute('data-started-at', sa.startedAt);
      }
    }
  }

  // --- Metrics ---------------------------------------------------------------
  var m = status.metrics || {};
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && el.textContent !== String(value)) el.textContent = String(value);
  }
  var phasesCompleteCount = phases.filter(function(p) { return p.status === 'complete'; }).length;
  var phasePct = phases.length > 0 ? Math.round((phasesCompleteCount / phases.length) * 100) : 0;
  setText('metric-phasesComplete', phasesCompleteCount + ' / ' + phases.length);
  // US-0118: hero number (split across two spans) + sparkline bars keyed to phase status.
  setText('metric-phasesCompleteNum', phasesCompleteCount);
  setText('metric-phasesTotalNum', phases.length);
  var spark = document.getElementById('metric-phasesSparkline');
  if (spark) {
    var bars = spark.querySelectorAll('.spark-bar');
    phases.forEach(function(p, i) {
      var bar = bars[i];
      if (!bar) return;
      var prevStatus = bar.getAttribute('data-phase-status');
      if (prevStatus !== p.status) {
        bar.setAttribute('data-phase-status', p.status || '');
        bar.className = 'spark-bar ' + (p.status || 'pending');
        var h = p.status === 'complete' ? 100 : p.status === 'in-progress' ? 60 : 18;
        bar.style.height = h + '%';
      }
    });
  }
  var phasesBar = document.getElementById('metric-phasesBar');
  if (phasesBar) phasesBar.style.width = phasePct + '%';

  if (typeof m.storiesCompleted === 'number' && typeof m.storiesTotal === 'number') {
    setText('metric-storiesDone', m.storiesCompleted + ' / ' + m.storiesTotal);
    var storiesBar = document.getElementById('metric-storiesBar');
    if (storiesBar) {
      var sp = m.storiesTotal > 0 ? Math.round((m.storiesCompleted / m.storiesTotal) * 100) : 0;
      storiesBar.style.width = sp + '%';
    }
  }
  if (typeof m.tasksTotal === 'number') {
    setText('metric-tasksDone', m.tasksTotal > 0 ? (m.tasksCompleted + ' / ' + m.tasksTotal) : '—');
    var tasksBar = document.getElementById('metric-tasksBar');
    if (tasksBar) {
      var tp = m.tasksTotal > 0 ? Math.round((m.tasksCompleted / m.tasksTotal) * 100) : 0;
      tasksBar.style.width = tp + '%';
    }
  }
  if (typeof m.testsPassed === 'number') setText('metric-testsPassed', m.testsPassed);
  if (typeof m.testsFailed === 'number') setText('metric-testsFailed', m.testsFailed);
  if (typeof m.testsTotal === 'number') setText('metric-testsTotal', m.testsTotal);
  if (typeof m.coveragePercent === 'number') {
    setText('metric-coveragePercent', m.coveragePercent + '%');
    // US-0118 AC-0397: re-tint the SVG doughnut + hero number by threshold.
    var tone = m.coveragePercent >= 80 ? 'green' : m.coveragePercent >= 60 ? 'amber' : 'red';
    var dough = document.getElementById('metric-coverageDoughnut');
    var fill = document.getElementById('metric-coverageDoughnutFill');
    var dnum = document.getElementById('metric-coveragePercent');
    if (fill) {
      fill.setAttribute('class', 'd-fill ' + tone);
      var pct = Math.max(0, Math.min(100, m.coveragePercent));
      fill.setAttribute('stroke-dashoffset', (100 - pct).toFixed(2));
    }
    if (dnum) dnum.className = 'd-num ' + tone;
    if (dough) { dough.setAttribute('data-tone', tone); dough.setAttribute('data-coverage', String(m.coveragePercent)); dough.setAttribute('aria-label', 'Code coverage ' + m.coveragePercent + '%'); }
  }
  if (typeof m.bugsOpen === 'number') setText('metric-bugsOpen', m.bugsOpen);
  if (typeof m.bugsFixed === 'number') setText('metric-bugsFixed', m.bugsFixed);
  if (typeof m.reviewsApproved === 'number') setText('metric-reviewsApproved', m.reviewsApproved);
  if (typeof m.reviewsBlocked === 'number') setText('metric-reviewsBlocked', m.reviewsBlocked);

  // US-0118 AC-0400: bump the per-card "LAST UPDATED HH:MM" stamps each
  // successful refresh. Uses the browser's local time (24h) for consistency
  // with the header clock's tabular numerics.
  var _hhmm = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  ['stamp-phase-progress', 'stamp-quality', 'stamp-reviews'].forEach(function(id) { setText(id, _hhmm); });

  // --- Activity log (append-only diff by data-log-key) -----------------------
  // US-0121 AC-0411/AC-0413/AC-0414: terminal-aesthetic rows with
  // data-category for filter chips, bracketed [HH:MM:SS] [AGENT] format, and
  // tail-mode scroll-to-top when enabled.
  var scroll = document.getElementById('log-scroll');
  if (scroll && Array.isArray(status.log)) {
    var existing = {};
    scroll.querySelectorAll('[data-log-key]').forEach(function(el) {
      existing[el.getAttribute('data-log-key')] = true;
    });
    // Server rendered newest-first (.slice(-20).reverse()). Match that ordering:
    // prepend newer entries to the top so user-facing order stays identical.
    var recent = status.log.slice(-20);
    var toPrepend = [];
    var activeFilter = scroll.getAttribute('data-active-filter') || 'all';
    for (var i = recent.length - 1; i >= 0; i--) {
      var entry = recent[i] || {};
      var key = (entry.time || '') + '|' + (entry.agent || '') + '|' + (entry.message || '');
      if (existing[key]) continue;
      var color = (DASH_AGENT_COLORS && DASH_AGENT_COLORS[entry.agent]) || '#888';
      var category = _logCategory(entry.message);
      var timeDisplay = _formatLogTime(entry.time);
      var agentToken = entry.agent || 'System';

      var div = document.createElement('div');
      div.className = 'log-entry';
      div.setAttribute('data-log-key', key);
      div.setAttribute('data-category', category);
      div.style.borderLeftColor = color;

      var timeSpan = document.createElement('span');
      timeSpan.className = 'log-time';
      timeSpan.setAttribute('data-log-time', entry.time || '');
      timeSpan.textContent = '[' + timeDisplay + ']';

      var agentSpan = document.createElement('span');
      agentSpan.className = 'log-agent';
      agentSpan.style.color = color;
      agentSpan.textContent = '[' + agentToken + ']';

      var msgSpan = document.createElement('span');
      msgSpan.className = 'log-msg';
      msgSpan.textContent = entry.message || '';

      div.appendChild(timeSpan);
      div.appendChild(agentSpan);
      div.appendChild(msgSpan);

      // Honour the currently-selected filter chip for newly-added rows.
      if (activeFilter !== 'all' && category !== activeFilter) {
        div.classList.add('log-hidden');
      }
      toPrepend.push(div);
    }
    if (toPrepend.length > 0) {
      // First real entry replaces the empty-state placeholder.
      var emptyEl = document.getElementById('log-empty');
      if (emptyEl && emptyEl.parentNode) emptyEl.parentNode.removeChild(emptyEl);
      // Insert newest-first at the very top.
      toPrepend.reverse().forEach(function(el) {
        scroll.insertBefore(el, scroll.firstChild);
      });
      _applyTailIfOn();
    }
  }
}

function _formatElapsed(ms) {
  var s = Math.max(0, Math.floor(ms / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return s + ' seconds ago';
  var m = Math.floor(s / 60);
  if (m < 60) return m + ' minute' + (m === 1 ? '' : 's') + ' ago';
  var h = Math.floor(m / 60);
  return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
}

function updateLastUpdatedTicker(stale) {
  var el = document.getElementById('last-updated-ticker');
  if (!el) return;
  var ago = _formatElapsed(Date.now() - _lastFetchedAt);
  if (stale) {
    el.textContent = 'Last updated: ' + ago + ' · STALE';
    el.classList.add('stale');
  } else {
    el.textContent = 'Last updated: ' + ago;
    el.classList.remove('stale');
  }
}

async function refreshState() {
  try {
    var res = await fetch('./sdlc-status.json', { cache: 'no-store' });
    if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'no response'));
    var newStatus = await res.json();
    patchDOM(newStatus);
    patchCycleCounter(newStatus);
    runAlertCheck(newStatus);
    _lastFetchedAt = Date.now();
    _lastFetchOk = true;
    updateLastUpdatedTicker(false);
  } catch (e) {
    _lastFetchOk = false;
    // Structured warning per AGENTS.md §13/§18 — no silent failure.
    console.warn('[refreshState] fetch failed', { t: new Date().toISOString(), err: String(e) });
    updateLastUpdatedTicker(true);
  }
}

// 5-second fetch tick (AC-0434 allows 5–10s; pick 5s for snappier feedback
// on state transitions. US-0122 may tune further based on cost/battery impact).
setInterval(refreshState, 5000);

// 1-second ticker update for smooth "Last updated: N seconds ago" display
// without re-fetching. Cheap DOM text update only.
setInterval(function() { updateLastUpdatedTicker(!_lastFetchOk); }, 1000);

// US-0119 AC-0401: spotlight elapsed-time ticker. Reads data-started-at
// (ISO 8601) off #agent-spotlight-elapsed and re-renders "HH:MM:SS" every
// second. When the field is absent/empty, the element shows IDLE so the
// spotlight gracefully degrades before agents get a startedAt field.
function _formatElapsedClock(ms) {
  if (!isFinite(ms) || ms < 0) ms = 0;
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return pad(h) + ':' + pad(m) + ':' + pad(sec);
}
function updateSpotlightElapsed() {
  var el = document.getElementById('agent-spotlight-elapsed');
  if (!el) return;
  var startedAt = el.getAttribute('data-started-at') || '';
  if (!startedAt) {
    if (el.textContent !== 'IDLE') el.textContent = 'IDLE';
    return;
  }
  var startMs = Date.parse(startedAt);
  if (isNaN(startMs)) {
    if (el.textContent !== 'IDLE') el.textContent = 'IDLE';
    return;
  }
  el.textContent = _formatElapsedClock(Date.now() - startMs);
}
// Run immediately so the first tick isn't a 1s delay of "—" text.
updateSpotlightElapsed();
setInterval(updateSpotlightElapsed, 1000);

// US-0115 AC-0384: cycle-counter elapsed ticker.
// The #cycle-elapsed node carries data-started-at (ISO 8601) set server-side
// (see generateHTML cycleStartedAt). When present, render HH:MM:SS since
// that instant; when absent, show 00:00:00 so the UI still has tabular
// numerics instead of collapsing. patchCycleCounter() (called from
// refreshState) keeps the label text + startedAt attr in sync with the
// latest status.json without replacing the node.
function updateCycleElapsed() {
  var el = document.getElementById('cycle-elapsed');
  if (!el) return;
  var startedAt = el.getAttribute('data-started-at') || '';
  if (!startedAt) {
    if (el.textContent !== '00:00:00') el.textContent = '00:00:00';
    return;
  }
  var startMs = Date.parse(startedAt);
  if (isNaN(startMs)) {
    if (el.textContent !== '00:00:00') el.textContent = '00:00:00';
    return;
  }
  el.textContent = _formatElapsedClock(Date.now() - startMs);
}
function patchCycleCounter(status) {
  if (!status || typeof status !== 'object') return;
  var storiesMap = status.stories || {};
  var entries = Object.keys(storiesMap).map(function(id) { return Object.assign({ id: id }, storiesMap[id] || {}); });
  var completedCount = entries.filter(function(s) { return /^(Complete|Done)$/i.test(s.status); }).length;
  var active = null;
  for (var i = 0; i < entries.length; i++) {
    if (/^In[ -]?Progress$/i.test(entries[i].status)) { active = entries[i]; break; }
  }
  var cycleN = completedCount + 1;
  var labelText = active ? ('CYCLE ' + cycleN + ' \u00B7 IMPLEMENTING ' + active.id) : 'STANDBY';
  var labelEl = document.getElementById('cycle-label-text');
  if (labelEl && labelEl.textContent !== labelText) labelEl.textContent = labelText;
  var elapsedEl = document.getElementById('cycle-elapsed');
  if (elapsedEl) {
    // Prefer active story startedAt, fall back to the in-progress phase's startedAt.
    var started = (active && active.startedAt) || '';
    if (!started) {
      var phases = Array.isArray(status.phases) ? status.phases : [];
      for (var j = 0; j < phases.length; j++) {
        if (phases[j].status === 'in-progress' && phases[j].startedAt) { started = phases[j].startedAt; break; }
      }
    }
    var prev = elapsedEl.getAttribute('data-started-at') || '';
    if (prev !== started) elapsedEl.setAttribute('data-started-at', started);
  }
}
// Kick the ticker immediately and every second, mirroring updateSpotlightElapsed.
updateCycleElapsed();
setInterval(updateCycleElapsed, 1000);

// US-0146: Live bar HH:MM:SS clock — ticks every second.
(function startLiveClock() {
  function tick() {
    var el = document.getElementById('pv-live-clock');
    if (!el) return;
    var n = new Date();
    el.textContent =
      String(n.getHours()).padStart(2, '0') + ':' +
      String(n.getMinutes()).padStart(2, '0') + ':' +
      String(n.getSeconds()).padStart(2, '0');
  }
  tick();
  setInterval(tick, 1000);
})();
</script>

<div id="agent-portrait-popup"><img src="" alt="Agent portrait" onerror="this.style.display='none'"></div>

<!-- US-0122 AC-0416: full-viewport red border overlay toggled on BLOCKED state. -->
<div id="blocked-border" class="blocked-border"></div>

</body>
</html>`;
}

function generate() {
  const status = readJSON(STATUS_PATH);
  if (!status) {
    console.error('Could not read', STATUS_PATH);
    process.exit(1);
  }
  const html = generateHTML(status);
  fs.writeFileSync(OUTPUT_PATH, html, 'utf8');
  console.log(`[${new Date().toLocaleTimeString()}] Dashboard generated: ${OUTPUT_PATH}`);
}

// Main — only run the pipeline when invoked as a CLI, so tests and other
// consumers can safely `require('tools/generate-dashboard')` to access
// generateHTML without triggering file writes or fs.watch side-effects.
if (require.main === module) {
  generate();

  if (process.argv.includes('--watch')) {
    console.log('Watching for changes...');
    let debounce = null;
    fs.watch(STATUS_PATH, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log(`[${new Date().toLocaleTimeString()}] Status changed, regenerating...`);
        generate();
      }, 500);
    });
  }
}

module.exports = { generateHTML, generate, formatElapsed };
