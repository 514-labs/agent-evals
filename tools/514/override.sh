#!/usr/bin/env bash
# Replace the installed 514 CLI binary with a local copy.
set -euo pipefail

SRC="${1:?usage: override.sh <source-binary>}"

if [[ ! -f "$SRC" ]]; then
  echo "[override:514] source binary not found: $SRC" >&2
  exit 1
fi
chmod +x "$SRC"

dest="$HOME/.local/bin/514"
mkdir -p "$(dirname "$dest")"
cp "$SRC" "$dest"
chmod +x "$dest"

if [[ -L /usr/local/bin/514 ]]; then
  rm /usr/local/bin/514
fi
cp "$SRC" /usr/local/bin/514
chmod +x /usr/local/bin/514

echo "[override:514] replaced $dest and /usr/local/bin/514"
