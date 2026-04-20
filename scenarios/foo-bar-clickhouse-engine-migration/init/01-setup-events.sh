#!/usr/bin/env bash
set -euo pipefail

# Seeds analytics.events (MergeTree, 50k rows with intentional duplicates) plus
# anchor tables _seed_meta and _seed_spotchecks that assertions read. Deterministic:
# all row generation uses fixed PRNG seeds via cityHash64 on the row number.

CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"

ch() {
  clickhouse-client --url "$CLICKHOUSE_URL" --query "$1"
}

ch "CREATE DATABASE IF NOT EXISTS analytics"

ch "DROP TABLE IF EXISTS analytics.events"
ch "
CREATE TABLE analytics.events (
  event_id String,
  user_id String,
  event_type String,
  value Float64,
  updated_at DateTime64(3)
) ENGINE = MergeTree
ORDER BY (event_id)
"

# 42,500 primary rows with unique (user_id, event_id) keys.
# updated_at spans 2026-01-01 to 2026-03-31 (about 89 days * 86400 seconds).
ch "
INSERT INTO analytics.events
SELECT
  concat('evt_', leftPad(toString(number), 6, '0'))                               AS event_id,
  concat('usr_', leftPad(toString((cityHash64(number) % 5000) + 1), 5, '0'))      AS user_id,
  ['click','view','purchase','signup','logout'][(cityHash64(number+1) % 5) + 1]  AS event_type,
  round((cityHash64(number+2) % 100000) / 100.0, 2)                              AS value,
  toDateTime64('2026-01-01 00:00:00', 3) + toIntervalSecond(cityHash64(number+3) % 7689600) AS updated_at
FROM numbers(42500)
"

# 7,500 duplicate rows: for each, same (user_id, event_id) as a primary row, newer
# updated_at (add 1 day), different value.
ch "
INSERT INTO analytics.events
SELECT
  e.event_id,
  e.user_id,
  e.event_type,
  e.value + 1000.0                       AS value,
  e.updated_at + toIntervalDay(1)        AS updated_at
FROM analytics.events AS e
ORDER BY e.event_id
LIMIT 7500
"

# Marker tables for assertions.
ch "DROP TABLE IF EXISTS analytics._seed_meta"
ch "
CREATE TABLE analytics._seed_meta (
  key String,
  value String
) ENGINE = MergeTree
ORDER BY key
"
ch "
INSERT INTO analytics._seed_meta VALUES
  ('total_rows', '50000'),
  ('unique_keys', '42500')
"

ch "DROP TABLE IF EXISTS analytics._seed_spotchecks"
ch "
CREATE TABLE analytics._seed_spotchecks (
  user_id String,
  event_id String,
  expected_latest_value Float64
) ENGINE = MergeTree
ORDER BY (user_id, event_id)
"

# Three spot-check keys: pick three event_ids from the duplicated set and record
# the value that the newer (duplicate) row has — that is the value FINAL must return.
ch "
INSERT INTO analytics._seed_spotchecks
SELECT user_id, event_id, value
FROM analytics.events
WHERE event_id IN (
  SELECT event_id
  FROM analytics.events
  GROUP BY event_id, user_id
  HAVING count() > 1
  ORDER BY event_id
  LIMIT 3
)
  AND (event_id, user_id, updated_at) IN (
    SELECT event_id, user_id, max(updated_at)
    FROM analytics.events
    GROUP BY event_id, user_id
  )
"

# Sanity checks: fail init if counts are off.
total=$(ch "SELECT count() FROM analytics.events")
unique=$(ch "SELECT uniqExact((user_id, event_id)) FROM analytics.events")
spotcheck=$(ch "SELECT count() FROM analytics._seed_spotchecks")
echo "Seed: total=$total unique=$unique spotchecks=$spotcheck"
[[ "$total" == "50000" ]] || { echo "FATAL: total row count is $total, expected 50000" >&2; exit 1; }
[[ "$unique" == "42500" ]] || { echo "FATAL: unique key count is $unique, expected 42500" >&2; exit 1; }
[[ "$spotcheck" == "3" ]] || { echo "FATAL: spotcheck row count is $spotcheck, expected 3" >&2; exit 1; }
