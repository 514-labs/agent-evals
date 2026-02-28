#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="/output"
SESSION_LOG_PATH="${OUTPUT_DIR}/session.log"
RESULT_JSON_PATH="${OUTPUT_DIR}/result.json"

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
  /opt/dec-bench/agent/run.sh 2>&1 | tee "${SESSION_LOG_PATH}"
  agent_exit_code="${PIPESTATUS[0]}"
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

tsx /opt/dec-bench/eval-core/src/cli.ts /scenario/assertions > "${RESULT_JSON_PATH}"
cat "${RESULT_JSON_PATH}"

exit "${agent_exit_code}"
