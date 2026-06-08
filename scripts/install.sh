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

# ── Bootstrap: when run via `bash <(curl ...)` REPO_ROOT resolves to /dev,
#    which doesn't contain the source tree. Detect that case and clone the
#    repo to a temp dir, then re-execute from the clone.
if [ ! -d "${REPO_ROOT}/tools" ] || [ ! -d "${REPO_ROOT}/docs/agents" ]; then
  echo "[install] Source tree not found at ${REPO_ROOT} — bootstrapping clone..."
  BRANCH="${PLAN_VISUALIZER_BRANCH:-develop}"
  CLONE_DIR="$(mktemp -d -t pv-install-XXXXXX)"
  echo "[install] Cloning ksyed0/PlanVisualizer branch '$BRANCH' into $CLONE_DIR ..."
  echo "[install] (this may take a few seconds — git output below)"
  echo ""
  # --progress forces git to show progress even when stderr isn't a TTY
  if ! git clone --depth 1 --branch "$BRANCH" --progress https://github.com/ksyed0/PlanVisualizer.git "$CLONE_DIR"; then
    echo ""
    echo "[install] ERROR: git clone failed. Check network / branch name '$BRANCH'." >&2
    exit 1
  fi
  echo ""
  echo "[install] Bootstrap clone complete ($(du -sh "$CLONE_DIR" 2>/dev/null | cut -f1) total)."
  echo "[install] Re-executing installer from clone with TARGET=$TARGET ..."
  echo ""
  exec bash "$CLONE_DIR/scripts/install.sh" "$TARGET"
fi

echo "[install] Installing PlanVisualizer into: $TARGET"

# ── 0. Check superpowers plugin ─────────────────────────────────────────────
# superpowers enhances agent workflows via structured skill invocations.
# Cannot be auto-installed — requires a Claude Code slash command.
# See: https://github.com/obra/superpowers
SP_BASE="$HOME/.claude/plugins/cache/claude-plugins-official/superpowers"
SP_VER=$(ls "$SP_BASE" 2>/dev/null | sort -V | tail -1)

if [ -z "$SP_VER" ]; then
  echo ""
  echo "[install] superpowers plugin not detected."
  read -p "[install] Install superpowers for enhanced agent workflows? (y/n) " -n 1 -r; echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[install] Run inside a Claude Code session, then re-run install.sh:"
    echo ""
    echo "  /plugin install superpowers@claude-plugins-official"
    echo ""
    echo "  See: https://github.com/obra/superpowers"
    echo ""
    exit 0
  else
    echo "[install] Skipping superpowers. Skills are optional when not installed."
    echo ""
  fi
