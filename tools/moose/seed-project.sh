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

# Capture the installed CLI version before entering the project dir
# (the version router inside a project resolves to the template's pin).
MOOSE_VERSION="$(moose --version | awk '{print $2}')"
echo "Installed moose CLI: ${MOOSE_VERSION}"

if [[ ! -d moose-project ]]; then
  moose init moose-project typescript-empty
fi
cd moose-project

# Set the default database to "analytics" so tables with
# database: "analytics" land in the right place without extra config.
sed -i 's/^db_name = "local"/db_name = "analytics"/' moose.config.toml

# Pin moose-lib to the installed CLI version so the version router
# uses the CLI that supports --agent.
npm pkg set "dependencies.@514labs/moose-lib=${MOOSE_VERSION}"
rm -rf node_modules
npm install

nohup moose dev --dockerless --agent > /workspace/moose-project/moose.log 2>&1 &
echo "moose dev --dockerless --agent started (pid $!)"

for i in $(seq 1 120); do
  if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
    echo "moose dev is ready after ${i}s"

    # Start sidecar that auto-approves destructive/rename prompts via MCP.
    # In --agent mode, moose dev blocks on prompts until respond_to_prompt is
    # called. The sidecar polls every 2s and responds "y".
    nohup /opt/dec-bench/tools/moose/auto-respond-prompts.sh \
      http://localhost:4000/mcp 2 \
      > /tmp/auto-respond.log 2>&1 &
    echo "auto-respond sidecar started (pid $!)"

    exit 0
  fi
  sleep 1
done

echo "ERROR: moose dev did not become ready after 120s" >&2
exit 1
