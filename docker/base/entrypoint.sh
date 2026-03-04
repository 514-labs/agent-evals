#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="/output"
SESSION_LOG_PATH="${OUTPUT_DIR}/session.log"
RESULT_JSON_PATH="${OUTPUT_DIR}/result.json"
AGENT_METRICS_PATH="${OUTPUT_DIR}/agent-metrics.json"
RUN_META_PATH="${OUTPUT_DIR}/run-meta.json"
AGENT_RAW_PATH="${OUTPUT_DIR}/agent-raw.json"
TRACE_PATH="${OUTPUT_DIR}/agent-trace.json"
SESSION_JSONL_PATH="${OUTPUT_DIR}/session.jsonl"
ASSERTION_LOG_PATH="${OUTPUT_DIR}/assertion-log.json"

AGENT_STDOUT_START="__DEC_BENCH_AGENT_STDOUT_START__"
AGENT_STDOUT_END="__DEC_BENCH_AGENT_STDOUT_END__"
AGENT_RAW_START="__DEC_BENCH_AGENT_RAW_JSON_START__"
AGENT_RAW_END="__DEC_BENCH_AGENT_RAW_JSON_END__"
AGENT_TRACE_START="__DEC_BENCH_AGENT_TRACE_JSON_START__"
AGENT_TRACE_END="__DEC_BENCH_AGENT_TRACE_JSON_END__"
RUN_META_START="__DEC_BENCH_RUN_META_JSON_START__"
RUN_META_END="__DEC_BENCH_RUN_META_JSON_END__"
EVAL_RESULT_START="__DEC_BENCH_EVAL_RESULT_JSON_START__"
EVAL_RESULT_END="__DEC_BENCH_EVAL_RESULT_JSON_END__"
ASSERTION_LOG_START="__DEC_BENCH_ASSERTION_LOG_JSON_START__"
ASSERTION_LOG_END="__DEC_BENCH_ASSERTION_LOG_JSON_END__"

mkdir -p "${OUTPUT_DIR}"

if [[ "${NETWORK_POLICY:-open}" == "restricted" ]] && [[ -x /opt/dec-bench/agent/iptables.sh ]]; then
  /opt/dec-bench/agent/iptables.sh
fi

if [[ -f /etc/supervisord.conf ]]; then
  supervisord -c /etc/supervisord.conf
fi

detect_services() {
  if [[ -f /etc/supervisord.conf ]]; then
    if grep -q "\[program:postgres\]" /etc/supervisord.conf 2>/dev/null; then
      export POSTGRES_URL="${POSTGRES_URL:-postgresql://postgres@localhost:5432/postgres}"
      export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
      export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
    fi
    if grep -q "\[program:clickhouse\]" /etc/supervisord.conf 2>/dev/null; then
      export CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
      export CLICKHOUSE_HOST="${CLICKHOUSE_HOST:-localhost}"
      export CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-8123}"
    fi
    if grep -q "\[program:redpanda\]" /etc/supervisord.conf 2>/dev/null; then
      export REDPANDA_BROKER="${REDPANDA_BROKER:-localhost:9092}"
    fi
  fi
}

detect_services

wait_for_postgres() {
  if [[ -z "${POSTGRES_URL:-}" ]]; then
    return 0
  fi
  echo "Waiting for Postgres..."
  for _ in $(seq 1 30); do
    if pg_isready -h localhost -p "${POSTGRES_PORT:-5432}" >/dev/null 2>&1; then
      echo "Postgres is ready."
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready." >&2
  return 1
}

wait_for_clickhouse() {
  if [[ -z "${CLICKHOUSE_URL:-}" ]]; then
    return 0
  fi
  echo "Waiting for ClickHouse..."
  for _ in $(seq 1 30); do
    if clickhouse-client --query "SELECT 1" >/dev/null 2>&1; then
      echo "ClickHouse is ready."
      return 0
    fi
    sleep 1
  done
  echo "ClickHouse did not become ready." >&2
  return 1
}

run_init_scripts() {
  if [[ ! -d /scenario/init ]]; then
    return 0
  fi
  shopt -s nullglob
  for script in /scenario/init/*; do
    case "${script}" in
      *.sql)
        if [[ -n "${POSTGRES_URL:-}" ]] && [[ "${script}" == *postgres* ]]; then
          echo "Running Postgres init: ${script}"
          psql "${POSTGRES_URL}" -f "${script}"
        elif [[ -n "${CLICKHOUSE_URL:-}" ]] && [[ "${script}" == *clickhouse* ]]; then
          echo "Running ClickHouse init: ${script}"
          clickhouse-client --multiquery < "${script}"
        elif [[ -n "${POSTGRES_URL:-}" ]]; then
          echo "Running SQL init (Postgres): ${script}"
          psql "${POSTGRES_URL}" -f "${script}"
        fi
        ;;
      *.sh)
        echo "Running shell init: ${script}"
        bash "${script}"
        ;;
    esac
  done
}

wait_for_postgres
wait_for_clickhouse
run_init_scripts

start_epoch="$(date +%s)"
agent_exit_code=0

if [[ -x /opt/dec-bench/agent/run.sh ]]; then
  set +e
  echo "${AGENT_STDOUT_START}"
  /opt/dec-bench/agent/run.sh 2>&1 | tee "${SESSION_LOG_PATH}"
  agent_exit_code="${PIPESTATUS[0]}"
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
process.stdout.write(`EVAL_AGENT_STEPS=${safeNum(parsed.agentSteps)}\n`);
process.stdout.write(`EVAL_TOKENS_USED=${safeNum(parsed.tokensUsed)}\n`);
process.stdout.write(`EVAL_LLM_API_COST_USD=${safeNum(parsed.llmApiCostUsd)}\n`);
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

tsx /opt/dec-bench/eval-core/src/cli.ts /scenario/assertions > "${RESULT_JSON_PATH}"
echo "${EVAL_RESULT_START}"
cat "${RESULT_JSON_PATH}"
echo "${EVAL_RESULT_END}"

if [[ -f "${ASSERTION_LOG_PATH}" ]]; then
  echo "${ASSERTION_LOG_START}"
  cat "${ASSERTION_LOG_PATH}"
  echo "${ASSERTION_LOG_END}"
fi

exit "${agent_exit_code}"
