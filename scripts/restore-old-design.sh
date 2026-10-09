#!/usr/bin/env bash
# ── «ارجع للتصميم القديم» ─────────────────────────────────────
#
#   bash scripts/restore-old-design.sh
#
# Puts the app back exactly as it was at the tag `old-design`: the last
# commit before the redesign touched the app (the streak scoreboard and
# everything after it). It writes a NEW commit's worth of changes to the
# working tree — history is never rewritten, so the redesign stays one
# `git revert` away if the owner changes his mind again.
#
# Restored: everything the user sees and the tests that pin it.
# Kept: scripts/ and design-system/ (tooling, not the app).
# Data on the phone (localStorage) is untouched either way: the redesign
# only ever added one harmless flag key, hf_tickets_truth_seen.

set -euo pipefail
TAG=old-design
cd "$(git rev-parse --show-toplevel)"

git fetch -q origin "refs/tags/$TAG:refs/tags/$TAG" 2>/dev/null || true
git rev-parse -q --verify "refs/tags/$TAG^{commit}" >/dev/null \
  || { echo "✗ tag $TAG not found — nothing restored"; exit 1; }

APP_PATHS=(src public tests index.html vite.config.js package.json package-lock.json)

echo "Commits since $TAG that touch the app (all of these are undone):"
git log --oneline "$TAG..HEAD" -- "${APP_PATHS[@]}" || true

# --source with --staged --worktree is no-overlay: files added after the
# tag are deleted too, so the result is the tag, not a mix.
git restore --source="$TAG" --staged --worktree -- "${APP_PATHS[@]}"

if git diff --quiet "$TAG" -- "${APP_PATHS[@]}"; then
  echo "✓ app files now match $TAG ($(git rev-parse --short "$TAG^{commit}"))"
else
  echo "✗ app files still differ from $TAG"; exit 1
fi
