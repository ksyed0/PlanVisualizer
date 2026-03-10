#!/usr/bin/env bash
# install.sh — Install PlanVisualizer into a target project
#
# Usage (run from your project root):
#   bash /path/to/PlanVisualizer/scripts/install.sh [TARGET_DIR]
#
# If TARGET_DIR is omitted the current directory is used.
# Idempotent — safe to re-run for updates.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET="${1:-$(pwd)}"

echo "[install] Installing PlanVisualizer into: $TARGET"

# ── 1. Copy tool files ──────────────────────────────────────────────────────
echo "[install] Copying tools/ ..."
cp -r "${REPO_ROOT}/tools" "${TARGET}/"

echo "[install] Copying tests/ ..."
cp -r "${REPO_ROOT}/tests" "${TARGET}/"

echo "[install] Copying jest.config.js ..."
cp "${REPO_ROOT}/jest.config.js" "${TARGET}/jest.config.js"

# ── 2. Copy GitHub Actions workflow ─────────────────────────────────────────
mkdir -p "${TARGET}/.github/workflows"
if [ -f "${REPO_ROOT}/.github/workflows/plan-visualizer.yml" ]; then
  echo "[install] Copying .github/workflows/plan-visualizer.yml ..."
  cp "${REPO_ROOT}/.github/workflows/plan-visualizer.yml" "${TARGET}/.github/workflows/plan-visualizer.yml"
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
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('[install] Scripts added: plan:test, plan:test:coverage, plan:generate');
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

# ── 5. Merge Claude Code stop hook into .claude/settings.json ───────────────
SETTINGS_DIR="${TARGET}/.claude"
SETTINGS_FILE="${SETTINGS_DIR}/settings.json"
mkdir -p "$SETTINGS_DIR"
if [ ! -f "$SETTINGS_FILE" ]; then
  cat > "$SETTINGS_FILE" <<'JSON'
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "node tools/capture-cost.js" }
        ]
      }
    ]
  }
}
JSON
  echo "[install] Created ${SETTINGS_FILE} with Stop hook."
else
  echo "[install] ${SETTINGS_FILE} already exists."
  echo "[install] Add this Stop hook manually if not present:"
  echo '  { "type": "command", "command": "node tools/capture-cost.js" }'
fi

echo ""
echo "[install] Done. Next steps:"
echo "  1. Edit plan-visualizer.config.json with your project name and file paths."
echo "  2. Run: npm install   (to install jest dev dependency)"
echo "  3. Run: npm run plan:test   (confirm all 9 suites pass)"
echo "  4. Run: node tools/generate-plan.js   (generates Docs/plan-status.html)"
