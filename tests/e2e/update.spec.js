// tests/e2e/update.spec.js
//
// Suite 2: update.sh — verifies scripts/update.sh correctly updates an
// existing PlanVisualizer installation.
//
// Assertion adjustments vs task brief (verified by reading scripts/update.sh):
//
//   AC-1038: The brief used `npm run build` and checked `plan-status.html`
//            (project root). update.sh copies tools/ which uses plan:generate
//            (not build). Output lands at docs/plan-status.html per the default
//            config (docs.outputDir = "docs"). Updated to npm run plan:generate
//            and docs/plan-status.html.
//
//   AC-1039: update.sh does NOT create docs/.pv-state.json — that file is only
//            written by tools/pv-upgrade.js (run via pv-doctor / manual upgrade).
//            update.sh instead ensures .claude/settings.json has the Stop hook
//            and Bash allowlist. AC-1039 is re-scoped to assert that
//            .claude/settings.json contains the Stop hook (capture-cost.js),
//            which is the most important update.sh side-effect.
//
// Interactive prompts: update.sh has up to 3 read -p prompts depending on the
// environment:
//   - Line 54:  superpowers not installed → "Install superpowers? (y/n)"
//   - Line 84:  superpowers outdated → "Upgrade? (y/n)"
//   - Line 174: claude-mem not detected → "Install claude-mem? (y/n)"
// We feed 'n\nn\nn\n' via stdin to handle all three non-interactively.

'use strict';
const fs = require('fs');
const path = require('path');
const { createTempProject, runScript, assertHtml } = require('./helpers');

const FIXTURES = path.join(__dirname, 'fixtures');

// Options fed to every runScript call that invokes install.sh or update.sh.
// Three 'n' answers cover: superpowers-missing, superpowers-outdated (at most
// one fires), and claude-mem-missing — whichever subset triggers in CI.
const SH_OPTS = { timeout: 120000, input: 'n\nn\nn\n' };

// install.sh has up to 5 prompts so keep separate opts for install
const INSTALL_OPTS = { timeout: 120000, input: 'n\nn\nn\nn\nn\n' };

describe('Suite 2: update.sh', () => {
  let proj;

  beforeAll(() => {
    proj = createTempProject();
    // 1. Install first so update.sh has a valid target
    runScript('scripts/install.sh', [proj.dir], undefined, INSTALL_OPTS);

    // 2. Add a sentinel key before updating — must survive the update
    const cfgPath = path.join(proj.dir, 'plan-visualizer.config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg['e2e-update-sentinel'] = 'preserved';
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

    // 3. Run update.sh
    runScript('scripts/update.sh', [proj.dir], undefined, SH_OPTS);
  }, 180000);

  afterAll(() => proj.cleanup());

  // AC-1037: user-added config keys survive the update
  it('AC-1037: sentinel key in plan-visualizer.config.json is preserved after update', () => {
    const cfgPath = path.join(proj.dir, 'plan-visualizer.config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    expect(cfg['e2e-update-sentinel']).toBe('preserved');
  });

  // AC-1039 (re-scoped): update.sh does NOT produce docs/.pv-state.json
  // (that is pv-upgrade.js's responsibility). Instead assert that
  // .claude/settings.json was written and contains the Stop hook for
  // capture-cost.js — the primary update.sh side-effect.
  it('AC-1039: .claude/settings.json exists and contains the Stop hook after update', () => {
    const settingsPath = path.join(proj.dir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const stopHooks = settings?.hooks?.Stop ?? [];
    const hasHook = stopHooks.some((entry) =>
      (entry.hooks || []).some((h) => h.type === 'command' && h.command === 'node tools/capture-cost.js'),
    );
    expect(hasHook).toBe(true);
  });

  // AC-1038: after update, npm run plan:generate still produces valid HTML
  it('AC-1038: npm run plan:generate produces docs/plan-status.html post-update', () => {
    // Ensure npm deps are installed
    runScript('npm install', [], proj.dir, { timeout: 90000 });

    // Seed a fixture RELEASE_PLAN.md so the generator has input
    const docsDir = path.join(proj.dir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.copyFileSync(path.join(FIXTURES, 'RELEASE_PLAN.md'), path.join(docsDir, 'RELEASE_PLAN.md'));

    // Generate the dashboard
    runScript('npm run plan:generate', [], proj.dir, { timeout: 60000 });

    // Assert output is valid HTML with expected content.
    // Note: we do NOT exclude 'undefined' because chart.js (bundled inline)
    // legitimately contains that substring in its minified source — same
    // finding as the install suite (see install.spec.js AC-1033e).
    assertHtml(path.join(docsDir, 'plan-status.html'), {
      contains: ['Plan Status'],
      excludes: ['<<<'],
    });
  });
});
