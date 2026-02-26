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

wait_for_postgres() {
  if [[ -z "${POSTGRES_URL:-}" ]]; then
    return 0
  fi
  for _ in $(seq 1 30); do
    if pg_isready -d "${POSTGRES_URL}" >/dev/null 2>&1; then
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
  for _ in $(seq 1 30); do
    if clickhouse-client --query "SELECT 1" >/dev/null 2>&1; then
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
        if [[ -n "${POSTGRES_URL:-}" ]]; then
          psql "${POSTGRES_URL}" -f "${script}"
        fi
        ;;
      *.sh)
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
