#!/usr/bin/env bash
# Stage a local template-packages/ directory into the image so a dev-build
# moose-cli (CLI_VERSION == "0.0.1") can resolve templates without hitting the
# remote registry.
#
# The binary's local-mode lookup walks three parents up from its own path and
# appends `template-packages/`. With /usr/local/bin/moose that resolves to
# /usr/template-packages/ — which is where we stage.
#
# Expected source layout (as produced by moose-0's scripts/package-templates.js):
#   <source>/manifest.toml
#   <source>/<template>.tgz ...
set -euo pipefail

SRC="${1:?usage: override.sh <source-dir>}"

if [[ ! -d "$SRC" ]]; then
  echo "[override:moose-templates] source directory not found: $SRC" >&2
  exit 1
fi

if [[ ! -f "$SRC/manifest.toml" ]]; then
  echo "[override:moose-templates] missing $SRC/manifest.toml — run scripts/package-templates.js in moose-0 first" >&2
  exit 1
fi

dest="/usr/template-packages"
mkdir -p "$dest"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "${SRC%/}/" "${dest}/"
else
  rm -rf "${dest:?}"/*
  cp -R "${SRC%/}/." "${dest}/"
fi

echo "[override:moose-templates] staged $(find "$dest" -maxdepth 1 -type f | wc -l | tr -d ' ') file(s) and $(find "$dest" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ') subdirectory/ies into ${dest}"
