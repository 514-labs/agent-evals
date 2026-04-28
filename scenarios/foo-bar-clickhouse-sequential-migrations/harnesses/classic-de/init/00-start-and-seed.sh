#!/usr/bin/env bash
# Per-harness init for base-rt: start system ClickHouse, seed the v0
# schema (events WITHOUT session_id) with 10k rows, write anchor tables
# including _seed_spotchecks.expected_session_id computed from the same
# rule the agent's migration #2 must satisfy.
set -euo pipefail

chown -R clickhouse:clickhouse /var/lib/clickhouse 2>/dev/null || true
mkdir -p /var/log/clickhouse-server
chown -R clickhouse:clickhouse /var/log/clickhouse-server 2>/dev/null || true

su -s /bin/bash clickhouse -c '/usr/bin/clickhouse-server --config-file=/etc/clickhouse-server/config.xml --daemon'

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

clickhouse-client --host localhost --port 9000 --multiquery <<'EOF'
CREATE DATABASE IF NOT EXISTS analytics;

-- v0 schema: no session_id yet. The agent must add it in migration #1,
-- backfill it in #2, and change the sort key in #3.
CREATE TABLE analytics.events (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String
) ENGINE = MergeTree()
ORDER BY (event_ts, event_id);

INSERT INTO analytics.events (event_id, event_ts, event_type, user_id)
SELECT
  concat('evt_', leftPad(toString(number + 1), 6, '0')) AS event_id,
  toDateTime('2026-01-01 00:00:00')
    + toIntervalSecond(cityHash64(number) % (30 * 86400)) AS event_ts,
  ['pv','click','purchase','signup','logout'][(cityHash64(number + 1) % 5) + 1] AS event_type,
  concat('usr_', leftPad(toString((cityHash64(number + 2) % 500) + 1), 4, '0')) AS user_id
FROM numbers(10000);

CREATE TABLE analytics._seed_meta (
  key String,
  value String
) ENGINE = MergeTree ORDER BY key;

INSERT INTO analytics._seed_meta
SELECT key, value FROM (
  SELECT 'total_rows' AS key, toString(count()) AS value FROM analytics.events
  UNION ALL SELECT 'count_pv',       toString(countIf(event_type = 'pv'))       FROM analytics.events
  UNION ALL SELECT 'count_click',    toString(countIf(event_type = 'click'))    FROM analytics.events
  UNION ALL SELECT 'count_purchase', toString(countIf(event_type = 'purchase')) FROM analytics.events
  UNION ALL SELECT 'count_signup',   toString(countIf(event_type = 'signup'))   FROM analytics.events
  UNION ALL SELECT 'count_logout',   toString(countIf(event_type = 'logout'))   FROM analytics.events
);

-- Spotchecks carry `expected_session_id` computed at seed time using the
-- same rule (`concat(user_id, '_', toString(toUnixTimestamp(toStartOfDay(event_ts))))`)
-- the agent's migration #2 must apply. Assertions verify the agent's
-- backfill matches this precomputed expectation.
CREATE TABLE analytics._seed_spotchecks (
  event_id String,
  event_ts DateTime,
  event_type String,
  user_id String,
  expected_session_id String
) ENGINE = MergeTree ORDER BY event_id;

INSERT INTO analytics._seed_spotchecks
SELECT event_id,
       event_ts,
       event_type,
       user_id,
       concat(user_id, '_', toString(toUnixTimestamp(toStartOfDay(event_ts)))) AS expected_session_id
FROM analytics.events
WHERE event_id IN ('evt_000001', 'evt_002500', 'evt_005000', 'evt_007500', 'evt_010000');
EOF

# Tear down ClickHouse — agent walks into a cold environment.
collect_clickhouse_pids() {
  local proc_dir comm
  for proc_dir in /proc/[0-9]*; do
    comm=$(cat "$proc_dir/comm" 2>/dev/null) || continue
    case "$comm" in
      clickhouse-serv|clickhouse-server|clickhouse) echo "${proc_dir##*/}" ;;
    esac
  done
}

mapfile -t CH_PIDS < <(collect_clickhouse_pids)
if (( ${#CH_PIDS[@]} > 0 )); then
  for pid in "${CH_PIDS[@]}"; do kill -TERM "$pid" 2>/dev/null || true; done
  for _ in $(seq 1 15); do
    ANY_ALIVE=0
    for pid in "${CH_PIDS[@]}"; do if kill -0 "$pid" 2>/dev/null; then ANY_ALIVE=1; break; fi; done
    (( ANY_ALIVE == 0 )) && break
    sleep 1
  done
  for pid in "${CH_PIDS[@]}"; do kill -KILL "$pid" 2>/dev/null || true; done
fi

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

if [[ -n "$STILL_BOUND" ]]; then
  echo "ERROR: ClickHouse port $STILL_BOUND still bound after teardown" >&2
  exit 1
fi
mapfile -t LINGERING < <(collect_clickhouse_pids)
if (( ${#LINGERING[@]} > 0 )); then
  echo "ERROR: clickhouse-server PIDs still running after teardown: ${LINGERING[*]}" >&2
  exit 1
fi

echo "00-start-and-seed.sh (${EVAL_HARNESS:-unknown}): ClickHouse stopped; 10000 v0 rows + anchors on disk"
