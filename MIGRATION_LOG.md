# MIGRATION_LOG.md — Cross-Platform Change Log

Log every change that must propagate to other platforms, modules, or installations.

---

## 2026-03-18 — Install script: AGENTS.md overwrite replaced by plan_visualizer.md

**Files changed:** `scripts/install.sh`, `README.md`, `plan_visualizer.md` (new)
**Platforms / modules affected:** All target projects that install or update PlanVisualizer via `scripts/install.sh`
**What changed:**
- `plan_visualizer.md` is now the canonical format reference for PlanVisualizer source files. It replaces the previous approach of copying the full PlanVisualizer `AGENTS.md` into the target project.
- `install.sh` no longer offers to overwrite `AGENTS.md`. It instead copies `plan_visualizer.md` and appends a mandatory reference section to the target's `AGENTS.md` (append-only, idempotent, creates a minimal `AGENTS.md` if none exists).
- README manual setup, install prompt, and update sections updated accordingly.

**Adaptations completed:** Done in PlanVisualizer repo.
**Adaptations still needed for existing installs:**
1. Copy `plan_visualizer.md` from the PlanVisualizer repo into the project root.
2. Append the following to `AGENTS.md` (if not already present):
   ```
   ## PlanVisualizer Format Requirements
   Read plan_visualizer.md for the exact document formats required for RELEASE_PLAN.md,
   TEST_CASES.md, BUGS.md, AI_COST_LOG.md, and progress.md.
   ```
3. The old `AGENTS-new.md` file (if it exists from a previous install) can be deleted.
4. Optionally remove the PlanVisualizer BLAST framework sections from `AGENTS.md` if they were previously merged in and you have your own operating standards.

---

## 2026-03-10 — Jest 29 → 30

**Files changed:** `package.json`, `package-lock.json`
**Platforms / modules affected:** All target projects that have installed PlanVisualizer via `scripts/install.sh`
**What changed:** `jest` devDependency version `29.7.0` → `30.x`
**Why:** Eliminates `inflight@1.0.6` and `glob@7` deprecation warnings from transitive dependencies.
**Adaptations completed:** Updated in PlanVisualizer repo.
**Adaptations still needed:** Target projects that ran `install.sh` before 2026-03-10 still have `jest@29` in their `package.json`. They should run `npm install jest@30 --save-dev` to update.

---

## 2026-03-10 — GitHub Pages deployment fix

**Files changed:** `.github/workflows/plan-visualizer.yml`, `docs/index.html` (new)
**Platforms / modules affected:** PlanVisualizer repo GitHub Pages deployment only
**What changed:**
1. Removed the "Commit generated files" step from plan-visualizer.yml — `peaceiris/actions-gh-pages` deploys directly from the `./docs` filesystem; a commit-back step was never needed and failed because `plan-status.html` is gitignored.
2. Created `docs/index.html` with a `<meta http-equiv="refresh">` redirect to `plan-status.html` so GitHub Pages serves the dashboard instead of README.md.
3. Added `workflow_dispatch:` trigger so the workflow can be manually triggered when changes don't touch the `paths:` filter.
**Adaptations completed:** Done. Workflow re-triggered manually; dashboard now deploys correctly.
**Adaptations still needed:** None.

---

## 2026-03-10 — plan-visualizer.config.json outputDir case fix

**Files changed:** `plan-visualizer.config.json`
**Platforms / modules affected:** PlanVisualizer repo GitHub Pages deployment only
**What changed:** `docs.outputDir` changed from `"docs"` → `"docs"` to match the lowercase `docs/` directory and the workflow's `publish_dir: ./docs`.
**Why:** On macOS the filesystem is case-insensitive so `docs/` and `docs/` resolve identically. On Linux (GitHub Actions) they are separate directories — the generator wrote `plan-status.html` to `docs/` but the deploy action read from `docs/`, so the file was never deployed and the Pages site returned 404.
**Adaptations completed:** Done. Re-triggered workflow confirmed `plan-status.html` now appears in gh-pages branch.
**Adaptations still needed:** Any target project using `install.sh` that added `outputDir: "docs"` to their config should verify it matches `"docs"`.

---

## 2026-03-10 — plan-visualizer.config.json committed to this repo

**Files changed:** `.gitignore` (removal of `plan-visualizer.config.json` entry), new `plan-visualizer.config.json`
**Platforms / modules affected:** PlanVisualizer repo only — does not affect target project installations (their .gitignore is set up separately by install.sh)
**What changed:** Config file now tracked in PlanVisualizer's own repo for self-documentation and plan-visualizer.yml workflow
**Adaptations completed:** Done.
**Adaptations still needed:** None.
