#!/bin/bash
# Container runner, n-reps aware. Uses --bare for maximum isolation.
# Usage: runner.container.sh <variant> <task> <rep>
set -uo pipefail

VARIANT=$1
TASK=$2
REP=${3:-1}

BASE=/app
WORKDIR="$BASE/runs/$VARIANT/$TASK/rep$REP"
mkdir -p "$WORKDIR"

TRACE="$WORKDIR/trace.jsonl"
MOOSE_LOG="$WORKDIR/moose.log"
TIMING="$WORKDIR/timing.json"
STDERR="$WORKDIR/stderr.log"
rm -f "$TRACE" "$MOOSE_LOG" "$TIMING" "$STDERR"

PROMPT=$(cat "$BASE/tasks/$TASK.md")

export PATH="$BASE/variants/$VARIANT/bin:$PATH"
export MOOSE_LOG_PATH="$MOOSE_LOG"

START=$(date +%s)

cd "$WORKDIR"
claude -p "$PROMPT" \
  --bare \
  --model claude-sonnet-4-6 \
  --output-format stream-json \
  --verbose \
  --dangerously-skip-permissions \
  --max-turns 30 \
  --allowedTools "Bash" \
  --no-session-persistence \
  --append-system-prompt "You are running in an automated evaluation. Complete the user's task as directly as possible using the moose CLI. Do not use any skills, agents, or memory tools. Do not write any files." \
  > "$TRACE" 2> "$STDERR" || true

END=$(date +%s)
WALL=$((END - START))

printf '{"variant":"%s","task":"%s","rep":%d,"wall_seconds":%d}\n' "$VARIANT" "$TASK" "$REP" "$WALL" > "$TIMING"
echo "done: $VARIANT/$TASK/rep$REP (${WALL}s)"
