#!/usr/bin/env bash
# ── «ارجع للتصميم القديم» ─────────────────────────────────────
#
#   bash scripts/restore-old-design.sh
#
# Puts the app back exactly as it was at the restore point: commit
# 0058119, the last one before the redesign touched the app (the streak
# scoreboard and everything after it). It is pinned by its full hash,
# not only by the tag `old-design`, because tags cannot be pushed from
# the cloud sessions and a fresh clone would not have it; the commit is
# in main's history, so every clone does. It writes a NEW commit's worth of changes to the
# working tree — history is never rewritten, so the redesign stays one
# `git revert` away if the owner changes his mind again.
#
# Restored: everything the user sees and the tests that pin it.
# Kept: scripts/ and design-system/ (tooling, not the app).
# Data on the phone (localStorage) is untouched either way: the redesign
# only ever added one harmless flag key, hf_tickets_truth_seen.

set -euo pipefail
RESTORE_POINT=0058119cc50ba9c2bbab1c2cd33650dd175967b3
cd "$(git rev-parse --show-toplevel)"

# A cloud session's clone can be shallow; fetch the commit itself if
# it is not here (GitHub serves a commit by hash), then try unshallowing.
git cat-file -e "$RESTORE_POINT^{commit}" 2>/dev/null \
  || git fetch -q origin "$RESTORE_POINT" 2>/dev/null \
  || git fetch -q --unshallow origin 2>/dev/null || true
git cat-file -e "$RESTORE_POINT^{commit}" 2>/dev/null \
  || { echo "✗ restore point $RESTORE_POINT not found — nothing restored"; exit 1; }
TAG=$RESTORE_POINT
# The list of what gets undone needs the history in between.
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  git fetch -q --unshallow origin 2>/dev/null || true
fi

APP_PATHS=(src public tests index.html vite.config.js package.json package-lock.json)

echo "Commits since the restore point that touch the app (all of these are undone):"
git log --oneline "$TAG..HEAD" -- "${APP_PATHS[@]}" || true

# --source with --staged --worktree is no-overlay: files added after the
# tag are deleted too, so the result is the tag, not a mix.
git restore --source="$TAG" --staged --worktree -- "${APP_PATHS[@]}"

if git diff --quiet "$TAG" -- "${APP_PATHS[@]}"; then
  echo "✓ app files now match the restore point ($(git rev-parse --short "$TAG"))"
else
  echo "✗ app files still differ from the restore point"; exit 1
fi
