#!/usr/bin/env bash
# Idle entrypoint for the dec-bench container.
#
# As of 514-1419 the container is driven by the CLI in two phases:
#   1. /opt/dec-bench/run-agent.sh      (no /scenario/assertions on disk)
#   2. /opt/dec-bench/run-evaluator.sh  (after the CLI docker-cp's assertions in)
#
# This entrypoint just keeps the container alive while the CLI orchestrates
# the phases via `docker exec`. Network policy is applied here because it must
# take effect for the agent's first network reach.

set -euo pipefail

mkdir -p /output /workspace

if [[ "${NETWORK_POLICY:-open}" == "restricted" ]] && [[ -x /opt/dec-bench/agent/iptables.sh ]]; then
  /opt/dec-bench/agent/iptables.sh
fi

exec sleep infinity