else
  echo "[install] superpowers v${SP_VER} detected — checking for updates..."
  SP_LATEST=$(curl -fsSL --max-time 5 \
    "https://api.github.com/repos/obra/superpowers/releases/latest" \
    2>/dev/null | grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  SP_VER_CLEAN="${SP_VER#v}"
  SP_LATEST_CLEAN="${SP_LATEST#v}"
  if [ -z "$SP_LATEST_CLEAN" ]; then
    echo "[install] superpowers v${SP_VER} ✓ (version check failed — skipping)"
  elif [ "$SP_VER_CLEAN" = "$SP_LATEST_CLEAN" ]; then
    echo "[install] superpowers v${SP_VER} ✓ (up to date)"
  else
    OLDER=$(printf '%s\n%s' "$SP_VER_CLEAN" "$SP_LATEST_CLEAN" | sort -V | head -1)
    if [ "$OLDER" = "$SP_VER_CLEAN" ]; then
      echo ""
      echo "[install] superpowers v${SP_VER} installed — v${SP_LATEST_CLEAN} is available."
      read -p "[install] Upgrade? (y/n) " -n 1 -r; echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "[install] Run inside a Claude Code session, then re-run install.sh:"
        echo ""
        echo "  /plugin install superpowers@claude-plugins-official"
        echo ""
        echo "  See: https://github.com/obra/superpowers"
        echo ""
        exit 0
      fi
    else
      echo "[install] superpowers v${SP_VER} ✓ (up to date)"
    fi
  fi
fi

# ── 0.1. Check claude-mem plugin ────────────────────────────────────────────
# claude-mem provides persistent cross-session memory for Claude Code.
# Installed via: npx claude-mem install
CM_SETTINGS="$HOME/.claude-mem/settings.json"
CM_BASE="$HOME/.claude/plugins/cache/thedotmack/claude-mem"
CM_VER=$(ls "$CM_BASE" 2>/dev/null | sort -V | tail -1)

# verify_claude_mem_health — guard against BUG-0264.
# claude-mem registers its OWN Stop hook (scripts/worker-service.cjs). An
# interrupted version upgrade can leave a stale version directory in the plugin
# cache with incomplete node_modules; Claude Code may still invoke that stale
# worker, which then crashes the Stop hook with "Cannot find module 'zod/v3'".
# PlanVisualizer triggers the claude-mem install above, so we verify the active
# worker can resolve its deps (repairing if not) and flag stale broken copies.
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

if [ ! -f "$CM_SETTINGS" ]; then
  echo ""
  echo "[install] claude-mem not detected."
  read -p "[install] Install claude-mem for persistent cross-session memory? (y/n) " -n 1 -r; echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[install] Running: npx claude-mem install"
    echo ""
    npx claude-mem install || true
    if [ -f "$CM_SETTINGS" ]; then
      echo ""
      echo "[install] claude-mem installed successfully ✓"
      echo ""
      verify_claude_mem_health install
    else
      echo ""
      echo "[install] Warning: claude-mem install may have failed."
      echo "[install] Retry manually with: npx claude-mem install"
      echo ""
    fi
  else
    echo "[install] Skipping. Install later with: npx claude-mem install"
    echo ""
  fi
else
  if [ -n "$CM_VER" ]; then
    echo "[install] claude-mem v${CM_VER} already installed ✓"
  else
    echo "[install] claude-mem already installed ✓"
  fi
  verify_claude_mem_health install
fi

# ── 0.5. Create required directory structure ────────────────────────────────
echo "[install] Creating directory structure ..."
mkdir -p "${TARGET}/docs/coverage"
mkdir -p "${TARGET}/docs/pending-approvals"
mkdir -p "${TARGET}/.claude"
mkdir -p "${TARGET}/scripts"
mkdir -p "${TARGET}/orchestrator"

# Add .gitkeep for pending-approvals (so the empty dir is tracked but flag files aren't)
if [ ! -f "${TARGET}/docs/pending-approvals/.gitkeep" ]; then
  touch "${TARGET}/docs/pending-approvals/.gitkeep"
fi

# ── 1. Copy tool files ──────────────────────────────────────────────────────
echo "[install] Copying tools/ ..."
cp -r "${REPO_ROOT}/tools" "${TARGET}/"

echo "[install] Copying tests/ ..."
cp -r "${REPO_ROOT}/tests" "${TARGET}/"

echo "[install] Copying orchestrator/ ..."
cp -r "${REPO_ROOT}/orchestrator" "${TARGET}/"

echo "[install] Copying jest.config.js ..."
cp "${REPO_ROOT}/jest.config.js" "${TARGET}/jest.config.js"

echo "[install] Copying eslint.config.js ..."
cp "${REPO_ROOT}/eslint.config.js" "${TARGET}/eslint.config.js"

# ── 1.2. Create or update CLAUDE.md ─────────────────────────────────────────
CLAUDE_DEST="${TARGET}/CLAUDE.md"
if [ ! -f "$CLAUDE_DEST" ]; then
  echo "[install] Creating CLAUDE.md from template ..."
  cp "${REPO_ROOT}/CLAUDE.md.template" "$CLAUDE_DEST"
  echo "[install] CLAUDE.md created — edit it to match your project conventions."
else
  # Idempotency: add PlanVisualizer section if missing
  if ! grep -q "PlanVisualizer Dashboard" "$CLAUDE_DEST"; then
    echo "[install] Appending PlanVisualizer section to existing CLAUDE.md ..."
    cat >> "$CLAUDE_DEST" <<'MD'

---

## PlanVisualizer Dashboard

- **Entry point:** `node tools/generate-plan.js`
- **Output:** `docs/plan-status.html`
- **Config:** `plan-visualizer.config.json`
- **Format guide:** `plan_visualizer.md`

Run `npm run plan:generate` to regenerate the dashboard after changes to tracked docs.
MD
    echo "[install] Appended PlanVisualizer section to CLAUDE.md."
  else
    echo "[install] CLAUDE.md already has PlanVisualizer section — skipping."
  fi
fi

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
if [ ! -f "$TARGET_PKG" ]; then
  echo "[install] No package.json found in ${TARGET} — bootstrapping with 'npm init -y' ..."
  (cd "$TARGET" && npm init -y >/dev/null 2>&1) || {
    echo "[install] ERROR: 'npm init -y' failed. Please run it manually in ${TARGET}, then re-run install.sh." >&2
    exit 1
  }
  echo "[install] package.json created."
fi
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
pkg.scripts['memory:compact'] = pkg.scripts['memory:compact'] || 'node tools/memory.js compact';
pkg.scripts['memory:archive'] = pkg.scripts['memory:archive'] || 'node tools/memory.js archive';
pkg.scripts['memory:migrate'] = pkg.scripts['memory:migrate'] || 'node tools/memory.js migrate';
pkg.scripts['memory:migrate-commit'] = pkg.scripts['memory:migrate-commit'] || 'node tools/memory.js migrate-commit';
pkg.scripts['memory:suggest-model'] = pkg.scripts['memory:suggest-model'] || 'node tools/memory.js suggest-model';
pkg.scripts['memory:validate'] = pkg.scripts['memory:validate'] || 'node tools/memory.js validate';
// US-0181 orchestration scripts
pkg.scripts['agent:approve'] = pkg.scripts['agent:approve'] || 'node tools/agent-spec-plan.js approve';
pkg.scripts['agent:reject'] = pkg.scripts['agent:reject'] || 'node tools/agent-spec-plan.js reject';
pkg.scripts['agent:pending'] = pkg.scripts['agent:pending'] || 'node tools/agent-spec-plan.js show-pending';
pkg.scripts['agent:apply'] = pkg.scripts['agent:apply'] || 'node tools/agent-spec-plan.js apply-pending';
pkg.scripts['agent:list'] = pkg.scripts['agent:list'] || 'node tools/agent-spec-plan.js list';
pkg.scripts['agent:status'] = pkg.scripts['agent:status'] || 'node tools/agent-spec-plan.js status';
// Dashboard live-reload during orchestration sessions
pkg.scripts['dashboard:watch'] = pkg.scripts['dashboard:watch'] || 'node tools/watch-dashboard.js';

// Required dev dependencies — these match PlanVisualizer's own package.json
// so the same tool versions are used. Existing pins are preserved.
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
for (const [name, version] of Object.entries(requiredDevDeps)) {
  if (!pkg.devDependencies[name]) pkg.devDependencies[name] = version;
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('[install] Scripts added: plan:* (5), memory:* (6), agent:* (6); devDependencies merged');
JS
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
#
# v2.1.0 schema additions auto-migrated here:
#   plan-visualizer.config.json — github sync block (enabled: false by default),
#     costs.tshirtHours.XS (default: 2).
# v2.0.0 schema additions auto-migrated here:
#   agents.config.json — new top-level "project" (name, description, repoUrl,
#     startDate) and "phases" (pipeline phase definitions) sections.
#     Agent colours migrate from hex strings to oklch values automatically
#     (e.g. "color": "oklch(52% 0.22 25)"). Safe to re-run.
if [ -f "${TARGET}/tools/migrate-config.js" ]; then
  echo "[install] Checking config schema ..."
  (cd "$TARGET" && node "${TARGET}/tools/migrate-config.js" --auto) || true
fi

# ── 5. Merge Claude Code hooks into .claude/settings.json ───────────────────
# Adds:
#   - Stop hook: node tools/capture-cost.js  (AI cost tracking every turn)
#   - Bash allowlist: plan:* npm scripts + node tools/* commands (fewer prompts)
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

// Stop hook: cost tracking
settings.hooks.Stop = settings.hooks.Stop || [];
const hookCmd = 'node tools/capture-cost.js';
const stopPresent = settings.hooks.Stop.some(
  entry => (entry.hooks || []).some(h => h.type === 'command' && h.command === hookCmd)
);
if (!stopPresent) {
  settings.hooks.Stop.push({ hooks: [{ type: 'command', command: hookCmd }] });
  console.log('[install] Added Stop hook (capture-cost.js) to ' + path.basename(filePath));
} else {
  console.log('[install] Stop hook already present — skipping.');
}

// Bash allowlist: pre-approve read-only and plan:* tool calls
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
if (added > 0) console.log('[install] Added ' + added + ' Bash allowlist entries to ' + path.basename(filePath));
else console.log('[install] Bash allowlist already up to date — skipping.');

fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
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

# ── 7. Agentic Dashboard setup ────────────────────────────────────────────────
# Sets up dashboard.html, orchestrator/, agents.config.json template, and
# initialises docs/sdlc-status.json so the dashboard loads without errors.
echo ""
echo "[install] Agentic SDLC Dashboard setup"
if [ -f "${TARGET}/docs/dashboard.html" ]; then
  echo "[install] docs/dashboard.html already exists — updating orchestrator files only."
  SETUP_AGENTS=false
else
  read -p "[install] Install the Agentic SDLC Dashboard? (y/n) " -n 1 -r REPLY; echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    SETUP_AGENTS=true
  else
    SETUP_AGENTS=false
    echo "[install] Skipping Agentic Dashboard. Re-run install.sh at any time to add it."
  fi
fi

if [ "$SETUP_AGENTS" = true ] || [ -f "${TARGET}/docs/dashboard.html" ]; then
  # Core dashboard file
  mkdir -p "${TARGET}/docs/agents/images"
  [ -f "${REPO_ROOT}/docs/dashboard.html" ] && \
    cp "${REPO_ROOT}/docs/dashboard.html" "${TARGET}/docs/dashboard.html" && \
    echo "[install] Copied docs/dashboard.html"

  # Orchestrator — full directory (atomic-write, file-lock, spawn, etc.)
  mkdir -p "${TARGET}/orchestrator"
  cp -r "${REPO_ROOT}/orchestrator/." "${TARGET}/orchestrator/"
  echo "[install] Copied orchestrator/ (atomic-write, file-lock, spawn)"

  # SDLC status tools
  for f in tools/update-sdlc-status.js tools/init-sdlc-status.js; do
    [ -f "${REPO_ROOT}/${f}" ] && cp "${REPO_ROOT}/${f}" "${TARGET}/${f}" && echo "[install] Copied ${f}"
  done

  # agents.config.json — copy canonical roster (agent names and portraits are
  # standardised across all PlanVisualizer projects, not project-specific)
  AGENTS_CFG="${TARGET}/agents.config.json"
  if [ ! -f "$AGENTS_CFG" ]; then
    if [ -f "${REPO_ROOT}/agents.config.json" ]; then
      cp "${REPO_ROOT}/agents.config.json" "$AGENTS_CFG"
      echo "[install] Copied agents.config.json (canonical agent roster + phases)."
    elif [ -f "${REPO_ROOT}/agents.config.example.json" ]; then
      cp "${REPO_ROOT}/agents.config.example.json" "$AGENTS_CFG"
      echo "[install] Copied agents.config.example.json as agents.config.json."
    fi
  else
    echo "[install] agents.config.json already exists — skipping (run update.sh to refresh)."
  fi

  # docs/agents/ — instruction markdown files + portrait images
  # These are standardised assets shared across all PlanVisualizer projects
  if [ -d "${REPO_ROOT}/docs/agents" ]; then
    mkdir -p "${TARGET}/docs/agents"
    cp -r "${REPO_ROOT}/docs/agents/." "${TARGET}/docs/agents/"
    echo "[install] Copied docs/agents/ (agent instruction files + portraits)."
  fi

  # Initialise sdlc-status.json if it doesn't exist
  SDLC_STATUS="${TARGET}/docs/sdlc-status.json"
  if [ ! -f "$SDLC_STATUS" ]; then
    echo "[install] Initialising docs/sdlc-status.json ..."
    (cd "$TARGET" && node tools/init-sdlc-status.js) && \
      echo "[install] docs/sdlc-status.json created." || \
      echo "[install] Warning: init-sdlc-status.js failed — edit agents.config.json first, then run: node tools/init-sdlc-status.js"
  else
    echo "[install] docs/sdlc-status.json already exists — skipping init."
  fi

  echo "[install] Agentic Dashboard ready. Edit agents.config.json to define your agent roster,"
  echo "[install] then re-run: node tools/init-sdlc-status.js"
fi

echo ""
echo "[install] Done. Next steps:"
echo "  1. Edit plan-visualizer.config.json with your project name and file paths."
echo "  2. Edit agents.config.json to define your agent roster (if using the Agentic Dashboard)."
echo "  3. Run: npm install   (REQUIRED — installs chart.js, jest, eslint, prettier, etc.)"
echo "  4. Run: npm run plan:test   (confirm all suites pass)"
echo "  5. Run: node tools/generate-plan.js   (generates docs/plan-status.html)"
echo ""
echo "[install] Tip: chart.js is required at runtime by tools/lib/render-html.js."
echo "[install]      If 'generate-plan' errors with ENOENT on chart.umd.min.js, run 'npm install'."
