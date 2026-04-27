#!/usr/bin/env bash
# Per-harness init for base-rt: start system ClickHouse, seed the
# pre-migration schema with 10,000 deterministic rows, and write anchor
# tables (_seed_meta, _seed_spotchecks) that assertions read.
#
# Moved out of the flat init/ because scenario-global supervisord.conf is
# empty (moose harnesses run their own ClickHouse via `moose dev --dockerless`).
set -euo pipefail

# Ownership on data + log dirs; harmless if already correct.
chown -R clickhouse:clickhouse /var/lib/clickhouse 2>/dev/null || true
mkdir -p /var/log/clickhouse-server
chown -R clickhouse:clickhouse /var/log/clickhouse-server 2>/dev/null || true

# Start ClickHouse in the background as the clickhouse user.
su -s /bin/bash clickhouse -c '/usr/bin/clickhouse-server --config-file=/etc/clickhouse-server/config.xml --daemon'

# Wait up to 60s for readiness on the HTTP port.
READY=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://localhost:8123/?query=SELECT%201" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "${READY}" != "1" ]]; then
  echo "ERROR: ClickHouse never became ready on 8123" >&2
  tail -80 /var/log/clickhouse-server/clickhouse-server.log 2>/dev/null || true
  exit 1
fi

# Seed schema, data, and anchor tables.
# - analytics.events: 10,000 deterministic rows via cityHash64 so the
#   content is reproducible across runs.
# - _seed_meta (key,value): invariants assertions read (total_rows + per-type counts).
# - _seed_spotchecks: 5 rows assertions use to probe latency & correctness
#   without hard-coding event_ids in TypeScript.
clickhouse-client --host localhost --port 9000 --multiquery <<'EOF'
CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE analytics.events (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

-- Deterministic seed: cityHash64 on the row number produces the same
-- event_type/event_ts/user_id distribution on every run.
INSERT INTO analytics.events (event_id, event_ts, event_type, user_id)
SELECT
  concat('evt_', leftPad(toString(number + 1), 6, '0')) AS event_id,
  toDateTime('2026-01-01 00:00:00')
    + toIntervalSecond(cityHash64(number) % (30 * 86400)) AS event_ts,
  ['pv','click','purchase','signup','logout'][(cityHash64(number + 1) % 5) + 1] AS event_type,
  concat('usr_', leftPad(toString((cityHash64(number + 2) % 500) + 1), 4, '0')) AS user_id
FROM numbers(10000);

-- _seed_meta: key/value anchor table read by assertions. Populated from
-- the live events table so the numbers stay truthful if seed SQL changes.
CREATE TABLE analytics._seed_meta (
  key String,
  value String
) ENGINE = MergeTree ORDER BY key;

INSERT INTO analytics._seed_meta
SELECT key, value FROM (
  SELECT 'total_rows' AS key, toString(count()) AS value FROM analytics.events
  UNION ALL
  SELECT 'count_pv', toString(countIf(event_type = 'pv')) FROM analytics.events
  UNION ALL
  SELECT 'count_click', toString(countIf(event_type = 'click')) FROM analytics.events
  UNION ALL
  SELECT 'count_purchase', toString(countIf(event_type = 'purchase')) FROM analytics.events
  UNION ALL
  SELECT 'count_signup', toString(countIf(event_type = 'signup')) FROM analytics.events
  UNION ALL
  SELECT 'count_logout', toString(countIf(event_type = 'logout')) FROM analytics.events
);

-- _seed_spotchecks: 5 rows assertions probe for point-lookup latency + row survival.
-- Keyed by event_id for stable targeting; reads the actual seeded row values.
CREATE TABLE analytics._seed_spotchecks (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree ORDER BY event_id;

INSERT INTO analytics._seed_spotchecks
SELECT event_id, event_ts, event_type, user_id
FROM analytics.events
WHERE event_id IN ('evt_000001', 'evt_002500', 'evt_005000', 'evt_007500', 'evt_010000');
EOF

# Tear down ClickHouse so the agent has to bring it back up themselves
# when they start. Data on disk (/var/lib/clickhouse) is preserved — the
# migration task needs the seeded 10k rows to survive the stop/start.
# Walks /proc to find server PIDs without requiring procps (pgrep/pkill
# are not installed in docker/base/Dockerfile).
#
# Reads /proc/<pid>/comm instead of readlink'ing /proc/<pid>/exe: under
# containerized namespacing, readlink of `exe` for a process owned by a
# different UID (clickhouse) silently returns empty even when running as
# root. `comm` is always readable, but is truncated to TASK_COMM_LEN=16
# (15 chars + nul) by the kernel, so "clickhouse-server" appears as
# "clickhouse-serv". Match both the truncated and full forms.
collect_clickhouse_pids() {
  local proc_dir comm
  for proc_dir in /proc/[0-9]*; do
    comm=$(cat "$proc_dir/comm" 2>/dev/null) || continue
    case "$comm" in
      clickhouse-serv|clickhouse-server|clickhouse) echo "${proc_dir##*/}" ;;
    esac
  done
}

# Signal every matching PID (not just the first) in case any child or
# companion process is holding a port.
mapfile -t CH_PIDS < <(collect_clickhouse_pids)
if (( ${#CH_PIDS[@]} > 0 )); then
  for pid in "${CH_PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  # Graceful shutdown up to 15s before SIGKILL.
  for _ in $(seq 1 15); do
    ANY_ALIVE=0
    for pid in "${CH_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then ANY_ALIVE=1; break; fi
    done
    (( ANY_ALIVE == 0 )) && break
    sleep 1
  done
  for pid in "${CH_PIDS[@]}"; do
    kill -KILL "$pid" 2>/dev/null || true
  done
fi

# Pure-bash TCP probe until every port ClickHouse binds is released, so a
# follow-up `clickhouse-server --daemon` doesn't race a still-exiting
# process. Mirrors the pattern used by the moose harness seed scripts.
port_bound() {
  (exec 3<>/dev/tcp/127.0.0.1/"$1") 2>/dev/null && { exec 3<&-; exec 3>&-; return 0; }
  return 1
}
STILL_BOUND=""
for _ in $(seq 1 15); do
  STILL_BOUND=""
  for port in 8123 9000; do
    if port_bound "$port"; then STILL_BOUND="$port"; break; fi
  done
  [[ -z "$STILL_BOUND" ]] && break
  sleep 1
done

# Fail loud if teardown was incomplete — the agent must walk into a cold
# environment. Leaving stragglers would silently change the starting
# contract for downstream runs.
if [[ -n "$STILL_BOUND" ]]; then
  echo "ERROR: ClickHouse port $STILL_BOUND still bound after teardown" >&2
  exit 1
fi
mapfile -t LINGERING < <(collect_clickhouse_pids)
if (( ${#LINGERING[@]} > 0 )); then
  echo "ERROR: clickhouse-server PIDs still running after teardown: ${LINGERING[*]}" >&2
  exit 1
fi

echo "00-start-and-seed.sh (${EVAL_HARNESS:-unknown}): ClickHouse stopped; agent must restart (10000 rows + anchor tables on disk)"
