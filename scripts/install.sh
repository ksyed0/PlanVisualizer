#!/usr/bin/env bash
# install.sh — Install PlanVisualizer into a target project
#
# Usage (run from your project root):
#   bash /path/to/PlanVisualizer/scripts/install.sh [TARGET_DIR]
#
# If TARGET_DIR is omitted the current directory is used.
# Idempotent — all steps including the Stop hook merge are safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET="${1:-$(pwd)}"

echo "[install] Installing PlanVisualizer into: $TARGET"

# ── 0. Check superpowers plugin ─────────────────────────────────────────────
# superpowers enhances agent workflows via structured skill invocations.
# Cannot be auto-installed — it requires a Claude Code slash command.
SP_BASE="$HOME/.claude/plugins/cache/claude-plugins-official/superpowers"
if [ ! -d "$SP_BASE" ]; then
  echo ""
  echo "[install] superpowers plugin not detected at $SP_BASE"
  read -p "[install] Install superpowers for enhanced agent workflows? (y/n) " -n 1 -r; echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[install] Run the following inside a Claude Code session, then re-run install.sh:"
    echo ""
    echo "  /plugin install superpowers@claude-plugins-official"
    echo ""
    exit 0
  else
    echo "[install] Skipping superpowers. Agent files note skills are optional when not installed."
    echo ""
  fi
else
  SP_VER=$(ls "$SP_BASE" | sort -V | tail -1)
  echo "[install] superpowers plugin detected (v${SP_VER}) ✓"
fi

# ── 1. Copy tool files ──────────────────────────────────────────────────────
echo "[install] Copying tools/ ..."
cp -r "${REPO_ROOT}/tools" "${TARGET}/"

echo "[install] Copying tests/ ..."
cp -r "${REPO_ROOT}/tests" "${TARGET}/"

echo "[install] Copying jest.config.js ..."
cp "${REPO_ROOT}/jest.config.js" "${TARGET}/jest.config.js"

echo "[install] Copying eslint.config.js ..."
cp "${REPO_ROOT}/eslint.config.js" "${TARGET}/eslint.config.js"

# ── 1.5. Copy branch hygiene tooling ────────────────────────────────────────
# scripts/cleanup-branches.sh sweeps stale worktrees + merged branches left
# behind by the DM_AGENT pipeline (auto-merge can't delete refs held by a
# local worktree). Idempotent; PR-state gated so it never kills an open PR.
mkdir -p "${TARGET}/scripts"
if [ -f "${REPO_ROOT}/scripts/cleanup-branches.sh" ]; then
  echo "[install] Copying scripts/cleanup-branches.sh ..."
  cp "${REPO_ROOT}/scripts/cleanup-branches.sh" "${TARGET}/scripts/cleanup-branches.sh"
  chmod +x "${TARGET}/scripts/cleanup-branches.sh"
fi

# ── 2. Copy GitHub Actions workflow ─────────────────────────────────────────
mkdir -p "${TARGET}/.github/workflows"
if [ -f "${REPO_ROOT}/.github/workflows/plan-visualizer.yml" ]; then
  echo "[install] Copying .github/workflows/plan-visualizer.yml ..."
  cp "${REPO_ROOT}/.github/workflows/plan-visualizer.yml" "${TARGET}/.github/workflows/plan-visualizer.yml"
fi

# ── 2.5. Copy plan_visualizer.md ────────────────────────────────────────────
if [ -f "${REPO_ROOT}/plan_visualizer.md" ]; then
  echo "[install] Copying plan_visualizer.md ..."
  cp "${REPO_ROOT}/plan_visualizer.md" "${TARGET}/plan_visualizer.md"
  echo "[install] plan_visualizer.md copied."
else
  echo "[install] Warning: plan_visualizer.md not found in repo root — skipping."
fi

