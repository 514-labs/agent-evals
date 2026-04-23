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

# `514 agent init` installs default skills as SYMLINKS under $dest, pointing
# to /root/.agents/skills/<ns>/<skill>/. To overlay a same-named entry from
# the staged overrides, we need to unlink the symlink first — plain `cp -R`
# refuses to overwrite a non-directory (the symlink) with a directory, and
# rsync isn't installed in the scenario image. Iterate manually.
shopt -s nullglob dotglob
for entry in "${SRC%/}"/*; do
  name=$(basename "$entry")
  rm -rf "$dest/$name"
  cp -R "$entry" "$dest/$name"
done

count=$(find "$SRC" -maxdepth 1 -mindepth 1 | wc -l | tr -d ' ')
echo "[override:claude-skills] overlaid ${count} entry/entries into ${dest}"
