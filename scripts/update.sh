#!/usr/bin/env bash
# update.sh — Update PlanVisualizer tools in an existing installation
#
# Usage (run from your project root):
#   bash /path/to/PlanVisualizer/scripts/update.sh [TARGET_DIR]
#
# What it does:
#   - Re-copies tools/, tests/, jest.config.js, eslint.config.js
#   - Re-copies orchestrator/ (atomic-write, file-lock, etc.)
#   - Appends any missing CLAUDE.md PlanVisualizer section
#   - Re-runs migrate-config.js to add any new config keys
#   - Ensures Stop hook and Bash allowlist are in .claude/settings.json
#   - Does NOT overwrite plan-visualizer.config.json or AGENTS.md content
#   - Does NOT overwrite docs/BUGS.md, docs/RELEASE_PLAN.md, or any user data

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET="${1:-$(pwd)}"

# ── Bootstrap: when run via `bash <(curl ...)` REPO_ROOT resolves to /dev.
#    Detect that case and clone the repo to a temp dir, then re-execute.
if [ ! -d "${REPO_ROOT}/tools" ] || [ ! -d "${REPO_ROOT}/docs/agents" ]; then
  echo "[update] Source tree not found at ${REPO_ROOT} — bootstrapping clone..."
  BRANCH="${PLAN_VISUALIZER_BRANCH:-develop}"
  CLONE_DIR="$(mktemp -d -t pv-update-XXXXXX)"
  echo "[update] Cloning ksyed0/PlanVisualizer branch '$BRANCH' into $CLONE_DIR ..."
  echo "[update] (this may take a few seconds — git output below)"
  echo ""
  if ! git clone --depth 1 --branch "$BRANCH" --progress https://github.com/ksyed0/PlanVisualizer.git "$CLONE_DIR"; then
    echo ""
    echo "[update] ERROR: git clone failed. Check network / branch name '$BRANCH'." >&2
    exit 1
  fi
  echo ""
  echo "[update] Bootstrap clone complete ($(du -sh "$CLONE_DIR" 2>/dev/null | cut -f1) total)."
  echo "[update] Re-executing updater from clone with TARGET=$TARGET ..."
  echo ""
  exec bash "$CLONE_DIR/scripts/update.sh" "$TARGET"
fi

echo "[update] Updating PlanVisualizer in: $TARGET"
echo "[update] Source version: $(node -e "console.log(require('${REPO_ROOT}/package.json').version)" 2>/dev/null || echo 'unknown')"

# ── 0. Check superpowers plugin ─────────────────────────────────────────────
# See: https://github.com/obra/superpowers
SP_BASE="$HOME/.claude/plugins/cache/claude-plugins-official/superpowers"
SP_VER=$(ls "$SP_BASE" 2>/dev/null | sort -V | tail -1)

if [ -z "$SP_VER" ]; then
  echo ""
  echo "[update] superpowers plugin not detected."
  read -p "[update] Install superpowers for enhanced agent workflows? (y/n) " -n 1 -r; echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[update] Run inside a Claude Code session, then re-run update.sh:"
    echo ""
    echo "  /plugin install superpowers@claude-plugins-official"
    echo ""
    echo "  See: https://github.com/obra/superpowers"
    echo ""
    exit 0
  else
    echo "[update] Skipping superpowers. Skills are optional when not installed."
    echo ""
  fi
