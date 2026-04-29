#!/usr/bin/env bash
# Sync embedded agent skills from .agents/skills/ into per-agent paths so
# they auto-load on a fresh clone. Run after editing any skill under
# .agents/skills/dec-bench-*. Safe to run multiple times (idempotent).
#
# Targets:
#   .claude/skills/dec-bench-*  -- Claude Code reads natively
#   AGENTS.md + .agents/skills/ -- Cursor and Codex read these natively
set -euo pipefail

cd "$(dirname "$0")/.."

SKILLS=(
  dec-bench-quickstart
  dec-bench-run
  dec-bench-create-scenario
  dec-bench-local-override
)

args=()
for skill in "${SKILLS[@]}"; do
  args+=(-s "$skill")
done

npx --yes skills@latest add . "${args[@]}" -a claude-code -y --copy

# `npx skills add` writes machine-local absolute paths into skills-lock.json
# for local sources. Drop those entries so the lock only tracks real upstream
# packages (e.g. anthropics/skills).
git diff --quiet -- skills-lock.json || git restore skills-lock.json

echo
echo "Synced ${#SKILLS[@]} skills into .claude/skills/."
echo "Cursor and Codex pick up the canonical copies under .agents/skills/ and AGENTS.md."
