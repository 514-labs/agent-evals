#!/usr/bin/env bash
# Shared seed + baseline-capture for foo-bar-fix-slow-query. Both harnesses
# (base-rt and moose-initialized) call this with environment variables that
# point at whichever ClickHouse is hosting the scenario:
#
#   CH_HOST            (default: localhost)
#   CH_TCP_PORT        (default: 9000)
#   CH_HTTP_URL        (e.g. http://localhost:8123 or http://panda:pandapass@localhost:18123)
#   CH_USER            (optional)
#   CH_PASSWORD        (optional)
#
# Outcome (identical for both harnesses):
#   - analytics.events: 100M rows, MergeTree() ORDER BY event_id (deliberately bad).
#   - /scenario/expected/{source-row-count,source-uniq-event-id,source-value-sum,source-userid-len-sum,golden-result.jsonl,baseline-ms.txt}
#   - /workspace/query.sql + /workspace/README.md
set -eu

CH_HOST="${CH_HOST:-localhost}"
CH_TCP_PORT="${CH_TCP_PORT:-9000}"
CH_HTTP_URL="${CH_HTTP_URL:-http://localhost:8123}"

CH_CLIENT_ARGS=(--host "${CH_HOST}" --port "${CH_TCP_PORT}")
if [[ -n "${CH_USER:-}" ]]; then
  CH_CLIENT_ARGS+=(--user "${CH_USER}")
fi
if [[ -n "${CH_PASSWORD:-}" ]]; then
  CH_CLIENT_ARGS+=(--password "${CH_PASSWORD}")
fi

CH() { clickhouse-client "${CH_CLIENT_ARGS[@]}" "$@"; }

EXPECTED_DIR="/scenario/expected"
mkdir -p "${EXPECTED_DIR}" /workspace

read -r -d '' CANONICAL_QUERY <<'SQL' || true
SELECT
  toDate(event_ts) AS day,
  count() AS event_count,
  uniqExact(user_id) AS unique_users
FROM analytics.events
WHERE region = 'us-east'
  AND event_ts >= toDateTime('2026-02-01 00:00:00')
  AND event_ts <  toDateTime('2026-02-08 00:00:00')
GROUP BY day
ORDER BY day
SQL

echo "=== creating analytics.events with deliberately bad ORDER BY ==="
CH --query "CREATE DATABASE IF NOT EXISTS analytics"
CH --query "DROP TABLE IF EXISTS analytics.events"
CH --query "
CREATE TABLE analytics.events (
  event_id   String,
  event_ts   DateTime,
  user_id    String,
  event_type String,
  region     String,
  value      Float64
)
ENGINE = MergeTree()
ORDER BY event_id"

echo "=== bulk-loading 100M rows ==="
CH --query "
INSERT INTO analytics.events
SELECT
  concat('evt_', leftPad(toString(number), 9, '0')),
  toDateTime('2026-01-01 00:00:00') + toIntervalSecond((number * 17) % (86400 * 60)),
  concat('usr_', leftPad(toString(cityHash64(number) % 5000000), 7, '0')),
  arrayElement(['pageview', 'click', 'scroll', 'purchase', 'signup'], (number % 5) + 1),
  arrayElement(['us-east', 'us-west', 'eu-west', 'apac', 'sa'], (number % 5) + 1),
  toFloat64(number % 1000) / 7.0
FROM numbers(100000000)"

cat > /workspace/query.sql <<EOF
-- Canonical slow query. Optimize the storage / indexing / aggregation layer
-- so this query runs in under 100ms, without dropping or mutating
-- analytics.events. You may edit this file to document changes, but the
-- evaluator runs its own frozen copy of the query against the database.

${CANONICAL_QUERY};
EOF

cat > /workspace/README.md <<'EOF'
# Foo Bar Fix Slow Query

## What you're given

- ClickHouse running locally with `analytics.events` (100M rows).
- The slow query in `query.sql`.

## Goal

Make the query in `query.sql` run in under 100ms (median of 5 cache-cold runs)
*without* dropping or mutating the data in `analytics.events`.

## Constraints

- Source data integrity: row count, `uniqExact(event_id)`, `sum(value)`, and
  `sum(length(user_id))` over `analytics.events` must remain unchanged.
- Result equivalence: the rows the canonical query returns must be the same
  set of `(day, event_count, unique_users)` triples as before your fix.
- Don't add temporary or backup tables to the `analytics` database.

## Tips

- `clickhouse-client --query 'EXPLAIN indexes=1, json=1 ...'` shows how much
  data the optimizer thinks it must read.
- Common ClickHouse fixes for this shape: change ORDER BY, add a projection,
  add a MaterializedView rolling up by `(region, day)`.
EOF

echo "=== capturing source-data integrity fingerprint ==="
CH --query "SELECT count() FROM analytics.events" \
  > "${EXPECTED_DIR}/source-row-count.txt"
CH --query "SELECT toString(uniqExact(event_id)) FROM analytics.events" \
  > "${EXPECTED_DIR}/source-uniq-event-id.txt"
CH --query "SELECT toString(sum(value)) FROM analytics.events" \
  > "${EXPECTED_DIR}/source-value-sum.txt"
CH --query "SELECT toString(sum(length(user_id))) FROM analytics.events" \
  > "${EXPECTED_DIR}/source-userid-len-sum.txt"

echo "  row count:        $(cat ${EXPECTED_DIR}/source-row-count.txt)"
echo "  uniq event_id:    $(cat ${EXPECTED_DIR}/source-uniq-event-id.txt)"
echo "  sum(value):       $(cat ${EXPECTED_DIR}/source-value-sum.txt)"
echo "  sum(len user_id): $(cat ${EXPECTED_DIR}/source-userid-len-sum.txt)"

echo "=== capturing golden query result ==="
CH --query "${CANONICAL_QUERY} FORMAT JSONEachRow" \
  > "${EXPECTED_DIR}/golden-result.jsonl"
golden_lines=$(wc -l < "${EXPECTED_DIR}/golden-result.jsonl")
echo "  golden rows:      ${golden_lines}"

echo "=== measuring baseline latency (5 cache-cold runs) ==="
declare -a TIMINGS_MS
for i in 1 2 3 4 5; do
  CH --query "SYSTEM DROP MARK CACHE" >/dev/null 2>&1 || true
  CH --query "SYSTEM DROP UNCOMPRESSED CACHE" >/dev/null 2>&1 || true
  start_ns=$(date +%s%N)
  CH --query "${CANONICAL_QUERY} FORMAT Null"
  end_ns=$(date +%s%N)
  elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
  TIMINGS_MS+=("${elapsed_ms}")
  echo "  run ${i}: ${elapsed_ms} ms"
done

median_ms=$(printf '%s\n' "${TIMINGS_MS[@]}" | sort -n | awk 'NR==3')
echo "${median_ms}" > "${EXPECTED_DIR}/baseline-ms.txt"
echo "  baseline median: ${median_ms} ms (target after fix: < 100 ms)"

echo "=== seed complete ==="