# ── 2.6. Inject PlanVisualizer reference into AGENTS.md ─────────────────────
AGENTS_DEST="${TARGET}/AGENTS.md"
PV_MARKER="## PlanVisualizer Format Requirements"
if [ -f "$AGENTS_DEST" ]; then
  if grep -q "$PV_MARKER" "$AGENTS_DEST"; then
    echo "[install] AGENTS.md already references plan_visualizer.md — skipping."
  else
    cat >> "$AGENTS_DEST" <<'MD'

---

## PlanVisualizer Format Requirements

This project uses PlanVisualizer. Read **plan_visualizer.md** (in this project root) for the
exact document formats required for RELEASE_PLAN.md, TEST_CASES.md, BUGS.md, AI_COST_LOG.md,
and progress.md. Consult it whenever creating or updating any of these files.
MD
    echo "[install] Appended PlanVisualizer reference to AGENTS.md."
  fi
else
  echo "[install] No AGENTS.md found — creating one referencing plan_visualizer.md ..."
  cat > "$AGENTS_DEST" <<'MD'
# AGENTS.md

## PlanVisualizer Format Requirements

This project uses PlanVisualizer. Read **plan_visualizer.md** (in this project root) for the
exact document formats required for RELEASE_PLAN.md, TEST_CASES.md, BUGS.md, AI_COST_LOG.md,
and progress.md. Consult it whenever creating or updating any of these files.
MD
  echo "[install] Created AGENTS.md with PlanVisualizer reference."
fi

# ── 3. Merge npm scripts into target package.json ────────────────────────────
TARGET_PKG="${TARGET}/package.json"
if [ -f "$TARGET_PKG" ]; then
  echo "[install] Merging npm scripts into ${TARGET_PKG} ..."
  # Use node to merge scripts — avoids jq dependency
  node - <<'JS' "$TARGET_PKG"
const fs = require('fs');
const pkgPath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts['plan:test'] = pkg.scripts['plan:test'] || 'jest --watchAll=false';
pkg.scripts['plan:test:coverage'] = pkg.scripts['plan:test:coverage'] || 'jest --watchAll=false --coverage';
pkg.scripts['plan:generate'] = pkg.scripts['plan:generate'] || 'node tools/generate-plan.js';
pkg.scripts['plan:cleanup'] = pkg.scripts['plan:cleanup'] || 'bash scripts/cleanup-branches.sh';
pkg.scripts['plan:cleanup:dry'] = pkg.scripts['plan:cleanup:dry'] || 'bash scripts/cleanup-branches.sh --dry-run';
pkg.scripts['plan:migrate-config'] = pkg.scripts['plan:migrate-config'] || 'node tools/migrate-config.js';
pkg.scripts['plan:migrate-config:dry'] = pkg.scripts['plan:migrate-config:dry'] || 'node tools/migrate-config.js --dry-run';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('[install] Scripts added: plan:test, plan:test:coverage, plan:generate, plan:cleanup, plan:cleanup:dry, plan:migrate-config, plan:migrate-config:dry');
JS
else
  echo "[install] Warning: no package.json found at ${TARGET} — skipping script merge."
fi

# ── 4. Create config file if absent ─────────────────────────────────────────
TARGET_CFG="${TARGET}/plan-visualizer.config.json"
if [ ! -f "$TARGET_CFG" ]; then
  echo "[install] Creating plan-visualizer.config.json from example ..."
  cp "${REPO_ROOT}/plan-visualizer.config.example.json" "$TARGET_CFG"
  echo "[install] Edit ${TARGET_CFG} to set your project name and file paths."
else
  echo "[install] plan-visualizer.config.json already exists — skipping."
fi

# ── 4.5. Migrate existing configs to latest schema ──────────────────────────
# Idempotent: adds any required fields the latest tools/* expect (e.g.
# docs.lessons, agents.<name>.avatar) that early installs are missing.
# Preserves user values; only appends missing keys. --auto suppresses output
# when nothing needs migrating, keeping the installer log clean.
if [ -f "${TARGET}/tools/migrate-config.js" ]; then
  echo "[install] Checking config schema ..."
  (cd "$TARGET" && node "${TARGET}/tools/migrate-config.js" --auto) || true
