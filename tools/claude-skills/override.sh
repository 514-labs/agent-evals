#!/usr/bin/env bash
# Overlay a local skills directory onto ~/.claude/skills/ so a developer can
# iterate on skill markdown without cutting a 514 CLI release. Same-named
# skills are overwritten; unrelated skills installed by `514 agent init`
# are preserved.
set -euo pipefail

SRC="${1:?usage: override.sh <source-dir>}"

if [[ ! -d "$SRC" ]]; then
  echo "[override:claude-skills] source directory not found: $SRC" >&2
  exit 1
fi

dest="$HOME/.claude/skills"
mkdir -p "$dest"

if command -v rsync >/dev/null 2>&1; then
  rsync -a "${SRC%/}/" "${dest}/"
else
  cp -R "${SRC%/}/." "${dest}/"
fi

count=$(find "$SRC" -maxdepth 1 -mindepth 1 | wc -l | tr -d ' ')
echo "[override:claude-skills] overlaid ${count} entry/entries into ${dest}"
