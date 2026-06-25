// tests/e2e/install.spec.js
//
// Suite 1: install.sh — verifies scripts/install.sh installs PlanVisualizer
// into a fresh target directory and behaves idempotently.
//
// Assertion adjustments vs task brief (verified by reading scripts/install.sh):
//
//   AC-1033d: install.sh does NOT copy docs/ID_REGISTRY.md. The docs/ directory
//             only receives coverage/ and pending-approvals/ subdirectories. The
//             test asserts the file is absent (not present).
//
//   AC-1033e: install.sh injects `plan:generate` (not `build`) into the target
//             package.json. Output lands at docs/plan-status.html (config.docs
//             .outputDir defaults to "docs"). The default config project name is
//             "My Project", so the HTML title is "My Project — Plan Status",
//             not "PlanVisualizer". Assertion uses 'Plan Status' instead.
//
//   AC-1036:  install.sh does NOT inject a `check:ids` npm script into the
//             target. The tool is available as node tools/check-id-registry.js.
//             It requires docs/ID_REGISTRY.md to exist; we seed a minimal one.
//
//   AC-1035:  install.sh does NOT check whether the target is a git repository
//             (no git rev-parse guard). Install succeeds on a non-git directory.
//             The test asserts success rather than failure.
//
// Interactive prompts: install.sh has read -p prompts for superpowers, claude-mem,
// and the Agentic Dashboard. When superpowers/claude-mem are already present those
// prompts are skipped. The Dashboard prompt always fires; we feed 'n\n' via stdin
// (runScript input option) so the script completes non-interactively.

'use strict';
const fs = require('fs');
const path = require('path');
const { createTempProject, runScript, assertHtml } = require('./helpers');

// Minimal ID_REGISTRY.md that satisfies check-id-registry.js when no source
// files exist yet (all sequences show "OK" because max-in-use = 0 < next = 1).
const MINIMAL_ID_REGISTRY = `# ID Registry

Single source of truth for the next available ID in every artefact sequence.

| **Sequence** | **Next Available ID** | **Last Assigned** |
| ------------ | --------------------- | ----------------- |
| EPIC         | EPIC-0001             | EPIC-0000         |
| US           | US-0001               | US-0000           |
| TASK         | TASK-0001             | TASK-0000         |
| AC           | AC-0001               | AC-0000           |
| TC           | TC-0001               | TC-0000           |
| BUG          | BUG-0001              | BUG-0000          |
| Lesson       | L-0001                | L-0000            |
| ENH          | ENH-0001              | ENH-0000          |
`;

// install.sh options used throughout the suite
const INSTALL_OPTS = { timeout: 120000, input: 'n\nn\nn\nn\nn\n' };

describe('Suite 1: install.sh', () => {
  describe('fresh install', () => {
    let proj;
    beforeAll(() => {
      proj = createTempProject();
      runScript('scripts/install.sh', [proj.dir], undefined, INSTALL_OPTS);
    }, 120000);
    afterAll(() => proj.cleanup());

    it('AC-1033a: CLAUDE.md exists in target', () => {
      expect(fs.existsSync(path.join(proj.dir, 'CLAUDE.md'))).toBe(true);
    });

    it('AC-1033b: AGENTS.md exists in target', () => {
      expect(fs.existsSync(path.join(proj.dir, 'AGENTS.md'))).toBe(true);
    });

    it('AC-1033c: plan-visualizer.config.json exists in target', () => {
      expect(fs.existsSync(path.join(proj.dir, 'plan-visualizer.config.json'))).toBe(true);
    });

    // install.sh does not copy docs/ID_REGISTRY.md — it is a project artefact
    // that teams create and maintain themselves (see AGENTS.md §4).
    it('AC-1033d: docs/ID_REGISTRY.md is not installed (teams create it themselves)', () => {
      expect(fs.existsSync(path.join(proj.dir, 'docs', 'ID_REGISTRY.md'))).toBe(false);
    });

    // install.sh injects plan:generate, not build. Output: docs/plan-status.html.
    // Default config name "My Project" → title "My Project — Plan Status".
    it('AC-1033e: npm run plan:generate produces docs/plan-status.html', () => {
      runScript('npm install', [], proj.dir, { timeout: 90000 });
      runScript('npm run plan:generate', [], proj.dir, { timeout: 60000 });
      // 'Plan Status' appears in the HTML <title>. '<<<' would indicate a merge
      // conflict marker. We do not exclude 'undefined' because chart.js (bundled
      // inline) legitimately contains that substring in its minified source.
      assertHtml(path.join(proj.dir, 'docs', 'plan-status.html'), {
        contains: ['Plan Status'],
        excludes: ['<<<'],
      });
    });

    // install.sh does not inject check:ids; call the tool directly.
    // Seed docs/ID_REGISTRY.md so the tool has something to read.
    it('AC-1036: node tools/check-id-registry.js exits 0 when registry exists', () => {
      const docsDir = path.join(proj.dir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'ID_REGISTRY.md'), MINIMAL_ID_REGISTRY);
      const toolPath = path.join(proj.dir, 'tools', 'check-id-registry.js');
      expect(() => runScript(`node "${toolPath}"`, [], proj.dir)).not.toThrow();
    });
  });

  describe('idempotency (AC-1034)', () => {
    let proj;
    beforeAll(() => {
      proj = createTempProject();
      runScript('scripts/install.sh', [proj.dir], undefined, INSTALL_OPTS);
      // Add a sentinel key to the config then re-run install
      const cfgPath = path.join(proj.dir, 'plan-visualizer.config.json');
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      cfg['e2e-sentinel'] = true;
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      runScript('scripts/install.sh', [proj.dir], undefined, INSTALL_OPTS);
    }, 120000);
    afterAll(() => proj.cleanup());

    it('sentinel key survives re-install', () => {
      const cfg = JSON.parse(fs.readFileSync(path.join(proj.dir, 'plan-visualizer.config.json'), 'utf8'));
      expect(cfg['e2e-sentinel']).toBe(true);
    });

    it('Stop hook is not duplicated in .claude/settings.json', () => {
      const settingsPath = path.join(proj.dir, '.claude', 'settings.json');
      if (!fs.existsSync(settingsPath)) return;
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const hooks = settings?.hooks?.Stop ?? [];
      const pvHooks = hooks.filter(
        (h) => JSON.stringify(h).includes('capture-cost') || JSON.stringify(h).includes('planvisualizer'),
      );
      expect(pvHooks.length).toBeLessThanOrEqual(1);
    });
  });

  // AC-1035: install.sh does NOT check for git (no git rev-parse guard).
  // A non-git directory is a valid install target. Verify install succeeds.
  describe('non-git target (AC-1035)', () => {
    it('install succeeds on a non-git directory', () => {
      const { dir, cleanup } = createTempProject({ skipGitInit: true });
      try {
        expect(() => runScript('scripts/install.sh', [dir], undefined, INSTALL_OPTS)).not.toThrow();
      } finally {
        cleanup();
      }
    });
  });
});
