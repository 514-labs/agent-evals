#!/usr/bin/env bash
# Pre-scaffold a Moose project at /workspace/moose-project so the agent
# can jump straight into `moose dev` without waiting for init + npm install.
#
# Invoked by each scenario's thin harness-init wrapper when the
# `moose-initialized` harness is active.
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

echo "Moose project scaffolded at /workspace/moose-project (moose-lib@${MOOSE_VERSION})"
echo "The agent should start 'moose dev --dockerless' itself."
