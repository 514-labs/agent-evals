#!/usr/bin/env bash
set -euo pipefail

PROMPT_FILE="/scenario/prompts/${PERSONA:-naive}.md"

if [[ ! -f "${PROMPT_FILE}" ]]; then
  echo "Prompt file not found: ${PROMPT_FILE}" >&2
  exit 1
fi

SYSTEM_PROMPT="You are running inside a sandboxed Docker container for a benchmark evaluation. You have full tool access. Do NOT ask for permission or propose commands for the user to run. Execute all fixes directly, then verify they work by running the relevant scripts and queries yourself. IMPORTANT: never run long-lived servers in the foreground. Start them in the background (for example with '&' and redirected logs), then continue with the rest of the task. If you start a local API server, immediately verify it with curl and proceed. Your work is scored by automated assertions after you finish."
PROMPT_CONTENT="$(cat "${PROMPT_FILE}")"

CLAUDE_ARGS=(
  -p "${PROMPT_CONTENT}"
  --model "${MODEL:-claude-sonnet-4-20250514}"
  --dangerously-skip-permissions
  --append-system-prompt "${SYSTEM_PROMPT}"
  --max-turns 50
)

IS_SANDBOX="${IS_SANDBOX:-1}" claude "${CLAUDE_ARGS[@]}"
