#!/usr/bin/env bash
# Merge an mcpServers JSON fragment into ~/.claude.json. Same-named entries
# are overwritten; existing entries installed by `514 agent init` are kept.
# Input fragment shape: { "mcpServers": { "<name>": { ... }, ... } }
set -euo pipefail

SRC="${1:?usage: override.sh <source-json>}"

if [[ ! -f "$SRC" ]]; then
  echo "[override:claude-mcp] source fragment not found: $SRC" >&2
  exit 1
fi

config="$HOME/.claude.json"
mkdir -p "$(dirname "$config")"
[[ -f "$config" ]] || echo '{}' > "$config"

FRAGMENT="$SRC" CONFIG="$config" node - <<'NODE'
const fs = require('fs');
const fragmentPath = process.env.FRAGMENT;
const configPath = process.env.CONFIG;

const fragment = JSON.parse(fs.readFileSync(fragmentPath, 'utf8'));
const incoming = (fragment && fragment.mcpServers) || {};

let root = {};
try { root = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { root = {}; }
root.mcpServers = { ...(root.mcpServers || {}), ...incoming };
fs.writeFileSync(configPath, `${JSON.stringify(root, null, 2)}\n`);

const names = Object.keys(incoming);
console.log(`[override:claude-mcp] merged ${names.length} server entry/entries: ${names.join(', ') || '(none)'}`);
NODE
