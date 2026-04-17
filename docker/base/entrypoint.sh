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
SERVICE_LOGS_START="__DEC_BENCH_SERVICE_LOGS_JSON_START__"
SERVICE_LOGS_END="__DEC_BENCH_SERVICE_LOGS_JSON_END__"

mkdir -p "${OUTPUT_DIR}" /workspace

if [[ "${NETWORK_POLICY:-open}" == "restricted" ]] && [[ -x /opt/dec-bench/agent/iptables.sh ]]; then
  /opt/dec-bench/agent/iptables.sh
fi

source_scenario_env() {
  if [[ ! -f /scenario/env.sh ]]; then
    return 0
  fi
  echo "Sourcing scenario env: /scenario/env.sh"
  set -a
  # shellcheck source=/dev/null
  . /scenario/env.sh
  set +a
}

source_scenario_env

if [[ -f /etc/supervisord.conf ]]; then
  supervisord -c /etc/supervisord.conf
fi

detect_services() {
  export SUPERVISED_POSTGRES=0
  export SUPERVISED_CLICKHOUSE=0
  export SUPERVISED_REDPANDA=0
  if [[ -f /etc/supervisord.conf ]]; then
    if grep -q "\[program:postgres\]" /etc/supervisord.conf 2>/dev/null; then
      export SUPERVISED_POSTGRES=1
      export POSTGRES_URL="${POSTGRES_URL:-postgresql://postgres@localhost:5432/postgres}"
      export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
      export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
    fi
    if grep -q "\[program:clickhouse\]" /etc/supervisord.conf 2>/dev/null; then
      export SUPERVISED_CLICKHOUSE=1
      export CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
      export CLICKHOUSE_HOST="${CLICKHOUSE_HOST:-localhost}"
      export CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-8123}"
    fi
    if grep -q "\[program:redpanda\]" /etc/supervisord.conf 2>/dev/null; then
      export SUPERVISED_REDPANDA=1
      export REDPANDA_BROKER="${REDPANDA_BROKER:-localhost:9092}"
    fi
  fi
}

detect_services

wait_for_postgres() {
  if [[ "${SUPERVISED_POSTGRES:-0}" != "1" ]]; then
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
  if [[ "${SUPERVISED_CLICKHOUSE:-0}" != "1" ]]; then
    return 0
  fi
  echo "Waiting for ClickHouse..."
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 2 "${CLICKHOUSE_URL%/}/?query=SELECT%201" >/dev/null 2>&1; then
      echo "ClickHouse is ready."
      return 0
    fi
    sleep 1
  done
  echo "ClickHouse did not become ready." >&2
  return 1
}

wait_for_redpanda() {
  if [[ "${SUPERVISED_REDPANDA:-0}" != "1" ]]; then
    return 0
  fi
  local broker="${REDPANDA_BROKER}"
  local host="${broker%%:*}"
  local port="${broker##*:}"
  if [[ "${host}" == "${port}" ]]; then
    port="9092"
  fi
  echo "Waiting for Redpanda..."
  for _ in $(seq 1 120); do
    if bash -lc ">/dev/tcp/${host}/${port}" >/dev/null 2>&1; then
      echo "Redpanda is ready."
      return 0
    fi
    sleep 1
  done
  echo "Redpanda did not become ready at ${host}:${port}." >&2
  return 1
}

clickhouse_data_exists() {
  local dir="$1"
  [[ -d "${dir}/store" ]] || [[ -d "${dir}/data" ]] || [[ -d "${dir}/metadata" ]]
}

