# Plugin Install Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add superpowers version-checking + upgrade prompt and claude-mem install/update support to `scripts/install.sh` and `scripts/update.sh`.

**Architecture:** Four targeted edits — two in each script. The superpowers §0 block in `install.sh` is replaced in-place with the extended version. `update.sh` gets two new blocks inserted after its header (before §1). All blocks are optional, idempotent, and safe to skip on network failure.

**Tech Stack:** Bash, `curl`, `sort -V`, `npx claude-mem`

---

## File Map

| File                 | Change                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `scripts/install.sh` | Replace lines 18–40 (superpowers §0) with extended version-check block; insert claude-mem §0.1 after the new §0 block |
| `scripts/update.sh`  | Insert superpowers §0 and claude-mem §0.1 blocks after line 23 (after the opening echo statements)                    |

---

### Task 1: Replace superpowers block in `install.sh`

**Files:**

- Modify: `scripts/install.sh:18-40`

The existing §0 (lines 18–40) only detects presence, not version. Replace it entirely with a block that also fetches the latest GitHub release tag and offers an upgrade prompt.

- [ ] **Step 1: Replace lines 18–40 with the new §0 block**

Open `scripts/install.sh`. Replace the section from line 18 (`# ── 0. Check superpowers plugin`) through line 40 (`fi`) with:

```bash
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
      echo "[install] superpowers v${SP_VER} installed — v${SP_LATEST} is available."
      read -p "[install] Upgrade? (y/n) " -n 1 -r; echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "[install] Run inside a Claude Code session:"
        echo ""
        echo "  /plugin install superpowers@claude-plugins-official"
        echo ""
        echo "  See: https://github.com/obra/superpowers"
        echo ""
      fi
    else
      echo "[install] superpowers v${SP_VER} ✓ (up to date)"
    fi
  fi
fi
```

- [ ] **Step 2: Verify the script is syntactically valid**

```bash
bash -n scripts/install.sh && echo "OK"
```

Expected: `OK` with no errors.

- [ ] **Step 3: Smoke-test the installed path (superpowers is installed on this machine)**

```bash
bash scripts/install.sh /tmp/pv-test-install 2>&1 | head -5
```

Expected: First line contains `[install] superpowers v` and either `✓ (up to date)` or `v... is available.`

- [ ] **Step 4: Commit**

```bash
git add scripts/install.sh
git commit -m "feat: extend superpowers §0 in install.sh with version-check + upgrade prompt"
```

---

### Task 2: Insert superpowers block in `update.sh`

**Files:**

- Modify: `scripts/update.sh` (insert after line 23)

`update.sh` has no superpowers awareness today. Add the identical §0 block (same logic, `[update]` prefix instead of `[install]`).

- [ ] **Step 1: Insert §0 block after line 23 in `update.sh`**

After this line in `update.sh`:

```bash
echo "[update] Source version: $(node -e "console.log(require('${REPO_ROOT}/package.json').version)" 2>/dev/null || echo 'unknown')"
```

Insert:

```bash

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
      echo "[update] superpowers v${SP_VER} installed — v${SP_LATEST} is available."
      read -p "[update] Upgrade? (y/n) " -n 1 -r; echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "[update] Run inside a Claude Code session:"
        echo ""
        echo "  /plugin install superpowers@claude-plugins-official"
        echo ""
        echo "  See: https://github.com/obra/superpowers"
        echo ""
      fi
    else
      echo "[update] superpowers v${SP_VER} ✓ (up to date)"
    fi
  fi
fi
```

- [ ] **Step 2: Verify syntax**

```bash
bash -n scripts/update.sh && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Smoke-test**

```bash
bash scripts/update.sh /tmp/pv-test-install 2>&1 | head -5
```

Expected: First few lines include `[update] Updating PlanVisualizer` then `[update] superpowers v...`

- [ ] **Step 4: Commit**

```bash
git add scripts/update.sh
git commit -m "feat: add superpowers §0 to update.sh with version-check + upgrade prompt"
```

---

### Task 3: Add claude-mem block to `install.sh`

**Files:**

- Modify: `scripts/install.sh` (insert §0.1 immediately after the §0 block added in Task 1)

- [ ] **Step 1: Insert §0.1 immediately after the closing `fi` of the superpowers §0 block**

The superpowers block ends with `fi` followed by a blank line and then `# ── 0.5.`. Insert between them:

