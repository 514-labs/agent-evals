#!/usr/bin/env bash
# Install the 514 CLI and run `514 agent init` to seed the default Claude
# skills and MCP server entries. Skills/MCP iteration is handled by the
# claude-skills and claude-mcp override modules.
set -euo pipefail

VERSION="${1:?usage: install.sh <version>}"

bash -i <(curl -fsSL https://fiveonefour.com/install.sh) "514@${VERSION}"
export PATH="$HOME/.local/bin:$PATH"
ln -sf "$HOME/.local/bin/514" /usr/local/bin/514

mkdir -p "$HOME/.claude/skills"

# Prefer the official init flow; fall back to writing a minimal mcpServers
# stub if the subcommand isn't available in this CLI build.
if ! 514 agent init --agent claude-code --yes </dev/null; then
  node - <<'NODE'
const fs = require('fs');
const home = process.env.HOME;
const configPath = `${home}/.claude.json`;
fs.mkdirSync(`${home}/.claude/skills`, { recursive: true });
let root = {};
try { root = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { root = {}; }
root.mcpServers = {
  ...(root.mcpServers || {}),
  'moose-dev': { type: 'http', url: 'http://localhost:4000/mcp' },
  'context7': { type: 'http', url: 'https://mcp.context7.com/mcp' },
};
fs.writeFileSync(configPath, `${JSON.stringify(root, null, 2)}\n`);
NODE
fi
