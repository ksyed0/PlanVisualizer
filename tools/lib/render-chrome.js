'use strict';

// US-0137/US-0138: Shared chrome header for Plan-Status and Pipeline dashboards.
// All CSS uses var(--chrome-*) tokens — zero hex literals (AC-0498).

const CHROME_CSS = `
.pv-chrome { height:52px; background:var(--chrome-bg); border-bottom:1px solid var(--chrome-border);
  display:flex; align-items:center; padding:0 14px; gap:8px; font-size:12px;
  position:sticky; top:0; z-index:100; }
.pv-brand { font-weight:700; font-size:13px; color:var(--chrome-brand);
  letter-spacing:-.01em; margin-right:4px; text-decoration:none; }
.pv-seg-group { display:flex; gap:2px; }
.pv-seg { padding:4px 10px; border-radius:6px; font-size:11px; font-weight:500;
  color:var(--chrome-muted); cursor:pointer; border:none; background:none; text-decoration:none; }
.pv-seg-active { background:var(--chrome-seg-active-bg); color:var(--chrome-text); font-weight:600; }
.pv-spacer { flex:1; }
.pv-iconbtn { width:28px; height:28px; border-radius:6px; display:flex; align-items:center;
  justify-content:center; font-size:13px; color:var(--chrome-muted); cursor:pointer; border:none; background:none; }
.pv-iconbtn:hover { background:var(--chrome-hover-bg); }
.pv-theme-segs { display:flex; background:var(--chrome-theme-bg); border-radius:6px; padding:2px; gap:1px; }
.pv-theme-btn { padding:3px 7px; border-radius:4px; font-size:11px; color:var(--chrome-subtle);
  cursor:pointer; border:none; background:none; }
.pv-theme-btn.active { background:var(--chrome-theme-active); color:var(--chrome-text); }
.mode-badge { display:flex; align-items:center; gap:5px; padding:3px 8px; border-radius:9999px;
  font-size:10px; font-weight:700; letter-spacing:.06em; }
.mode-report { background:var(--chrome-report-bg); color:var(--chrome-report-text); }
.mode-live   { background:var(--chrome-live-bg);   color:var(--chrome-live-text); }
.mode-pip { width:7px; height:7px; border-radius:50%; }
.mode-report .mode-pip { background:var(--chrome-report-pip); }
.mode-live   .mode-pip { background:var(--chrome-live-pip); }
.mode-pip-pulse { animation:pv-pip-pulse 1.6s ease-in-out infinite; }
@keyframes pv-pip-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
@media (prefers-reduced-motion:reduce) { .mode-pip-pulse { animation:none; } }
`.trim();

function renderModeBadge(mode) {
  if (mode === 'live') {
    return `<span class="mode-badge mode-live" aria-label="Mode: Live" tabindex="0"><span class="mode-pip mode-pip-pulse"></span> LIVE</span>`;
  }
  return `<span class="mode-badge mode-report" aria-label="Mode: Report" tabindex="0"><span class="mode-pip"></span> REPORT</span>`;
}

function renderDashboardSwitcher(active) {
  const ps = active === 'plan-status' ? ' pv-seg-active' : '';
  const pp = active === 'pipeline' ? ' pv-seg-active' : '';
  const psHref = active === 'pipeline' ? 'plan-status.html' : '#';
  const ppHref = active === 'plan-status' ? 'dashboard.html' : '#';
  return `<div class="pv-seg-group"><a href="${psHref}" class="pv-seg${ps}">Plan-Status</a><a href="${ppHref}" class="pv-seg${pp}">Pipeline</a></div>`;
}

function renderThemeToggle() {
  return `<div class="pv-theme-segs" role="group" aria-label="Theme"><button class="pv-theme-btn active" data-theme="light" onclick="pvSetTheme('light')" aria-pressed="true">\u2600</button><button class="pv-theme-btn" data-theme="dark" onclick="pvSetTheme('dark')" aria-pressed="false">\u263e</button></div>`;
}

function renderChrome(mode, _data) {
  const active = mode === 'live' ? 'pipeline' : 'plan-status';
  return (
    `<style>${CHROME_CSS}</style>` +
    `<header class="pv-chrome" data-mode="${mode}">` +
    `<span class="pv-brand">PlanViz</span>` +
    renderDashboardSwitcher(active) +
    `<div class="pv-spacer"></div>` +
    renderModeBadge(mode) +
    `<button class="pv-iconbtn" onclick="document.getElementById('search-modal')?.showModal()" aria-label="Search">\u2318K</button>` +
    `<button class="pv-iconbtn" onclick="document.getElementById('about-modal')?.showModal()" aria-label="About">\u24d8</button>` +
    renderThemeToggle() +
    `</header>`
  );
}

module.exports = { renderChrome, renderModeBadge, renderDashboardSwitcher, renderThemeToggle, CHROME_CSS };
