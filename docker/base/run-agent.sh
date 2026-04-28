#!/usr/bin/env bash
# Phase 1 of a dec-bench run: bring up services, run init scripts, run the
# agent, and emit the agent-side output markers. Persists agent_exit_code and
# wall-clock seconds to state files so the evaluator phase can pick them up.
#
# This script must succeed (exit 0) even when the agent itself exits non-zero,
# so that the CLI can still drive the evaluator phase. The agent's actual exit
# code is propagated via /output/.agent-exit-code and re-applied at the end of
# run-evaluator.sh.

set -euo pipefail

# shellcheck source=/opt/dec-bench/lib.sh
. /opt/dec-bench/lib.sh

mkdir -p "${OUTPUT_DIR}" /workspace

if [[ "${NETWORK_POLICY:-open}" == "restricted" ]] && [[ -x /opt/dec-bench/agent/iptables.sh ]]; then
  /opt/dec-bench/agent/iptables.sh
fi

source_scenario_env

if [[ -f /etc/supervisord.conf ]]; then
  supervisord -c /etc/supervisord.conf
fi

detect_services
wait_for_postgres
wait_for_clickhouse
wait_for_redpanda
run_init_scripts

start_epoch="$(date +%s)"
agent_exit_code=0

if [[ -x /opt/dec-bench/agent/run.sh ]]; then
  set +e
  echo "${AGENT_STDOUT_START}"
  # Use process substitution instead of a pipeline so that backgrounded child
  # processes (e.g. moose dev --dockerless &) don't block exit by holding FDs.
  /opt/dec-bench/agent/run.sh > >(tee "${SESSION_LOG_PATH}") 2>&1
  agent_exit_code=$?
  sleep 1  # let tee flush
  echo "${AGENT_STDOUT_END}"
  set -e
else
  echo "Missing agent runner at /opt/dec-bench/agent/run.sh" >&2
  agent_exit_code=1
fi

end_epoch="$(date +%s)"
wall_clock_seconds="$((end_epoch - start_epoch))"

echo "${agent_exit_code}" > "${AGENT_EXIT_CODE_PATH}"
echo "${wall_clock_seconds}" > "${WALL_CLOCK_PATH}"

if [[ -f "${RUN_META_PATH}" ]]; then
  echo "${RUN_META_START}"
  cat "${RUN_META_PATH}"
  echo "${RUN_META_END}"
fi

if [[ -f "${AGENT_RAW_PATH}" ]]; then
  echo "${AGENT_RAW_START}"
  cat "${AGENT_RAW_PATH}"
  echo "${AGENT_RAW_END}"
fi

if [[ -f "${SESSION_JSONL_PATH}" ]]; then
  echo "__DEC_BENCH_SESSION_JSONL_START__"
  cat "${SESSION_JSONL_PATH}"
  echo "__DEC_BENCH_SESSION_JSONL_END__"
fi

if [[ -f "${TRACE_PATH}" ]]; then
  echo "${AGENT_TRACE_START}"
  cat "${TRACE_PATH}"
  echo "${AGENT_TRACE_END}"
fi

# Always exit 0 so phase 2 runs. The agent's exit code is preserved in
# /output/.agent-exit-code and re-applied at the end of run-evaluator.sh.
exit 0
