#!/usr/bin/env bash
set -euo pipefail

PROMPT_FILE="/scenario/prompts/${PERSONA:-naive}.md"

if [[ ! -f "${PROMPT_FILE}" ]]; then
  echo "Prompt file not found: ${PROMPT_FILE}" >&2
  exit 1
fi

claude -p "$(cat "${PROMPT_FILE}")" \
  --model "${MODEL:-claude-sonnet-4-20250514}" \
  --allowedTools "Bash(command:*)" \
  --max-turns 50
