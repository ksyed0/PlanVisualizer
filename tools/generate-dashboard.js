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
const STATUS_PATH = path.join(ROOT, 'docs', 'sdlc-status.json');
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

  // Agent colors, icons, and roles derived from agents.config.json
  const agentColors = {};
  const agentIcons = {};
  const agentRoles = {};
  for (const [name, cfg] of Object.entries(AGENT_CONFIG.agents || {})) {
    agentColors[name] = cfg.color || '#888';
    agentIcons[name] = cfg.icon || '🤖';
    agentRoles[name] = cfg.role || name;
  }

  const phasesComplete = phases.filter((p) => p.status === 'complete').length;
  const pipelineComplete = phasesComplete === phases.length && phases.length > 0;

  const phasePercent = phases.length > 0 ? Math.round((phasesComplete / phases.length) * 100) : 0;

  const storyPercent =
    metrics.storiesTotal > 0 ? Math.round((metrics.storiesCompleted / metrics.storiesTotal) * 100) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${DASH_META.title} — SDLC Live Dashboard</title>
<style>
  :root {
    --brand-primary: ${DASH_META.primaryColor};
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

  .header { background: linear-gradient(135deg, var(--brand-primary) 0%, #8B1A12 100%); padding: 20px 32px; display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 22px; color: white; font-weight: 700; }
  .header .subtitle { font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 2px; }
  .header .controls { display: flex; align-items: center; gap: 16px; }
  .header .clock { text-align: right; }
  .header .clock .time { font-size: 28px; font-weight: 700; color: white; font-variant-numeric: tabular-nums; }
  .header .clock .label { font-size: 11px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1px; }
  #theme-toggle { background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; transition: background 0.2s; }
  #theme-toggle:hover { background: rgba(255,255,255,0.35); }

  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

  /* Phase Pipeline */
  .pipeline { display: flex; gap: 4px; margin-bottom: 24px; }
  .phase-block { flex: 1; border-radius: 8px; padding: 16px; position: relative; overflow: hidden; transition: all 0.3s; }
  .phase-block.pending { background: var(--bg-phase-pending); border: 1px solid var(--bg-phase-border); }
  .phase-block.in-progress { background: var(--bg-phase-pending); border: 2px solid #F57C00; animation: pulse 2s infinite; }
  .phase-block.complete { background: var(--bg-phase-complete); border: 1px solid #2E7D32; }
  .phase-name { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
  .phase-agents { font-size: 11px; color: var(--text-muted); }
  .phase-status { position: absolute; top: 8px; right: 12px; font-size: 18px; }
  .phase-deliverables { font-size: 10px; color: var(--text-dim); margin-top: 8px; }

  @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 124, 0, 0.4); } 50% { box-shadow: 0 0 20px 4px rgba(245, 124, 0, 0.2); } }

  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
  .grid-2 > * { min-width: 0; }

  .card { background: var(--bg-card); border-radius: 12px; padding: 20px; border: 1px solid var(--bg-card-border); transition: background 0.3s, border-color 0.3s; }
  .card h2 { font-size: 15px; font-weight: 700; margin-bottom: 16px; color: var(--brand-primary); text-transform: uppercase; letter-spacing: 1px; }

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

  /* Agent spotlight banner (Option 2) */
  .agent-spotlight { position: relative; border-radius: 10px; overflow: hidden; margin-bottom: 14px; height: 120px; background: var(--bg-card-inner); display: flex; align-items: flex-end; }
  .agent-spotlight.no-active { display: flex; align-items: center; justify-content: center; height: 80px; }
  .agent-spotlight.no-active .spotlight-waiting { color: var(--text-muted); font-size: 13px; font-style: italic; }
  .spotlight-img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
  .spotlight-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 60%, transparent 100%); }
  .spotlight-info { position: relative; z-index: 1; padding: 12px 16px; width: 100%; }
  .spotlight-name { font-size: 18px; font-weight: 700; color: white; }
  .spotlight-role { font-size: 12px; color: rgba(255,255,255,0.75); margin-top: 2px; }
  .spotlight-task { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Agent grid (Option 1: avatar images) */
  .agent-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .agent-card { background: var(--bg-card-inner); border-radius: 8px; padding: 10px; border-left: 4px solid; transition: transform 150ms ease, box-shadow 150ms ease, filter 0.2s; display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
  .agent-card:hover { transform: scale(1.02); box-shadow: 0 6px 24px rgba(0,0,0,0.5); filter: brightness(1.12); }
  #agent-portrait-popup { position: fixed; z-index: 999; width: 200px; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.7); pointer-events: none; display: none; transition: opacity 0.15s; border: 2px solid rgba(255,255,255,0.12); }
  #agent-portrait-popup img { width: 100%; display: block; }
  .agent-card.active { animation: pulse-agent 1.5s infinite; }
  @keyframes pulse-agent { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
  .agent-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid; flex-shrink: 0; }
  .agent-avatar-fallback { width: 40px; height: 40px; border-radius: 50%; border: 2px solid; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 20px; background: var(--bg-phase-pending); }
  .agent-info { min-width: 0; flex: 1; }
  .agent-name { font-size: 13px; font-weight: 700; }
  .agent-role { font-size: 10px; color: var(--text-muted); margin-bottom: 4px; }
  .agent-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; display: inline-block; }
  .agent-task { font-size: 10px; color: var(--text-secondary); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Story table */
  .story-list { display: flex; flex-direction: column; gap: 10px; }
  .epic-group { }
  .epic-header { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; padding: 0 4px 4px; border-bottom: 1px solid var(--divider); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
  .epic-header:hover { color: var(--text-secondary); }
  .epic-toggle { font-size: 9px; margin-left: auto; opacity: 0.6; transition: transform 0.2s; }
  .epic-group.collapsed .epic-toggle { transform: rotate(-90deg); }
  .epic-group.collapsed .epic-stories { display: none; }
  .epic-id { color: var(--brand-primary); font-size: 10px; font-weight: 600; }
  .epic-stories { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .story-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--bg-card-inner); border-radius: 6px; font-size: 12px; transition: all 0.2s; }
  .story-row:hover { filter: brightness(1.1); }
  .story-id { font-weight: 700; color: var(--brand-primary); width: 65px; }
  .story-title { flex: 1; min-width: 0; color: var(--story-title); margin: 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .story-status { font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600; flex-shrink: 0; white-space: nowrap; }
  .story-status.Planned { background: var(--status-planned-bg); color: var(--status-planned-color); }
  .story-status.InProgress { background: var(--status-inprogress-bg); color: #F57C00; }
  [data-theme="light"] .story-status.InProgress { color: #E65100; }
  .story-status.Complete { background: var(--status-complete-bg); color: #34A853; }
  [data-theme="light"] .story-status.Complete { color: #2E7D32; }

  /* Activity log */
  .log-entry { padding: 8px 0; border-bottom: 1px solid var(--divider); font-size: 12px; }
  .log-entry:last-child { border-bottom: none; }
  .log-time { color: var(--text-dim); font-variant-numeric: tabular-nums; margin-right: 8px; }
  .log-agent { font-weight: 700; margin-right: 4px; }
  .log-scroll { max-height: 240px; overflow-y: auto; }

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
  .modal { background: var(--bg-card); border: 1px solid var(--bg-card-border); border-radius: 16px; padding: 32px; max-width: 460px; width: 90%; text-align: center; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
  .modal h3 { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: var(--brand-primary); }
  .modal p { font-size: 14px; color: var(--text-secondary); margin-bottom: 6px; }
  .modal .author { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 16px 0 8px; }
  .modal .repo-link { display: inline-block; margin: 12px 0 16px; background: var(--brand-primary); color: white; padding: 8px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; transition: background 0.2s; }
  .modal .repo-link:hover { filter: brightness(0.85); text-decoration: none; }
  .modal .meta-divider { border-top: 1px solid var(--bg-card-border); padding-top: 16px; margin-top: 12px; text-align: left; font-size: 12px; color: var(--text-muted); }
  .modal .meta-section { margin-bottom: 12px; }
  .modal .meta-section:last-child { margin-bottom: 0; }
  .modal .meta-supertitle { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-muted); margin-bottom: 6px; }
  .modal .meta-row { padding-left: 8px; margin-bottom: 3px; }
  .modal .meta-label { color: var(--text-muted); }
  .modal .meta-value { color: var(--text-primary); font-family: 'JetBrains Mono', 'Menlo', monospace; font-size: 11px; }
  .modal .meta-attribution { margin-top: 14px; font-size: 11px; color: var(--text-muted); text-align: center; }
  .modal-close { position: absolute; top: 12px; right: 16px; background: none; border: none; color: var(--text-muted); font-size: 22px; cursor: pointer; line-height: 1; padding: 4px 8px; border-radius: 6px; transition: background 0.2s; }
  .modal-close:hover { background: var(--bg-card-inner); color: var(--text-primary); }

  /* ===== RESPONSIVE: Tablet portrait (768-1024px) ===== */
  @media (max-width: 1024px) {
    .header { padding: 16px 20px; }
    .header h1 { font-size: 18px; }
    .container { padding: 16px; }
    .grid { grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-2 { grid-template-columns: 1fr; gap: 16px; }
    .agent-grid { grid-template-columns: repeat(3, 1fr); }
    .epic-stories { grid-template-columns: 1fr 1fr; }
  }

  /* ===== RESPONSIVE: Tablet landscape adjustments ===== */
  @media (max-width: 1024px) and (orientation: landscape) {
    .pipeline { flex-wrap: wrap; }
    .phase-block { flex: 1 1 calc(33.33% - 4px); min-width: 150px; }
    .grid { grid-template-columns: 1fr 1fr 1fr; }
    .grid-2 { grid-template-columns: 1fr 1fr; }
  }

  /* ===== RESPONSIVE: Phone landscape (up to 767px landscape) ===== */
  @media (max-width: 767px) and (orientation: landscape) {
    .header { padding: 10px 16px; }
    .header h1 { font-size: 16px; }
    .header .subtitle { font-size: 11px; }
    .header .clock .time { font-size: 20px; }
    .container { padding: 10px; }
    .pipeline { flex-wrap: wrap; gap: 4px; }
    .phase-block { flex: 1 1 calc(33.33% - 4px); min-width: 120px; padding: 10px; }
    .phase-name { font-size: 12px; }
    .phase-deliverables { display: none; }
    .grid { grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .grid-2 { grid-template-columns: 1fr 1fr; gap: 10px; }
    .card { padding: 12px; }
    .card h2 { font-size: 12px; margin-bottom: 10px; }
    .agent-spotlight { height: 90px; }
    .spotlight-name { font-size: 15px; }
    .agent-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .agent-card { padding: 8px; gap: 8px; }
    .agent-avatar, .agent-avatar-fallback { width: 32px; height: 32px; }
    .agent-name { font-size: 11px; }
    .epic-stories { grid-template-columns: 1fr; }
    .log-scroll { max-height: 150px; }
    .metric-value { font-size: 16px; }
  }

  /* ===== RESPONSIVE: Phone portrait (up to 480px) ===== */
  @media (max-width: 480px) {
    .header { padding: 12px 16px; flex-wrap: wrap; gap: 8px; }
    .header h1 { font-size: 15px; }
    .header .subtitle { font-size: 10px; }
    .header .controls { gap: 8px; }
    .header .clock .time { font-size: 20px; }
    .header .clock .label { font-size: 9px; }
    .container { padding: 10px; }
    .pipeline { flex-direction: column; gap: 6px; }
    .phase-block { padding: 10px 12px; display: flex; align-items: center; gap: 10px; }
    .phase-block .phase-status { position: static; font-size: 16px; }
    .phase-block .phase-name { margin-bottom: 0; font-size: 13px; flex: 1; }
    .phase-block .phase-agents { display: none; }
    .phase-block .phase-deliverables { display: none; }
    .grid { grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px; }
    .grid-2 { grid-template-columns: 1fr; gap: 12px; }
    .card { padding: 14px; border-radius: 10px; }
    .card h2 { font-size: 13px; margin-bottom: 12px; }
    .agent-spotlight { height: 100px; }
    .spotlight-name { font-size: 15px; }
    .spotlight-task { display: none; }
    .agent-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .agent-card { padding: 8px; gap: 6px; }
    .agent-avatar, .agent-avatar-fallback { width: 32px; height: 32px; font-size: 16px; }
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
    .header h1 { font-size: 13px; }
    .agent-spotlight { height: 80px; }
    .spotlight-name { font-size: 14px; }
    .agent-grid { grid-template-columns: repeat(2, 1fr); }
    .agent-avatar, .agent-avatar-fallback { width: 28px; height: 28px; font-size: 14px; }
    .header .clock .time { font-size: 18px; }
    #theme-toggle, .btn-header { font-size: 11px; padding: 4px 10px; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>${DASH_META.title} — ${DASH_META.subtitle}</h1>
    <div class="subtitle">${DASH_META.platform} | ${DASH_META.agentCount} Specialized Agents | Live Agentic Pipeline Dashboard</div>
  </div>
  <div class="controls">
    <a href="plan-status.html" class="btn-header" style="text-decoration:none">&#8592; Plan Dashboard</a>
    <button class="btn-header" onclick="document.getElementById('about-modal').classList.add('open')">ℹ️ About</button>
    <button id="notif-btn" class="btn-header" onclick="requestAlerts()">🔔 Alerts</button>
    <button id="theme-toggle" onclick="toggleTheme()">☀️ Light</button>
    <div class="clock">
      <div class="time">${now}</div>
      <div class="label">Last Updated</div>
    </div>
  </div>
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

<!-- Phase Pipeline -->
<div class="pipeline">
${phases
  .map((p) => {
    const icon = p.status === 'complete' ? '✅' : p.status === 'in-progress' ? '🔄' : '⏳';
    return `  <div class="phase-block ${p.status}">
    <div class="phase-status">${icon}</div>
    <div class="phase-name">${p.name}</div>
    <div class="phase-agents">${p.agents.join(' · ')}</div>
    <div class="phase-deliverables">${p.deliverables.join(' · ')}</div>
  </div>`;
  })
  .join('\n')}
</div>

<!-- Metrics Row -->
<div class="grid">
  <div class="card">
    <h2>Phase Progress</h2>
    <div class="metric-row">
      <span class="metric-label">Phases Complete</span>
      <span class="metric-value blue">${phases.filter((p) => p.status === 'complete').length} / ${phases.length}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill blue" style="width: ${phasePercent}%"></div></div>
    <div class="metric-row" style="margin-top: 12px">
      <span class="metric-label">Stories Done</span>
      <span class="metric-value green">${metrics.storiesCompleted} / ${metrics.storiesTotal}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill green" style="width: ${storyPercent}%"></div></div>
    <div class="metric-row" style="margin-top: 12px">
      <span class="metric-label">Tasks Done</span>
      <span class="metric-value orange">${metrics.tasksTotal > 0 ? `${metrics.tasksCompleted} / ${metrics.tasksTotal}` : '—'}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill red" style="width: ${metrics.tasksTotal > 0 ? Math.round((metrics.tasksCompleted / metrics.tasksTotal) * 100) : 0}%"></div></div>
  </div>

  <div class="card">
    <h2>Quality</h2>
    <div class="metric-row">
      <span class="metric-label">Tests Passed</span>
      <span class="metric-value green">${metrics.testsPassed}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Tests Failed</span>
      <span class="metric-value red">${metrics.testsFailed}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Code Coverage</span>
      <span class="metric-value ${metrics.coveragePercent >= 60 ? 'green' : 'orange'}">${metrics.coveragePercent}%</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Bugs Open</span>
      <span class="metric-value ${metrics.bugsOpen > 0 ? 'red' : 'green'}">${metrics.bugsOpen}</span>
    </div>
  </div>

  <div class="card">
    <h2>Reviews</h2>
    <div class="metric-row">
      <span class="metric-label">Reviews Approved</span>
      <span class="metric-value green">${metrics.reviewsApproved}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Reviews Blocked</span>
      <span class="metric-value red">${metrics.reviewsBlocked}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Bugs Fixed</span>
      <span class="metric-value blue">${metrics.bugsFixed}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Tests Total</span>
      <span class="metric-value">${metrics.testsTotal}</span>
    </div>
  </div>
</div>

<!-- Agents + Stories -->
<div class="grid-2">
  <div class="card">
    <h2>Agent Status</h2>
${(() => {
  const roles = agentRoles;
  const imgBase = 'agents/images';
  // Option 2: Spotlight banner — prefer non-Conductor active agent (BUG-0079)
  const dmAgentName = (AGENT_CONFIG.orchestrator || {}).dmAgent || 'Conductor';
  const activeAgent =
    Object.entries(agents).find(([name, a]) => a.status === 'active' && name !== dmAgentName) ||
    Object.entries(agents).find(([, a]) => a.status === 'active');
  let spotlight;
  if (activeAgent) {
    const [aName, aData] = activeAgent;
    const aColor = agentColors[aName] || '#888';
    spotlight = `    <div class="agent-spotlight">
      <img class="spotlight-img" src="${imgBase}/${aName.toLowerCase()}.png" alt="${aName}" onerror="this.style.display='none'">
      <div class="spotlight-overlay"></div>
      <div class="spotlight-info">
        <div class="spotlight-name" style="color: ${aColor}">${agentIcons[aName] || ''} ${aName} — ${roles[aName] || aName}</div>
        ${aData.currentTask ? `<div class="spotlight-task">${aData.currentTask}</div>` : ''}
      </div>
    </div>`;
  } else {
    spotlight = `    <div class="agent-spotlight no-active">
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
    // Option 1: Avatar headshot (extracted from team-grid) with fallback to full image, then emoji
    const avatarImg = `<img class="agent-avatar" src="${imgBase}/headshots/${name.toLowerCase()}.png" alt="${name}" style="border-color: ${color}" onerror="this.onerror=function(){this.outerHTML='<div class=\\'agent-avatar-fallback\\' style=\\'border-color: ${color}\\'>${icon}</div>'};this.src='${imgBase}/${name.toLowerCase()}.png'">`;
    const fullPortrait = `${imgBase}/${name.toLowerCase()}.png`;
    return `      <div class="agent-card ${agent.status === 'active' ? 'active' : ''}" style="border-left-color: ${color}"
        onmouseenter="showAgentPortrait(this,'${fullPortrait}')" onmouseleave="hideAgentPortrait()">
        ${avatarImg}
        <div class="agent-info">
          <div class="agent-name" style="color: ${color}">${name}</div>
          <div class="agent-role">${roles[name] || name}</div>
          <div class="agent-status" style="background: ${statusBg}; color: ${statusColor}">${agent.status}</div>
          ${agent.currentTask ? `<div class="agent-task">${agent.currentTask}</div>` : ''}
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
      const storyRows = epicStories
        .map((s) => {
          const statusClass = s.status === 'In Progress' ? 'InProgress' : s.status;
          const title = storyTitles[s.id] || s.title || '';
          return `        <div class="story-row">
          <span class="story-id">${s.id}</span>
          <span class="story-title">${esc(title)}</span>
          <span class="story-status ${statusClass}">${s.status}</span>
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

<!-- Activity Log -->
<div class="card" style="margin-top: 24px">
  <h2>Activity Log</h2>
  <div class="log-scroll">
${
  log.length > 0
    ? log
        .slice(-20)
        .reverse()
        .map((entry) => {
          const agentColor = agentColors[entry.agent] || '#888';
          return `    <div class="log-entry">
      <span class="log-time" data-log-time="${entry.time || ''}">${entry.time || ''}</span>
      <span class="log-agent" style="color: ${agentColor}">${entry.agent || 'System'}</span>
      ${entry.message || ''}
    </div>`;
        })
        .join('\n')
    : `    <div class="log-entry" style="color: #666">Waiting for ${(AGENT_CONFIG.orchestrator || {}).dmAgent || 'orchestrator'} to begin orchestration...</div>`
}
  </div>
</div>

</div>

<!-- About Modal — layout mirrors plan-status.html for consistency (US-0109) -->
<div id="about-modal" class="modal-overlay" onclick="if(event.target===this)this.classList.remove('open')">
  <div class="modal">
    <button class="modal-close" onclick="document.getElementById('about-modal').classList.remove('open')">&times;</button>
    <img src="agents/images/team.png" style="width:100%; border-radius:8px; margin-bottom:12px;" onerror="this.style.display='none'">
    <h3>${esc(DASH_META.title)}</h3>
    <p>${esc(DASH_META.subtitle)}</p>
    ${DASH_META.repoUrl ? `<a class="repo-link" href="${esc(DASH_META.repoUrl)}" target="_blank" rel="noopener">View on GitHub</a>` : ''}
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
// BUG-0083/0088: Log times are stored as local wall-clock HH:MM (24h).
// Convert to 12-hour format using simple arithmetic — no Date/timezone manipulation
// to avoid UTC drift across environments.
(function() {
  document.querySelectorAll('[data-log-time]').forEach(function(el) {
    var t = el.getAttribute('data-log-time');
    if (!t || !t.includes(':')) return;
    var parts = t.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return;
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    el.textContent = h12 + ':' + ('0' + m).slice(-2) + ' ' + ampm;
  });
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

function playBeep(frequency, duration, type) {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
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

(function() {
  // Restore alert button state
  _updateAlertBtn(localStorage.getItem('dashboard-alerts-enabled') === 'true');

  var prevRaw = localStorage.getItem('dashboard-prev-snapshot');
  var curr = DASH_SNAPSHOT;

  // Always save current as baseline for next refresh
  localStorage.setItem('dashboard-prev-snapshot', JSON.stringify(curr));

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

// Auto-refresh: reload every 30s, but only when the About modal is not open
// so the modal doesn't disappear mid-read, and portraits don't blink constantly.
setInterval(function() {
  var modal = document.getElementById('about-modal');
  if (!modal || !modal.classList.contains('open')) {
    location.reload();
  }
}, 30000);
</script>

<div id="agent-portrait-popup"><img src="" alt="Agent portrait" onerror="this.style.display='none'"></div>

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

module.exports = { generateHTML, generate };