else
  echo "[update] superpowers v${SP_VER} detected — checking for updates..."
  SP_LATEST=$(curl -fsSL --max-time 5 \
    "https://api.github.com/repos/obra/superpowers/releases/latest" \
    2>/dev/null | grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  SP_VER_CLEAN="${SP_VER#v}"
  SP_LATEST_CLEAN="${SP_LATEST#v}"
  if [ -z "$SP_LATEST_CLEAN" ]; then
    echo "[update] superpowers v${SP_VER} ✓ (version check failed — skipping)"
  elif [ "$SP_VER_CLEAN" = "$SP_LATEST_CLEAN" ]; then
    echo "[update] superpowers v${SP_VER} ✓ (up to date)"
  else
    OLDER=$(printf '%s\n%s' "$SP_VER_CLEAN" "$SP_LATEST_CLEAN" | sort -V | head -1)
    if [ "$OLDER" = "$SP_VER_CLEAN" ]; then
      echo ""
      echo "[update] superpowers v${SP_VER} installed — v${SP_LATEST_CLEAN} is available."
      read -p "[update] Upgrade? (y/n) " -n 1 -r; echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "[update] Run inside a Claude Code session, then re-run update.sh:"
        echo ""
        echo "  /plugin install superpowers@claude-plugins-official"
        echo ""
        echo "  See: https://github.com/obra/superpowers"
        echo ""
        exit 0
      fi
    else
      echo "[update] superpowers v${SP_VER} ✓ (up to date)"
    fi
  fi
fi

# ── 0.1. Check claude-mem plugin ────────────────────────────────────────────
# claude-mem provides persistent cross-session memory for Claude Code.
CM_SETTINGS="$HOME/.claude-mem/settings.json"
CM_BASE="$HOME/.claude/plugins/cache/thedotmack/claude-mem"
CM_VER=$(ls "$CM_BASE" 2>/dev/null | sort -V | tail -1)

# verify_claude_mem_health — guard against BUG-0264.
# claude-mem registers its OWN Stop hook (scripts/worker-service.cjs). An
# interrupted version upgrade can leave a stale version directory in the plugin
# cache with incomplete node_modules; Claude Code may still invoke that stale
# worker, which then crashes the Stop hook with "Cannot find module 'zod/v3'".
# PlanVisualizer triggers the claude-mem install/update above, so we verify the
# active worker can resolve its deps (repairing if not) and flag stale copies.
# $1 = log prefix ("install" / "update"). Never fatal — advisory only.
verify_claude_mem_health() {
  local prefix="$1"
  command -v node >/dev/null 2>&1 || return 0   # node needed to verify; skip silently
  [ -d "$CM_BASE" ] || return 0

  # The version Claude Code actually loads is the installPath in
  # installed_plugins.json; fall back to the highest cached version.
  local pinned_path pinned_scripts pinned_ver stale
  pinned_path=$(node -e '
    try {
      const j = require(process.env.HOME + "/.claude/plugins/installed_plugins.json");
      const e = (j["claude-mem@thedotmack"] || []).find(x => x && x.installPath) || {};
      process.stdout.write(e.installPath || "");
    } catch (_) { process.stdout.write(""); }
  ' 2>/dev/null || true)
  if [ -z "$pinned_path" ] && [ -n "${CM_VER:-}" ]; then
    pinned_path="$CM_BASE/$CM_VER"
  fi
  [ -n "$pinned_path" ] || return 0
  pinned_scripts="$pinned_path/scripts"

  if node -e "require.resolve('zod/v3', { paths: ['$pinned_scripts'] })" >/dev/null 2>&1; then
    echo "[$prefix] claude-mem worker dependencies verified ✓"
  else
    echo "[$prefix] Warning: claude-mem worker is missing dependencies (zod/v3 unresolved)."
    echo "[$prefix] This causes 'Cannot find module zod/v3' Stop hook errors — repairing..."
    npx claude-mem install || true
    if node -e "require.resolve('zod/v3', { paths: ['$pinned_scripts'] })" >/dev/null 2>&1; then
      echo "[$prefix] claude-mem worker dependencies repaired ✓"
    else
      echo "[$prefix] Warning: repair did not resolve it. Fix manually with:"
      echo "[$prefix]   rm -rf \"$CM_BASE\" && npx claude-mem install"
    fi
  fi

  # Flag stale (non-pinned) version dirs — the actual trigger for spurious
  # Stop-hook crashes after an interrupted upgrade.
  pinned_ver=$(basename "$pinned_path")
  stale=$(ls "$CM_BASE" 2>/dev/null | grep -vx "$pinned_ver" || true)
  if [ -n "$stale" ]; then
    echo "[$prefix] Note: stale claude-mem version(s) in cache (active: $pinned_ver):"
    echo "$stale" | sed "s#^#[$prefix]   - stale: #"
    echo "[$prefix] These can fire broken Stop hooks. Remove safely with:"
    echo "$stale" | sed "s#^#[$prefix]   rm -rf $CM_BASE/#"
  fi
}

if [ -f "$CM_SETTINGS" ]; then
  if [ -n "$CM_VER" ]; then
    echo "[update] Updating claude-mem (v${CM_VER} installed)..."
  else
    echo "[update] Updating claude-mem..."
  fi
  npx claude-mem update 2>&1 || echo "[update] Warning: claude-mem update failed — continuing."
  echo ""
  verify_claude_mem_health update
else
  echo ""
  echo "[update] claude-mem not detected."
  read -p "[update] Install claude-mem for persistent cross-session memory? (y/n) " -n 1 -r; echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[update] Running: npx claude-mem install"
    echo ""
    npx claude-mem install || true
    if [ -f "$CM_SETTINGS" ]; then
      echo ""
      echo "[update] claude-mem installed successfully ✓"
      echo ""
      verify_claude_mem_health update
    else
      echo ""
      echo "[update] Warning: claude-mem install may have failed."
      echo "[update] Retry manually with: npx claude-mem install"
      echo ""
    fi
  else
    echo "[update] Skipping. Install with: npx claude-mem install"
    echo ""
  fi
fi

# ── 0.5. Ensure US-0181 orchestration directories exist ─────────────────────
mkdir -p "${TARGET}/docs/pending-approvals"
if [ ! -f "${TARGET}/docs/pending-approvals/.gitkeep" ]; then
  touch "${TARGET}/docs/pending-approvals/.gitkeep"
fi

# ── 1. Re-copy tool files (non-destructive to user data) ────────────────────
echo "[update] Updating tools/ ..."
cp -r "${REPO_ROOT}/tools" "${TARGET}/"

echo "[update] Updating tests/ ..."
cp -r "${REPO_ROOT}/tests" "${TARGET}/"

echo "[update] Updating orchestrator/ ..."
mkdir -p "${TARGET}/orchestrator"
cp -r "${REPO_ROOT}/orchestrator" "${TARGET}/"

echo "[update] Updating jest.config.js ..."
cp "${REPO_ROOT}/jest.config.js" "${TARGET}/jest.config.js"

echo "[update] Updating eslint.config.js ..."
cp "${REPO_ROOT}/eslint.config.js" "${TARGET}/eslint.config.js"

# ── 2. Update GitHub Actions workflow ────────────────────────────────────────
mkdir -p "${TARGET}/.github/workflows"
if [ -f "${REPO_ROOT}/.github/workflows/plan-visualizer.yml" ]; then
  echo "[update] Updating .github/workflows/plan-visualizer.yml ..."
  cp "${REPO_ROOT}/.github/workflows/plan-visualizer.yml" "${TARGET}/.github/workflows/plan-visualizer.yml"
fi

# ── 3. Update scripts/cleanup-branches.sh ────────────────────────────────────
mkdir -p "${TARGET}/scripts"
if [ -f "${REPO_ROOT}/scripts/cleanup-branches.sh" ]; then
  echo "[update] Updating scripts/cleanup-branches.sh ..."
  cp "${REPO_ROOT}/scripts/cleanup-branches.sh" "${TARGET}/scripts/cleanup-branches.sh"
  chmod +x "${TARGET}/scripts/cleanup-branches.sh"
fi

# ── 4. Update plan_visualizer.md format spec ─────────────────────────────────
if [ -f "${REPO_ROOT}/plan_visualizer.md" ]; then
  echo "[update] Updating plan_visualizer.md ..."
  cp "${REPO_ROOT}/plan_visualizer.md" "${TARGET}/plan_visualizer.md"
fi

# ── 5. Ensure CLAUDE.md has PlanVisualizer section ───────────────────────────
CLAUDE_DEST="${TARGET}/CLAUDE.md"
if [ ! -f "$CLAUDE_DEST" ]; then
  echo "[update] CLAUDE.md missing — creating from template ..."
  cp "${REPO_ROOT}/CLAUDE.md.template" "$CLAUDE_DEST"
  echo "[update] CLAUDE.md created."
elif ! grep -q "PlanVisualizer Dashboard" "$CLAUDE_DEST"; then
  echo "[update] Appending PlanVisualizer section to CLAUDE.md ..."
  cat >> "$CLAUDE_DEST" <<'MD'

---

## PlanVisualizer Dashboard

- **Entry point:** `node tools/generate-plan.js`
- **Output:** `docs/plan-status.html`
- **Config:** `plan-visualizer.config.json`
- **Format guide:** `plan_visualizer.md`

Run `npm run plan:generate` to regenerate the dashboard after changes to tracked docs.
MD
  echo "[update] Appended PlanVisualizer section to CLAUDE.md."
else
  echo "[update] CLAUDE.md already has PlanVisualizer section — skipping."
fi

# ── 6. Migrate config to latest schema ───────────────────────────────────────
if [ -f "${TARGET}/tools/migrate-config.js" ]; then
  echo "[update] Checking config schema ..."
  (cd "$TARGET" && node "${TARGET}/tools/migrate-config.js" --auto) || true
fi

# ── 7. Ensure hooks and Bash allowlist in .claude/settings.json ──────────────
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
    console.error('[update] Warning: could not parse ' + filePath + ' — skipping hook merge.');
    process.exit(0);
  }
}

