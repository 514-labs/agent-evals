#!/usr/bin/env bash
# Replace the installed Moose CLI binary at every callable location so the
# override wins regardless of PATH order. A local dev binary reports
# --version 0.0.1, which the version-selection wrapper rejects — so we
# also shadow the wrapper symlink at ~/.moose/bin/moose to route direct
# to the binary.
set -euo pipefail

SRC="${1:?usage: override.sh <source-binary>}"

if [[ ! -f "$SRC" ]]; then
  echo "[override:moose] source binary not found: $SRC" >&2
  exit 1
fi
chmod +x "$SRC"

replace() {
  local dest="$1"
  if [[ -e "$dest" || -L "$dest" ]]; then
    rm -f "$dest"
  fi
  mkdir -p "$(dirname "$dest")"
  cp "$SRC" "$dest"
  chmod +x "$dest"
}

# 1. ~/.moose/bin/moose — normally a symlink to ~/.moose/wrapper. Replace
# with the raw binary so PATH-resolved `moose` skips the wrapper entirely.
replace "$HOME/.moose/bin/moose"

# 2. Every cached CLI version under ~/.moose/versions, so any code path that
# still invokes the wrapper (or resolves versions directly) also wins.
cache_count=0
shopt -s nullglob
for ver_bin in "$HOME/.moose/versions/stable/"*/moose "$HOME/.moose/versions/dev/"*/moose; do
  cp "$SRC" "$ver_bin"
  chmod +x "$ver_bin"
  cache_count=$((cache_count + 1))
done

# 3. /usr/local/bin/moose — the symlink our install.sh creates. Replace so
# callers that reach the binary via /usr/local/bin win too.
replace /usr/local/bin/moose

echo "[override:moose] bypassed wrapper at ~/.moose/bin/moose, replaced ${cache_count} cached CLI version(s), shadowed /usr/local/bin/moose"
