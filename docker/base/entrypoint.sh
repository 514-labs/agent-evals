#!/usr/bin/env bash
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

export AGENT_EXIT_CODE="${agent_exit_code}"
export EVAL_WALL_CLOCK_SECONDS="${wall_clock_seconds}"
export EVAL_AGENT_STEPS="${EVAL_AGENT_STEPS:-0}"
export EVAL_TOKENS_USED="${EVAL_TOKENS_USED:-0}"
export EVAL_LLM_API_COST_USD="${EVAL_LLM_API_COST_USD:-0}"
export EVAL_LLM_API_COST_SOURCE="${EVAL_LLM_API_COST_SOURCE:-}"
export EVAL_INPUT_TOKENS="${EVAL_INPUT_TOKENS:-0}"
export EVAL_OUTPUT_TOKENS="${EVAL_OUTPUT_TOKENS:-0}"
export EVAL_CACHED_INPUT_TOKENS="${EVAL_CACHED_INPUT_TOKENS:-0}"
export EVAL_CACHE_CREATION_TOKENS="${EVAL_CACHE_CREATION_TOKENS:-0}"
export EVAL_CACHE_READ_TOKENS="${EVAL_CACHE_READ_TOKENS:-0}"
export EVAL_CACHE_WRITE_TOKENS="${EVAL_CACHE_WRITE_TOKENS:-0}"
export EVAL_SESSION_LOG_PATH="${SESSION_LOG_PATH}"
export EVAL_RUN_METADATA_JSON="${EVAL_RUN_METADATA_JSON:-{}}"
export ASSERTION_LOG_PATH="${ASSERTION_LOG_PATH}"

if [[ -f "${AGENT_METRICS_PATH}" ]]; then
  eval "$(
    node -e '
const fs = require("node:fs");
const path = process.argv[1];
let parsed = {};
try {
  parsed = JSON.parse(fs.readFileSync(path, "utf8"));
} catch {
  parsed = {};
}
const safeNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const safeText = (value) => (typeof value === "string" ? value : "");
process.stdout.write(`EVAL_AGENT_STEPS=${safeNum(parsed.agentSteps)}\n`);
process.stdout.write(`EVAL_TOKENS_USED=${safeNum(parsed.tokensUsed)}\n`);
process.stdout.write(`EVAL_LLM_API_COST_USD=${safeNum(parsed.llmApiCostUsd)}\n`);
process.stdout.write(`EVAL_LLM_API_COST_SOURCE=${JSON.stringify(safeText(parsed.llmApiCostSource))}\n`);
process.stdout.write(`EVAL_INPUT_TOKENS=${safeNum(parsed.inputTokens)}\n`);
process.stdout.write(`EVAL_OUTPUT_TOKENS=${safeNum(parsed.outputTokens)}\n`);
process.stdout.write(`EVAL_CACHED_INPUT_TOKENS=${safeNum(parsed.cachedInputTokens)}\n`);
process.stdout.write(`EVAL_CACHE_CREATION_TOKENS=${safeNum(parsed.cacheCreationTokens)}\n`);
process.stdout.write(`EVAL_CACHE_READ_TOKENS=${safeNum(parsed.cacheReadTokens)}\n`);
process.stdout.write(`EVAL_CACHE_WRITE_TOKENS=${safeNum(parsed.cacheWriteTokens)}\n`);
' "${AGENT_METRICS_PATH}"
  )"
fi

if [[ -f "${RUN_META_PATH}" ]]; then
  export EVAL_RUN_METADATA_JSON="$(cat "${RUN_META_PATH}")"
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

# Re-source scenario env before running assertions so harnesses whose
# env.sh depends on seed-produced state (e.g. tinybird-forward writes
# /workspace/.tb-env with the workspace name + admin token that the seed
# discovers) see the updated exports. The initial source happens before
# the seed runs, when such files don't exist yet. Re-sourcing is a no-op
# for harnesses whose env.sh is purely declarative.
source_scenario_env

ensure_clickhouse_for_assertions

tsx /opt/dec-bench/eval-core/src/cli.ts /scenario/assertions > "${RESULT_JSON_PATH}"
echo "${EVAL_RESULT_START}"
cat "${RESULT_JSON_PATH}"
echo "${EVAL_RESULT_END}"

if [[ -f "${ASSERTION_LOG_PATH}" ]]; then
  echo "${ASSERTION_LOG_START}"
  cat "${ASSERTION_LOG_PATH}"
  echo "${ASSERTION_LOG_END}"
fi

echo "${SERVICE_LOGS_START}"
collect_service_logs
echo "${SERVICE_LOGS_END}"

exit "${agent_exit_code}"