settings.hooks = settings.hooks || {};
settings.hooks.Stop = settings.hooks.Stop || [];
const hookCmd = 'node tools/capture-cost.js';
const stopPresent = settings.hooks.Stop.some(
  entry => (entry.hooks || []).some(h => h.type === 'command' && h.command === hookCmd)
);
if (!stopPresent) {
  settings.hooks.Stop.push({ hooks: [{ type: 'command', command: hookCmd }] });
  console.log('[update] Added Stop hook (capture-cost.js)');
} else {
  console.log('[update] Stop hook already present — skipping.');
}

settings.permissions = settings.permissions || {};
settings.permissions.allow = settings.permissions.allow || [];
const bashAllowlist = [
  'Bash(npm run plan:*)',
  'Bash(node tools/generate-plan.js*)',
  'Bash(node tools/generate-dashboard.js*)',
  'Bash(node tools/update-sdlc-status.js*)',
  'Bash(node tools/migrate-config.js*)',
  'Bash(npx jest*)',
  'Bash(git status)',
  'Bash(git log*)',
  'Bash(git diff*)',
  'Bash(git branch*)',
  'Bash(git fetch*)',
];
let added = 0;
for (const entry of bashAllowlist) {
  if (!settings.permissions.allow.includes(entry)) {
    settings.permissions.allow.push(entry);
    added++;
  }
}
if (added > 0) console.log('[update] Added ' + added + ' Bash allowlist entries');
else console.log('[update] Bash allowlist already up to date — skipping.');

fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
JS

# ── 8. Merge any new npm scripts ─────────────────────────────────────────────
TARGET_PKG="${TARGET}/package.json"
if [ -f "$TARGET_PKG" ]; then
  node - <<'JS' "$TARGET_PKG"
const fs = require('fs');
const pkgPath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
const toAdd = {
  'plan:test':               'jest --watchAll=false',
  'plan:test:coverage':      'jest --watchAll=false --coverage',
  'plan:generate':           'node tools/generate-plan.js',
  'plan:cleanup':            'bash scripts/cleanup-branches.sh',
  'plan:cleanup:dry':        'bash scripts/cleanup-branches.sh --dry-run',
  'plan:migrate-config':     'node tools/migrate-config.js',
  'plan:migrate-config:dry': 'node tools/migrate-config.js --dry-run',
  'memory:compact':          'node tools/memory.js compact',
  'memory:archive':          'node tools/memory.js archive',
  'memory:migrate':          'node tools/memory.js migrate',
  'memory:migrate-commit':   'node tools/memory.js migrate-commit',
  'memory:suggest-model':    'node tools/memory.js suggest-model',
  'memory:validate':         'node tools/memory.js validate',
  'agent:approve':           'node tools/agent-spec-plan.js approve',
  'agent:reject':            'node tools/agent-spec-plan.js reject',
  'agent:pending':           'node tools/agent-spec-plan.js show-pending',
  'agent:apply':             'node tools/agent-spec-plan.js apply-pending',
  'agent:list':              'node tools/agent-spec-plan.js list',
  'agent:status':            'node tools/agent-spec-plan.js status',
  'dashboard:watch':         'node tools/watch-dashboard.js',
};
let added = 0;
for (const [k, v] of Object.entries(toAdd)) {
  if (!pkg.scripts[k]) { pkg.scripts[k] = v; added++; }
}

