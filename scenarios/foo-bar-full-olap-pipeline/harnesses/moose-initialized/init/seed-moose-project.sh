#!/usr/bin/env bash
# Pre-scaffold a Moose project at /workspace/moose-project AND start
# `moose dev --dockerless` so the agent can skip the startup cost.
# Runs at container startup when the `moose-initialized` harness is active.
# The backgrounded dev server survives init script exit (reparented to the
# entrypoint).
set -euo pipefail

mkdir -p /workspace
cd /workspace
if [[ ! -d moose-project ]]; then
  moose init moose-project typescript-empty
fi
cd moose-project
if [[ ! -d node_modules ]]; then
  npm install -y
fi

nohup moose dev --dockerless > /workspace/moose-project/moose.log 2>&1 &
echo "moose dev --dockerless started (pid $!)"
for i in $(seq 1 120); do
  if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
    echo "moose dev is ready after ${i}s"
    break
  fi
  sleep 1
done
