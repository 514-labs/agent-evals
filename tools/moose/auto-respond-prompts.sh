#!/usr/bin/env bash
# auto-respond-prompts.sh — sidecar that auto-approves moose dev prompts via MCP.
#
# Polls the MCP respond_to_prompt tool every N seconds. If a prompt is pending,
# responds "y" (accept). Runs until killed.
#
# Usage: auto-respond-prompts.sh [mcp_url] [poll_interval_seconds]
#
# Designed to run as a background process alongside moose dev --agent:
#   nohup auto-respond-prompts.sh http://localhost:4000/mcp 2 > /tmp/auto-respond.log 2>&1 &
#
set -uo pipefail

MCP_URL="${1:-http://localhost:4000/mcp}"
POLL_INTERVAL="${2:-2}"

check_and_respond() {
  local result
  result=$(curl -sf -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"respond_to_prompt","arguments":{}}}' \
    2>/dev/null) || return 1

  # Check if a prompt is pending (not "No prompt is currently pending")
  if echo "$result" | grep -q "No prompt is currently pending"; then
    return 0
  fi

  echo "[$(date -Iseconds)] Prompt detected: $result"

  # Respond "y" to accept
  curl -sf -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"respond_to_prompt","arguments":{"response":"y"}}}' \
    2>/dev/null

  echo "[$(date -Iseconds)] Responded 'y' to prompt"
}

echo "[$(date -Iseconds)] Auto-respond sidecar started (poll every ${POLL_INTERVAL}s, MCP at ${MCP_URL})"

while true; do
  check_and_respond
  sleep "$POLL_INTERVAL"
done