ensure_clickhouse_for_assertions() {
  local url="${CLICKHOUSE_URL:-}"

  # If no CLICKHOUSE_URL, check if ClickHouse data exists on disk
  if [[ -z "${url}" ]]; then
    if clickhouse_data_exists "/var/lib/clickhouse"; then
      url="http://localhost:8123"
    else
      return 0
    fi
  fi

  # Check if ClickHouse is listening (accept 401 as "running but needs auth")
  clickhouse_is_up() {
    local probe_url="$1"
    local http_code
    http_code="$(curl -sS --max-time 2 -o /dev/null -w '%{http_code}' "${probe_url}/?query=SELECT%201" 2>/dev/null)" || true
    [[ "${http_code}" =~ ^[2-4][0-9][0-9]$ ]]
  }

  # Already reachable? Nothing to do.
  if clickhouse_is_up "${url%/}"; then
    return 0
  fi

  # Check common ports -- agent may have started ClickHouse on a different port
  # than CLICKHOUSE_URL specifies (e.g. Moose uses 18123, system default is 8123)
  for probe_port in 8123 18123; do
    if clickhouse_is_up "http://localhost:${probe_port}"; then
      echo "ClickHouse is running on port ${probe_port}; redirecting assertions there."
      # Try with Moose default credentials first, fall back to no-auth
      if curl -fsS --max-time 2 "http://panda:pandapass@localhost:${probe_port}/?query=SELECT%201" >/dev/null 2>&1; then
        export CLICKHOUSE_URL="http://panda:pandapass@localhost:${probe_port}"
      else
        export CLICKHOUSE_URL="http://localhost:${probe_port}"
      fi
      return 0
    fi
  done

  echo "ClickHouse unreachable at ${url}; attempting recovery for assertions..."

  # Strip auth from URL (recovery server has no auth)
  local noauth_url
  noauth_url="$(echo "${url}" | sed -E 's|://[^@]+@|://|')"

  # Extract port from URL using pure bash
  local hostport="${url#*://}"
  hostport="${hostport#*@}"
  hostport="${hostport%%/*}"
  local port="${hostport##*:}"
  if [[ "${port}" == "${hostport}" ]] || [[ -z "${port}" ]]; then
    port="8123"
  fi

  # Find ClickHouse data directory (check store/, data/, or metadata/ as markers)
  local data_dir=""
  for candidate in \
    /var/lib/clickhouse \
    /workspace/*/.moose/native_infra/clickhouse \
    /*/.moose/native_infra/clickhouse; do
    if clickhouse_data_exists "${candidate}"; then
      data_dir="${candidate}"
      break
    fi
  done
  # Broader search if not found in known paths
  if [[ -z "${data_dir}" ]]; then
    local found
    found="$(find / -maxdepth 8 -type d -name 'data' -path '*native_infra/clickhouse*' 2>/dev/null | head -1)"
    if [[ -z "${found}" ]]; then
      found="$(find / -maxdepth 6 -type d -name 'data' -path '*clickhouse*' ! -path '/proc/*' ! -path '/sys/*' 2>/dev/null | head -1)"
    fi
    if [[ -n "${found}" ]]; then
      data_dir="$(dirname "${found}")"
    fi
  fi

  if [[ -z "${data_dir}" ]]; then
    echo "No ClickHouse data directory found; skipping recovery."
    return 0
  fi

  echo "Found ClickHouse data at ${data_dir}"

  # Remove stale lock from unclean shutdown
  rm -f "${data_dir}/status" "${data_dir}/data/status" 2>/dev/null || true

  # Extract port from Moose's config.xml if present
  if [[ -f "${data_dir}/config.xml" ]]; then
    local cfg_port
    cfg_port="$(sed -n 's|.*<http_port>\([0-9]*\)</http_port>.*|\1|p' "${data_dir}/config.xml" | head -1)"
    if [[ -n "${cfg_port}" ]]; then
      port="${cfg_port}"
    fi
  fi

  # Resolve the data path -- Moose nests data under data/ subdirectory
  local ch_path="${data_dir}/"
  if [[ -d "${data_dir}/data" ]]; then
    ch_path="${data_dir}/data/"
  fi

  # Always generate a minimal recovery config (Moose's config has keeper/users.xml
  # dependencies that may not survive the agent exiting)
  local cfg="/tmp/clickhouse-recovery.xml"
  cat > "${cfg}" <<CHXML
<?xml version="1.0"?>
<clickhouse>
  <logger>
    <level>warning</level>
    <log>/tmp/clickhouse-recovery.log</log>
    <errorlog>/tmp/clickhouse-recovery.err.log</errorlog>
  </logger>
  <http_port>${port}</http_port>
  <tcp_port>19876</tcp_port>
  <path>${ch_path}</path>
  <tmp_path>${ch_path}tmp/</tmp_path>
  <user_files_path>${ch_path}user_files/</user_files_path>
  <format_schema_path>${ch_path}format_schemas/</format_schema_path>
  <listen_host>127.0.0.1</listen_host>
  <mark_cache_size>524288000</mark_cache_size>
  <profiles><default/></profiles>
  <users>
    <default>
      <password></password>
      <networks><ip>::/0</ip></networks>
      <profile>default</profile>
      <quota>default</quota>
      <access_management>1</access_management>
    </default>
  </users>
  <quotas><default><interval><duration>3600</duration><queries>0</queries><errors>0</errors><result_rows>0</result_rows><read_rows>0</read_rows><execution_time>0</execution_time></interval></default></quotas>
</clickhouse>
CHXML

  # Find a ClickHouse binary: prefer Moose's cached binary, fall back to system
  local ch_bin="clickhouse-server"
  local moose_bin
  moose_bin="$(find /root/.moose/binaries /root/.moose/versions /workspace -maxdepth 6 -name 'clickhouse' -type f -executable 2>/dev/null | head -1)"
  if [[ -n "${moose_bin}" ]]; then
    ch_bin="${moose_bin} server"
    echo "Using Moose ClickHouse binary: ${moose_bin}"
  fi

  chown -R clickhouse:clickhouse "${data_dir}" 2>/dev/null || true
  su -s /bin/bash clickhouse -c "${ch_bin} --config-file=${cfg} --daemon" 2>/tmp/clickhouse-recovery-start.err || true

  # Update env for the assertion process
  export CLICKHOUSE_URL="${noauth_url:-http://localhost:${port}}"

  # Wait for ready
  for _ in $(seq 1 30); do
    if clickhouse_is_up "http://localhost:${port}"; then
      echo "Recovery ClickHouse ready on port ${port}."
      return 0
    fi
    sleep 1
  done

  echo "Recovery ClickHouse failed to start; assertions will proceed without it." >&2
  tail -20 /tmp/clickhouse-recovery.err.log 2>/dev/null || true
  return 0
}