fi

# ── 5. Merge Claude Code stop hook into .claude/settings.json ───────────────
SETTINGS_DIR="${TARGET}/.claude"
SETTINGS_FILE="${SETTINGS_DIR}/settings.json"
mkdir -p "$SETTINGS_DIR"
node - <<'JS' "$SETTINGS_FILE"
const fs = require('fs');
const path = require('path');
const filePath = process.argv[2];

let settings = {};
if (fs.existsSync(filePath)) {
  try { settings = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) {
    console.error('[install] Warning: could not parse ' + filePath + ' — skipping hook merge.');
    process.exit(0);
  }
}

settings.hooks = settings.hooks || {};
settings.hooks.Stop = settings.hooks.Stop || [];

const hookCmd = 'node tools/capture-cost.js';
const alreadyPresent = settings.hooks.Stop.some(
  entry => (entry.hooks || []).some(h => h.type === 'command' && h.command === hookCmd)
);

if (alreadyPresent) {
  console.log('[install] Stop hook already present in ' + path.basename(filePath) + ' — skipping.');
  process.exit(0);
}

settings.hooks.Stop.push({
  hooks: [{ type: 'command', command: hookCmd }]
});

fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
console.log('[install] Merged Stop hook into ' + filePath);
JS

# ── 6. Prompt for historical data backfill ─────────────────────────────────────
if [ -f "${TARGET}/docs/plan-status.json" ]; then
  echo ""
  echo "[install] PlanVisualizer has detected existing project data."
  read -p "[install] Would you like to estimate historical data? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "[install] Running historical backfill..."
    node -e "
      const { backfillHistory } = require('${TARGET}/tools/lib/historical-sim.js');
      backfillHistory({ root: '${TARGET}', days: 30 });
    " || echo "[install] Warning: Failed to run backfill — this is normal on first install."
  else
    echo "[install] Skipping historical backfill. History will build naturally from real generations."
  fi
fi

# ── 7. Dashboard setup ────────────────────────────────────────────────────────
echo ""
echo "[install] Agentic SDLC Dashboard setup"
read -p "[install] Copy dashboard files to ${TARGET}/docs? (y/n) " -n 1 -r REPLY; echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  mkdir -p "${TARGET}/docs" "${TARGET}/tools" "${TARGET}/orchestrator"
  for f in docs/dashboard.html; do
    if [ -f "${REPO_ROOT}/${f}" ] && [ ! -f "${TARGET}/${f}" ]; then
      cp "${REPO_ROOT}/${f}" "${TARGET}/${f}"
      echo "[install] Copied ${f}"
    else
      echo "[install] Skipping ${f} (already exists or source missing)"
    fi
  done
  for f in tools/update-sdlc-status.js tools/init-sdlc-status.js; do
    [ -f "${REPO_ROOT}/${f}" ] && cp "${REPO_ROOT}/${f}" "${TARGET}/${f}" && echo "[install] Copied ${f}"
  done
  [ -f "${REPO_ROOT}/orchestrator/atomic-write.js" ] && \
    cp "${REPO_ROOT}/orchestrator/atomic-write.js" "${TARGET}/orchestrator/atomic-write.js"
  echo "[install] Run: node tools/init-sdlc-status.js   (after adding project/phases to agents.config.json)"
  echo "[install] See: docs/dashboard-extraction.md for the full adoption guide"
fi

echo ""
echo "[install] Done. Next steps:"
echo "  1. Edit plan-visualizer.config.json with your project name and file paths."
echo "  2. Run: npm install   (to install jest dev dependency)"
echo "  3. Run: npm run plan:test   (confirm all suites pass)"
echo "  4. Run: node tools/generate-plan.js   (generates docs/plan-status.html)"
