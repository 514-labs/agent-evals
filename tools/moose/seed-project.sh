#!/usr/bin/env bash
# Pre-scaffold a Moose project at /workspace/moose-project AND start
# `moose dev --dockerless` so the agent can skip the startup cost.
#
# Invoked by each scenario's thin harness-init wrapper when the
# `moose-initialized` harness is active. The backgrounded dev server
# survives init-script exit (reparented to the entrypoint).
#
# See scenarios/<scenario>/harnesses/moose-initialized/init/seed-moose-project.sh
# for the per-scenario caller.
set -euo pipefail

mkdir -p /workspace
cd /workspace
if [[ ! -d moose-project ]]; then
  moose init moose-project typescript-empty
fi
cd moose-project

# Set the default database to "analytics" so tables with
# database: "analytics" land in the right place without extra config.
sed -i 's/^db_name = "local"/db_name = "analytics"/' moose.config.toml

if [[ ! -d node_modules ]]; then
  npm install
fi

nohup moose dev --dockerless > /workspace/moose-project/moose.log 2>&1 &
echo "moose dev --dockerless started (pid $!)"

for i in $(seq 1 120); do
  if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
    echo "moose dev is ready after ${i}s"
    exit 0
  fi
  sleep 1
done

echo "ERROR: moose dev did not become ready after 120s" >&2
exit 1
