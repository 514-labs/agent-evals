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

# Re-run `514 agent init` now that the binary actually works. The install
# step may have tried this with a glibc-incompatible release binary and
# silently fallen back to a minimal MCP stub, leaving no skills installed.
#
# To iterate on skill content, point at a branch of 514-labs/agent-skills
# by changing SKILLS_BRANCH below. Reset to "main" when done.
SKILLS_BRANCH="add-project-create-skill"
init_args=(--agent claude-code --yes)
if [[ "$SKILLS_BRANCH" != "main" ]]; then
  init_args+=(--branch "$SKILLS_BRANCH")
fi
if 514 agent init "${init_args[@]}" </dev/null; then
  echo "[override:514] ran 'agent init' (branch: $SKILLS_BRANCH) to seed default skills"
else
  echo "[override:514] 'agent init' still failed — skills may be missing" >&2
fi