```bash
# ── 0.1. Check claude-mem plugin ────────────────────────────────────────────
# claude-mem provides persistent cross-session memory for Claude Code.
# Installed via: npx claude-mem install
CM_SETTINGS="$HOME/.claude-mem/settings.json"
CM_BASE="$HOME/.claude/plugins/cache/thedotmack/claude-mem"
CM_VER=$(ls "$CM_BASE" 2>/dev/null | sort -V | tail -1)

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
fi
```

- [ ] **Step 2: Verify syntax**

```bash
bash -n scripts/install.sh && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Smoke-test the already-installed path**

claude-mem is installed on this machine (`~/.claude-mem/settings.json` exists), so running install.sh should print the "already installed" line:

```bash
bash scripts/install.sh /tmp/pv-test-install 2>&1 | grep "claude-mem"
```

Expected output contains: `[install] claude-mem v12.5.0 already installed ✓` (or the current version)

- [ ] **Step 4: Commit**

```bash
git add scripts/install.sh
git commit -m "feat: add claude-mem §0.1 to install.sh with install prompt"
```

---

### Task 4: Add claude-mem block to `update.sh`

**Files:**

- Modify: `scripts/update.sh` (insert §0.1 immediately after the §0 superpowers block added in Task 2)

- [ ] **Step 1: Insert §0.1 immediately after the superpowers block's closing `fi`**

```bash
# ── 0.1. Check claude-mem plugin ────────────────────────────────────────────
# claude-mem provides persistent cross-session memory for Claude Code.
CM_SETTINGS="$HOME/.claude-mem/settings.json"
CM_BASE="$HOME/.claude/plugins/cache/thedotmack/claude-mem"
CM_VER=$(ls "$CM_BASE" 2>/dev/null | sort -V | tail -1)

if [ -f "$CM_SETTINGS" ]; then
  if [ -n "$CM_VER" ]; then
    echo "[update] Updating claude-mem (v${CM_VER} installed)..."
  else
    echo "[update] Updating claude-mem..."
  fi
  npx claude-mem update 2>&1 || echo "[update] Warning: claude-mem update failed — continuing."
  echo ""
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
```

- [ ] **Step 2: Verify syntax**

```bash
bash -n scripts/update.sh && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Smoke-test the update path**

claude-mem is installed on this machine, so running update.sh should invoke `npx claude-mem update`:

```bash
bash scripts/update.sh /tmp/pv-test-install 2>&1 | grep -A3 "claude-mem"
```

Expected: `[update] Updating claude-mem (v... installed)...` followed by claude-mem update output.

- [ ] **Step 4: Final full smoke-test — both scripts end-to-end**

```bash
bash scripts/install.sh /tmp/pv-final-test < /dev/null 2>&1 | grep -E "\[install\] (superpowers|claude-mem)"
bash scripts/update.sh /tmp/pv-final-test < /dev/null 2>&1 | grep -E "\[update\] (superpowers|claude-mem)"
```

Note: `< /dev/null` sends EOF to stdin so all y/n prompts auto-answer `n` — this tests the non-interactive path without manual input.

Expected install output:

```
[install] superpowers v5.1.0 ✓ (up to date)   # or: update available
[install] claude-mem v12.5.0 already installed ✓
```

Expected update output:

```
[update] superpowers v5.1.0 ✓ (up to date)   # or: update available
[update] Updating claude-mem (v12.5.0 installed)...
```

- [ ] **Step 5: Commit**

```bash
git add scripts/update.sh
git commit -m "feat: add claude-mem §0.1 to update.sh with update + install prompt"
```
