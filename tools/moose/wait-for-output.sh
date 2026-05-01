#!/usr/bin/env bash
# wait-for-output.sh — block until a regex appears in a file, or timeout.
#
# Usage: wait-for-output.sh <file> <pattern> [timeout_seconds]
#
# Exits 0 when pattern matches, 1 on timeout.
# Prints the matching line to stdout so the agent sees what triggered it.
#
# Example:
#   wait-for-output.sh moose.log "Infrastructure changes processed|error" 30
#
set -euo pipefail

FILE="${1:?usage: wait-for-output.sh <file> <pattern> [timeout_seconds]}"
PATTERN="${2:?usage: wait-for-output.sh <file> <pattern> [timeout_seconds]}"
TIMEOUT="${3:-60}"

ELAPSED=0
LAST_SIZE=0

while (( ELAPSED < TIMEOUT )); do
  if [[ -f "$FILE" ]]; then
    MATCH=$(grep -m1 -E "$PATTERN" "$FILE" 2>/dev/null || true)
    if [[ -n "$MATCH" ]]; then
      echo "$MATCH"
      exit 0
    fi
  fi
  sleep 1
  (( ELAPSED++ )) || true
done

echo "TIMEOUT after ${TIMEOUT}s waiting for /${PATTERN}/ in ${FILE}" >&2
# Print last 10 lines for context on timeout
[[ -f "$FILE" ]] && tail -10 "$FILE" >&2
exit 1
