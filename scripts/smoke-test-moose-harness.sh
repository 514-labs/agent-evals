#!/usr/bin/env bash
# Smoke-test a moose harness image: prove that `moose init typescript-empty`
# + `moose dev --dockerless` boots cleanly before we layer scenario logic.
#
# Usage: scripts/smoke-test-moose-harness.sh <harness-id>
#   e.g. scripts/smoke-test-moose-harness.sh moose-legacy-migrations
#
# Requires: `dec-bench build` has already produced a harness image for a
# scenario that declares this harness in scenario.json::harnesses[].
set -euo pipefail

HARNESS_ID="${1:?usage: $0 <harness-id>}"
SCENARIO_ID="foo-bar-clickhouse-destructive-migration"
IMAGE="dec-bench-harness:${SCENARIO_ID}-${HARNESS_ID}"
EXPECTED_MOOSE_LIB="0.6.521"

echo "==> Smoke-testing ${IMAGE}"

# Fail fast if the image doesn't exist yet.
if ! docker image inspect "${IMAGE}" >/dev/null 2>&1; then
  echo "FAIL: harness image '${IMAGE}' not found." >&2
  echo "      Run: dec-bench build --scenario ${SCENARIO_ID} --harness ${HARNESS_ID}" >&2
  exit 1
fi

# Run the full toolchain inside the container. We set EVAL_HARNESS so the
# scenario's env.sh exports the right CLICKHOUSE_URL (18123 for moose
# harnesses), matching what the agent would see.
docker run --rm --entrypoint bash -e EVAL_HARNESS="${HARNESS_ID}" "${IMAGE}" -euo pipefail -c '
  # entrypoint.sh normally creates /workspace; we bypassed it, so create it here.
  mkdir -p /workspace
  cd /workspace
  moose init smoke_test typescript-empty
  cd smoke_test
  npm install @514labs/moose-lib@'"${EXPECTED_MOOSE_LIB}"' >/tmp/npm-install.log 2>&1 || {
    echo "FAIL: npm install failed"; tail -30 /tmp/npm-install.log; exit 1;
  }

  # Kick off moose dev --dockerless in background and wait for readiness.
  moose dev --dockerless >/tmp/moose-dev-seed.log 2>&1 &
  MOOSE_PID=$!
  trap '"'"'kill $MOOSE_PID 2>/dev/null || true'"'"' EXIT

  READY=0
  for _ in $(seq 1 90); do
    if curl -fsS --max-time 2 "http://panda:pandapass@localhost:18123/?query=SELECT%201" >/dev/null 2>&1; then
      READY=1; break
    fi
    sleep 1
  done
  if [[ "${READY}" != "1" ]]; then
    echo "FAIL: moose dev --dockerless ClickHouse did not become ready on 18123"
    tail -80 /tmp/moose-dev-seed.log
    exit 1
  fi

  # devredis must also be listening; moose dev --dockerless starts it in-process.
  if ! { </dev/tcp/localhost/6379; } 2>/dev/null; then
    echo "FAIL: devredis not reachable on 6379"
    tail -80 /tmp/moose-dev-seed.log
    exit 1
  fi

  # Prove ClickHouse is fully booted and serving user queries (not just
  # /ping). typescript-empty ships without any default OlapTable, so we
  # probe system.databases instead of expecting a user table.
  if ! curl -fsS -u panda:pandapass "http://localhost:18123/?query=SELECT+version()" >/dev/null; then
    echo "FAIL: ClickHouse version query failed after boot"
    tail -80 /tmp/moose-dev-seed.log
    exit 1
  fi
  DBS=$(curl -fsS -u panda:pandapass "http://localhost:18123/?query=SELECT+name+FROM+system.databases+WHERE+name+%3D+%27local%27+FORMAT+TSV")
  if [[ "${DBS}" != "local" ]]; then
    echo "FAIL: expected '"'"'local'"'"' database to exist, got: '"'"'${DBS}'"'"'"
    tail -80 /tmp/moose-dev-seed.log
    exit 1
  fi

  # Clean teardown — kill moose dev ourselves; wait reaps it so we exit cleanly.
  # (The EXIT trap is still a safety net for early-exit paths.)
  kill $MOOSE_PID 2>/dev/null || true
  wait $MOOSE_PID 2>/dev/null || true

  echo "PASS: ${EVAL_HARNESS}"
'
