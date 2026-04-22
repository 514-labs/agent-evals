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

echo "00-start-and-seed.sh (${EVAL_HARNESS:-unknown}): done (10000 rows + anchor tables)"
