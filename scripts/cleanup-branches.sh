#!/usr/bin/env bash
# cleanup-branches.sh — remove stale worktrees + merged branches left behind
# by the EPIC pipeline (auto-merge --delete-branch fails when a worktree still
# holds a ref; version-bump workflow forgot --delete-branch before this fix).
#
# Safe to run repeatedly. Preserves: develop, main, origin/gh-pages, origin/HEAD.
#
# Usage:
#   scripts/cleanup-branches.sh [--dry-run]
#
# Flags:
#   --dry-run    Print what would be deleted without touching anything.

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run] no branches or worktrees will be deleted"
fi

run() {
  if $DRY_RUN; then
    echo "  would run: $*"
  else
    "$@"
  fi
}

# Always operate from the repo root (where .git lives).
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# 0. Make sure we are on develop or main so we can delete feature branches safely.
CURRENT=$(git branch --show-current)
if [[ "$CURRENT" != "develop" && "$CURRENT" != "main" ]]; then
  echo "[cleanup] currently on '$CURRENT'; switching to develop"
  run git checkout develop
fi

echo
echo "=== 1. Remove agent worktrees under .claude/worktrees/ ==="
if [[ -d .claude/worktrees ]]; then
  for wt in .claude/worktrees/agent-*/; do
    [[ -d "$wt" ]] || continue
    echo "  removing $wt"
    run git worktree remove --force "$wt"
  done
fi
run git worktree prune

echo
echo "=== 2. Fetch + prune remote refs ==="
run git fetch origin --prune

echo
echo "=== 3. Delete local branches whose upstream is gone ==="
GONE=$(git branch -vv | awk '/: gone]/{print $1}' | tr -d '*+' || true)
if [[ -n "$GONE" ]]; then
  echo "$GONE" | while read -r b; do
    [[ -z "$b" ]] && continue
    echo "  $b"
    run git branch -D "$b"
  done
else
  echo "  (none)"
fi

echo
echo "=== 4. Force-delete local squash-merged feature/bugfix/chore branches ==="
# Squash merges leave local refs that aren't ancestors of develop, so plain -d
# refuses. We know these are merged because their PRs are MERGED on origin.
# Broad pattern catches all EPIC conventions: feature/, bugfix/, chore/,
# plus Claude's internal worktree-agent-* refs. Excludes chore/version-bump-*
# because step 5 owns those (they need the open-PR race guard).
# Always skips the currently-checked-out branch via the per-row guard below.
LOCAL=$(git branch --format='%(refname:short)' \
  | grep -E '^(feature/|bugfix/|chore/|worktree-agent-)' \
  | grep -v '^chore/version-bump-' \
  || true)
if [[ -n "$LOCAL" ]]; then
  echo "$LOCAL" | while read -r b; do
    [[ -z "$b" ]] && continue
    # Skip the branch currently checked out
    [[ "$b" == "$(git branch --show-current)" ]] && continue
    echo "  $b"
    run git branch -D "$b"
  done
else
  echo "  (none)"
fi

echo
echo "=== 5. Delete orphan chore/version-bump-* remote branches ==="
# IMPORTANT: gate on PR state. The version-bump workflow creates the branch
# and opens an auto-merge PR milliseconds apart — deleting the branch while
# the PR is still OPEN closes the PR and skips the version bump entirely
# (learned the hard way on PR #341). Only delete when PR is MERGED or
# absent, matching step 6's safety contract.
VBUMPS=$(git branch -r | awk '/origin\/chore\/version-bump-/{print $1}' | sed 's|origin/||' || true)
if [[ -n "$VBUMPS" ]]; then
  echo "$VBUMPS" | while read -r b; do
    [[ -z "$b" ]] && continue
    STATE=$(gh pr list --state all --head "$b" --json state --jq '.[0].state // "NO_PR"' 2>/dev/null || echo "NO_PR")
    if [[ "$STATE" == "MERGED" || "$STATE" == "CLOSED" ]]; then
      echo "  $b (PR $STATE — safe to delete)"
      run git push origin --delete "$b"
    elif [[ "$STATE" == "OPEN" ]]; then
      echo "  $b (PR OPEN — skipping; let auto-merge finish first)"
    elif [[ "$STATE" == "NO_PR" ]]; then
      # No PR means the branch is truly orphaned (workflow crashed before
      # creating the PR, or PR was deleted). Safe to remove.
      echo "  $b (no PR — deleting orphan)"
      run git push origin --delete "$b"
    else
      echo "  $b (state=$STATE — skipping)"
    fi
  done
else
  echo "  (none)"
fi

echo
echo "=== 6. Delete merged feature/bugfix/chore remote branches ==="
# Broad pattern matches all EPIC conventions. Excludes chore/version-bump-*
# because step 5 owns those. The PR-state gate below ensures we never delete
# a branch with an open PR — even for one-off chore/<anything> branches the
# user creates outside the session-close / branch-cleanup patterns.
REMOTE_MERGED=$(git branch -r \
  | awk '/origin\/(feature\/|bugfix\/|chore\/)/{print $1}' \
  | sed 's|origin/||' \
  | grep -v '^chore/version-bump-' \
  || true)
if [[ -n "$REMOTE_MERGED" ]]; then
  echo "$REMOTE_MERGED" | while read -r b; do
    [[ -z "$b" ]] && continue
    # Guard: only delete if PR is merged
    STATE=$(gh pr list --state all --head "$b" --json state --jq '.[0].state // "NO_PR"' 2>/dev/null || echo "NO_PR")
    if [[ "$STATE" == "MERGED" ]]; then
      echo "  $b (merged)"
      run git push origin --delete "$b"
    elif [[ "$STATE" == "NO_PR" ]]; then
      echo "  $b (no PR — skipping for safety)"
    else
      echo "  $b (state=$STATE — skipping)"
    fi
  done
else
  echo "  (none)"
fi

echo
echo "=== Final state ==="
echo "local branches:  $(git branch | wc -l | tr -d ' ')"
git branch
echo "remote branches: $(git branch -r | wc -l | tr -d ' ')"
git branch -r
echo "worktrees:       $(git worktree list | wc -l | tr -d ' ')"
git worktree list

echo
if $DRY_RUN; then
  echo "[cleanup] dry-run complete — re-run without --dry-run to execute"
else
  echo "[cleanup] done"
fi