// Required dev dependencies — match PlanVisualizer's own package.json.
pkg.devDependencies = pkg.devDependencies || {};
const requiredDevDeps = {
  '@eslint/js': '10.0.1',
  'chart.js': '^4.5.1',
  'eslint': '10.2.1',
  'husky': '^9.1.7',
  'jest': '^30.3.0',
  'lint-staged': '^16.4.0',
  'prettier': '^3.8.3',
};
let depsAdded = 0;
for (const [name, version] of Object.entries(requiredDevDeps)) {
  if (!pkg.devDependencies[name]) { pkg.devDependencies[name] = version; depsAdded++; }
}

if (added > 0 || depsAdded > 0) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  if (added > 0) console.log('[update] Added ' + added + ' new npm scripts to package.json');
  if (depsAdded > 0) console.log('[update] Added ' + depsAdded + ' missing devDependencies — run `npm install` to install them');
} else {
  console.log('[update] npm scripts and devDependencies already up to date — skipping.');
}
JS
fi

# ── 9. Update Agentic Dashboard files if installed ───────────────────────────
if [ -f "${TARGET}/docs/dashboard.html" ]; then
  echo "[update] Updating docs/dashboard.html ..."
  [ -f "${REPO_ROOT}/docs/dashboard.html" ] && cp "${REPO_ROOT}/docs/dashboard.html" "${TARGET}/docs/dashboard.html"
  echo "[update] Updating orchestrator/ ..."
  mkdir -p "${TARGET}/orchestrator"
  cp -r "${REPO_ROOT}/orchestrator/." "${TARGET}/orchestrator/"
  for f in tools/update-sdlc-status.js tools/init-sdlc-status.js; do
    [ -f "${REPO_ROOT}/${f}" ] && cp "${REPO_ROOT}/${f}" "${TARGET}/${f}"
  done
  # agents.config.json — copy canonical roster if absent
  if [ ! -f "${TARGET}/agents.config.json" ]; then
    SRC="${REPO_ROOT}/agents.config.json"
    [ ! -f "$SRC" ] && SRC="${REPO_ROOT}/agents.config.example.json"
    [ -f "$SRC" ] && cp "$SRC" "${TARGET}/agents.config.json" && echo "[update] Copied agents.config.json."
  fi
  # docs/agents/ — always refresh instruction files + portraits (standardised assets)
  if [ -d "${REPO_ROOT}/docs/agents" ]; then
    mkdir -p "${TARGET}/docs/agents"
    cp -r "${REPO_ROOT}/docs/agents/." "${TARGET}/docs/agents/"
    echo "[update] Updated docs/agents/ (instruction files + portraits)."
  fi
  echo "[update] Agentic Dashboard files updated."
else
  echo "[update] Agentic Dashboard not installed — skipping (run install.sh to add it)."
fi

echo ""
echo "[update] Done. Run 'npm run plan:test' to verify the update."
