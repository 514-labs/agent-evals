#!/usr/bin/env bash
# Install cursor-langfuse hooks into the workspace so the Cursor agent
# sends traces to Langfuse during the benchmark run.
set -euo pipefail

HOOKS_SRC="/scenario/harnesses/moose-initialized/hooks-langfuse"
WORKSPACE_CURSOR="/workspace/.cursor"

if [[ ! -d "${HOOKS_SRC}" ]]; then
  echo "Langfuse hooks source not found at ${HOOKS_SRC}; skipping."
  exit 0
fi

mkdir -p "${WORKSPACE_CURSOR}/hooks/lib"
cp "${HOOKS_SRC}/hooks.json" "${WORKSPACE_CURSOR}/hooks.json"
cp "${HOOKS_SRC}/hooks/"*.js "${WORKSPACE_CURSOR}/hooks/"
cp "${HOOKS_SRC}/hooks/package.json" "${WORKSPACE_CURSOR}/hooks/"
cp "${HOOKS_SRC}/hooks/package-lock.json" "${WORKSPACE_CURSOR}/hooks/" 2>/dev/null || true
cp "${HOOKS_SRC}/hooks/lib/"*.js "${WORKSPACE_CURSOR}/hooks/lib/"

cd "${WORKSPACE_CURSOR}/hooks"
npm install --omit=dev 2>&1 | tail -5

echo "Langfuse hooks installed at ${WORKSPACE_CURSOR}"