collect_service_logs() {
  # Collect logs from all known services into a JSON object keyed by service name.
  # Each value is the tail of that service's log (capped to avoid bloating stdout).
  local max_lines=200

  node -e '
const fs = require("node:fs");
const path = require("node:path");
const maxLines = Number(process.argv[1]) || 200;

// Known log locations: [serviceName, ...candidatePaths]
const sources = [
  ["clickhouse", "/tmp/clickhouse.log", "/tmp/clickhouse.err.log", "/tmp/clickhouse-recovery.log", "/tmp/clickhouse-recovery.err.log"],
  ["postgres", "/tmp/postgres.log", "/tmp/postgres.err.log"],
  ["redpanda", "/tmp/redpanda.log", "/tmp/redpanda.err.log"],
  ["supervisord", "/tmp/supervisord.log"],
];

// Discover Moose CLI logs from ~/.moose/*.log
try {
  const home = process.env.HOME || "/root";
  const mooseDir = path.join(home, ".moose");
  if (fs.existsSync(mooseDir)) {
    const cliLogs = fs.readdirSync(mooseDir)
      .filter(f => f.endsWith("-cli.log"))
      .map(f => path.join(mooseDir, f));
    if (cliLogs.length > 0) {
      sources.push(["moose-cli", ...cliLogs]);
    }
  }
} catch {}

// Discover Moose native_infra logs (ClickHouse/Temporal started by moose dev --dockerless)
try {
  const findMooseLogs = (dir, depth) => {
    if (depth > 5) return [];
    const found = [];
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isFile() && /\.(log|err\.log)$/.test(entry.name)) {
          found.push(full);
        } else if (entry.isDirectory() && !["node_modules", ".git", "dist"].includes(entry.name)) {
          found.push(...findMooseLogs(full, depth + 1));
        }
      }
    } catch {}
    return found;
  };

  for (const root of ["/workspace", "/"]) {
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const mooseDir = path.join(root, entry.name, ".moose", "native_infra");
        if (fs.existsSync(mooseDir)) {
          const logs = findMooseLogs(mooseDir, 0);
          if (logs.length > 0) {
            sources.push(["moose-infra", ...logs]);
          }
        }
      }
    } catch {}
  }
} catch {}

