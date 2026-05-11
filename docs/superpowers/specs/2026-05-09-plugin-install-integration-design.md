# Plugin Install Integration — Design Spec

**Date:** 2026-05-09
**Status:** Approved
**Scope:** `scripts/install.sh` and `scripts/update.sh`

---

## Overview

Add two optional-plugin detection blocks to the PlanVisualizer install and update scripts:

1. **superpowers** (`https://github.com/obra/superpowers`) — already partially present in `install.sh §0`; extend with version-check and upgrade prompt; add to `update.sh`
2. **claude-mem** (`thedotmack/claude-mem`) — new detection block in both scripts; runs the official `npx claude-mem install` / `npx claude-mem update` CLI

Both blocks are optional (user can say `n` and continue), idempotent, and gracefully handle network failures.

---

## superpowers

### Detection

```bash
SP_BASE="$HOME/.claude/plugins/cache/claude-plugins-official/superpowers"
SP_VER=$(ls "$SP_BASE" 2>/dev/null | sort -V | tail -1)
```

`$SP_VER` is non-empty when installed.

### Version check

Fetch latest release tag from GitHub Releases API (unauthenticated, public repo):

```bash
SP_LATEST=$(curl -fsSL --max-time 5 \
  "https://api.github.com/repos/obra/superpowers/releases/latest" \
  2>/dev/null | grep '"tag_name"' | sed 's/.*"tag_name": *"\(.*\)".*/\1/')
```

Strip a leading `v` from both versions before comparing (`sort -V` comparison). If the curl call fails or returns empty, skip the version check silently — the install/update must not be blocked by a network issue.

### Behaviour matrix

| State                       | install.sh                                                                                              | update.sh                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Not installed               | Prompt y/n → show install command + URL, exit 0 if y                                                    | Prompt y/n → same                         |
| Installed, up to date       | Print "superpowers v{ver} ✓ (up to date)"                                                               | Print "superpowers v{ver} ✓ (up to date)" |
| Installed, update available | Print "superpowers v{ver} ✓"; print "v{latest} available — upgrade? (y/n)" → if y: show upgrade command | Same                                      |
| Version check failed        | Print "superpowers v{ver} ✓ (version check failed — skipping)"                                          | Same                                      |

### Install / upgrade command

superpowers cannot be installed or upgraded from a shell script — it requires a Claude Code slash command. Both scripts print:

```
Run inside a Claude Code session:
  /plugin install superpowers@claude-plugins-official

See: https://github.com/obra/superpowers
```

For upgrades the message is identical — running the install command again upgrades to the latest version.

### Placement

- `install.sh`: replaces existing §0 block (same location, extended logic)
- `update.sh`: new §0 block (before directory/tools steps)

---

## claude-mem

### Detection

```bash
CM_SETTINGS="$HOME/.claude-mem/settings.json"
```

`$CM_SETTINGS` exists → claude-mem is installed.

### install.sh behaviour

If not installed:

```
[install] claude-mem not detected.
Install claude-mem for persistent cross-session memory? (y/n)
  → y: npx claude-mem install   (interactive — user selects provider/model)
       Verify $CM_SETTINGS created; print success or warning if missing.
  → n: print "Skipping. Install later with: npx claude-mem install"
```

If already installed:

```
[install] claude-mem v{ver} already installed ✓
```

Version is read from `$HOME/.claude/plugins/cache/thedotmack/claude-mem/<ver>/` directory name (same pattern as superpowers).

### update.sh behaviour

If installed:

```
[update] Updating claude-mem ...
npx claude-mem update
```

`npx claude-mem update` is non-interactive and idempotent.

If not installed:

```
[update] claude-mem not detected.
Install claude-mem for persistent cross-session memory? (y/n)
  → y: npx claude-mem install   (interactive)
  → n: print "Skipping."
```

### Placement

- `install.sh`: new §0.1 block immediately after the superpowers §0 block
- `update.sh`: new §0.1 block immediately after the superpowers §0 block

### npx claude-mem install — interactive mode

The install command is run with no flags, which enters interactive mode and lets the user choose:

- LLM provider (claude / gemini / openrouter)
- Model
- Worker port (default 37701)

This is the recommended mode for `install.sh` because it is always a human-in-the-loop operation.

---

## Error handling

| Failure                                             | Behaviour                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| curl version check fails                            | Skip check silently; show installed version only                                            |
| `npx claude-mem install` fails                      | Print warning; continue install — claude-mem is optional                                    |
| `npx claude-mem update` fails                       | Print warning; continue update                                                              |
| `~/.claude-mem/settings.json` missing after install | Print warning: "claude-mem install may have failed — run `npx claude-mem install` to retry" |

---

## Out of scope

- Automatic superpowers upgrade (impossible from shell; requires Claude Code slash command)
- Non-interactive claude-mem install (not needed; install.sh is always human-operated)
- Version pinning for claude-mem
- Uninstall flows for either plugin