// Also grab any agent-started service logs from /tmp
try {
  for (const f of fs.readdirSync("/tmp")) {
    if (!/\.log$/.test(f)) continue;
    const full = path.join("/tmp", f);
    // Skip already-known files
    if (sources.some(([, ...paths]) => paths.includes(full))) continue;
    // Add as "other" service
    const svc = f.replace(/\.(err\.)?log$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    sources.push([svc, full]);
  }
} catch {}

const result = {};
for (const [service, ...paths] of sources) {
  const entries = {};
  for (const p of paths) {
    try {
      const stat = fs.statSync(p);
      if (!stat.isFile() || stat.size === 0) continue;
      const content = fs.readFileSync(p, "utf8");
      const lines = content.split("\n");
      const tail = lines.slice(-maxLines).join("\n");
      entries[path.basename(p)] = {
        path: p,
        totalLines: lines.length,
        truncated: lines.length > maxLines,
        content: tail,
      };
    } catch {}
  }
  if (Object.keys(entries).length > 0) {
    result[service] = entries;
  }
}

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
' "${max_lines}"
}

# Per-harness init support (514-1222): flat files in /scenario/init run for
# every harness; files in /scenario/init/<harness-id>/ run only when that
# harness is active.
dispatch_init_script() {
  local script="$1"
  case "${script}" in
    *.sql)
      if [[ "${SUPERVISED_POSTGRES:-0}" == "1" ]] && [[ "${script}" == *postgres* ]]; then
        echo "Running Postgres init: ${script}"
        psql "${POSTGRES_URL}" -f "${script}"
      elif [[ "${SUPERVISED_CLICKHOUSE:-0}" == "1" ]] && [[ "${script}" == *clickhouse* ]]; then
        echo "Running ClickHouse init: ${script}"
        clickhouse-client --host "${CLICKHOUSE_HOST:-localhost}" --port 9000 --multiquery < "${script}"
      elif [[ "${SUPERVISED_POSTGRES:-0}" == "1" ]]; then
        echo "Running SQL init (Postgres): ${script}"
        psql "${POSTGRES_URL}" -f "${script}"
      elif [[ "${SUPERVISED_CLICKHOUSE:-0}" == "1" ]]; then
        echo "Running SQL init (ClickHouse): ${script}"
        clickhouse-client --host "${CLICKHOUSE_HOST:-localhost}" --port 9000 --multiquery < "${script}"
      else
        echo "Skipping SQL init without a supervised database target: ${script}"
      fi
      ;;
    *.sh)
      echo "Running shell init: ${script}"
      bash "${script}"
      ;;
  esac
}

run_init_scripts() {
  if [[ ! -d /scenario/init ]]; then
    return 0
  fi
  shopt -s nullglob

  # Flat files in /scenario/init/ run for every harness (common setup).
  # Subdirectories /scenario/init/<harness-id>/ run only when the matching
  # harness is active. See SKILL.md "Three lifecycle moments".
  for script in /scenario/init/*; do
    [[ -f "${script}" ]] || continue
    dispatch_init_script "${script}"
  done

  if [[ -n "${EVAL_HARNESS:-}" && -d "/scenario/init/${EVAL_HARNESS}" ]]; then
    echo "Running harness-specific init for ${EVAL_HARNESS}"
    for script in "/scenario/init/${EVAL_HARNESS}"/*; do
      [[ -f "${script}" ]] || continue
      dispatch_init_script "${script}"
    done
  fi
}

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
