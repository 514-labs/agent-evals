#!/usr/bin/env bash
# Shared seed + baseline-capture for foo-bar-fix-slow-cube-query. Both harnesses
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
#   - analytics.events: 30M rows with realistic OLAP-shape columns
#       (event_id, event_ts spanning 6 months, user_id, event_type incl. 'deleted',
#        region, value, tags Array(String) length 3 from a pool of 20, priority 1..5).
#       MergeTree() ORDER BY event_id (deliberately bad for the canonical filter
#       on event_ts + the high-cardinality cube GROUP BY).
#   - /scenario/expected/{source-row-count,source-uniq-event-id,source-value-sum,
#       source-userid-len-sum,source-tags-len-sum,source-priority-sum,
#       golden-result.jsonl,baseline-ms.txt}
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

# Canonical "OLAP cube" query: monthly rollup of region × tag × priority with
# count, mean, two t-digest quantiles, distinct user count, plus a window total.
# Mirrors the kind of query a real product analytics dashboard would issue
# (see ufa/services/analytical-moose-foobar foo-cube-aggregations API).
read -r -d '' CANONICAL_QUERY <<'SQL' || true
SELECT
  formatDateTime(toStartOfMonth(event_ts), '%Y-%m-01') AS month,
  region,
  arrayJoin(tags) AS tag,
  priority,
  count() AS n,
  avg(value) AS avg_value,
  quantileTDigest(0.5)(value) AS p50,
  quantileTDigest(0.9)(value) AS p90,
  uniqExact(user_id) AS unique_users,
  COUNT() OVER () AS total
FROM analytics.events
WHERE event_ts >= toDateTime('2026-01-01 00:00:00')
  AND event_ts <  toDateTime('2026-07-01 00:00:00')
  AND value IS NOT NULL
  AND event_type != 'deleted'
GROUP BY month, region, tag, priority
ORDER BY month, region, tag, priority
LIMIT 50
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
  value      Float64,
  tags       Array(String),
  priority   UInt8
)
ENGINE = MergeTree()
ORDER BY event_id"

echo "=== bulk-loading 30M rows (each with 3 tags + priority 1..5) ==="
CH --query "
INSERT INTO analytics.events
SELECT
  concat('evt_', leftPad(toString(number), 9, '0')) AS event_id,
  toDateTime('2026-01-01 00:00:00') + toIntervalSecond((number * 17) % (86400 * 180)) AS event_ts,
  concat('usr_', leftPad(toString(cityHash64(number) % 2000000), 7, '0')) AS user_id,
  arrayElement(['pageview', 'click', 'scroll', 'purchase', 'signup', 'deleted'], (number % 6) + 1) AS event_type,
  arrayElement(['us-east', 'us-west', 'eu-west', 'apac', 'sa'], (number % 5) + 1) AS region,
  toFloat64(number % 1000) / 7.0 AS value,
  [
    arrayElement(['t01','t02','t03','t04','t05','t06','t07','t08','t09','t10',
                  't11','t12','t13','t14','t15','t16','t17','t18','t19','t20'], (number % 20) + 1),
    arrayElement(['t01','t02','t03','t04','t05','t06','t07','t08','t09','t10',
                  't11','t12','t13','t14','t15','t16','t17','t18','t19','t20'], ((number * 7) % 20) + 1),
    arrayElement(['t01','t02','t03','t04','t05','t06','t07','t08','t09','t10',
                  't11','t12','t13','t14','t15','t16','t17','t18','t19','t20'], ((number * 13) % 20) + 1)
  ] AS tags,
  toUInt8((number % 5) + 1) AS priority
FROM numbers(30000000)"

cat > /workspace/query.sql <<EOF
-- Canonical slow OLAP-cube query (foo-bar-fix-slow-cube-query).
-- Optimize the storage / indexing / aggregation layer so this query runs in
-- under 100ms (median of 5 cache-cold runs) without dropping or mutating the
-- contents of analytics.events. You may edit this file to document changes,
-- but the evaluator runs its own frozen copy of the query against the database.

${CANONICAL_QUERY};
EOF

cat > /workspace/README.md <<'EOF'
# Foo Bar Fix Slow Cube Query

## What you're given

- ClickHouse running locally with `analytics.events` (30M rows, 6 months of
  data, 5 regions, 20 tag values, 5 priority levels, 6 event types including
  `deleted`).
- The slow cube-aggregation query in `query.sql`.

## Goal

Make the query in `query.sql` run in under 100ms (median of 5 cache-cold runs)
*without* dropping or mutating the data in `analytics.events`.

## Why it's slow

The query is what a real product analytics dashboard does: monthly rollup of
`region × tag × priority` with `count`, `avg`, two `quantileTDigest` quantiles,
`uniqExact(user_id)`, and a `COUNT() OVER ()` window. With `arrayJoin(tags)`
the engine effectively walks ~3x the row count, and the table is sorted by
`event_id` so nothing prunes for the `event_ts` filter.

## Constraints

- Source data integrity: row count, `uniqExact(event_id)`, `sum(value)`,
  `sum(length(user_id))`, `sum(length(tags))`, and `sum(priority)` over
  `analytics.events` must remain unchanged.
- Result equivalence: the rows the canonical query returns must be the same
  set of `(month, region, tag, priority, n, avg_value, p50, p90, unique_users)`
  tuples as before your fix (the harness allows tiny floating-point tolerance
  on `avg_value`, `p50`, `p90`).
- Don't add temporary or backup tables to the `analytics` database.

## Tips

- `EXPLAIN indexes=1, json=1 ...` shows how much data the optimizer thinks it
  must read.
- Common ClickHouse fixes for this shape: `AggregatingMergeTree` materialized
  view rolling the cube up by `(toStartOfMonth(event_ts), region, tag,
  priority)` with `countState`, `avgState`, `quantileTDigestState(0.5)`,
  `quantileTDigestState(0.9)`, `uniqExactState`; or a `PROJECTION` with the
  same shape; or a tuned `ORDER BY` plus skip indexes.
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
CH --query "SELECT toString(sum(length(tags))) FROM analytics.events" \
  > "${EXPECTED_DIR}/source-tags-len-sum.txt"
CH --query "SELECT toString(sum(priority)) FROM analytics.events" \
  > "${EXPECTED_DIR}/source-priority-sum.txt"

echo "  row count:        $(cat ${EXPECTED_DIR}/source-row-count.txt)"
echo "  uniq event_id:    $(cat ${EXPECTED_DIR}/source-uniq-event-id.txt)"
echo "  sum(value):       $(cat ${EXPECTED_DIR}/source-value-sum.txt)"
echo "  sum(len user_id): $(cat ${EXPECTED_DIR}/source-userid-len-sum.txt)"
echo "  sum(len tags):    $(cat ${EXPECTED_DIR}/source-tags-len-sum.txt)"
echo "  sum(priority):    $(cat ${EXPECTED_DIR}/source-priority-sum.txt)"

echo "=== capturing golden query result ==="
CH --query "${CANONICAL_QUERY} FORMAT JSONEachRow" \
  > "${EXPECTED_DIR}/golden-result.jsonl"
golden_lines=$(wc -l < "${EXPECTED_DIR}/golden-result.jsonl")
echo "  golden rows:      ${golden_lines}"

echo "=== measuring baseline latency (5 cache-cold runs) ==="
declare -a TIMINGS_MS
for i in 1 2 3 4 5; do
  CH --query "SYSTEM DROP QUERY CACHE" >/dev/null 2>&1 || true
  CH --query "SYSTEM DROP MARK CACHE" >/dev/null 2>&1 || true
  CH --query "SYSTEM DROP UNCOMPRESSED CACHE" >/dev/null 2>&1 || true
  start_ns=$(date +%s%N)
  CH --query "${CANONICAL_QUERY} FORMAT Null SETTINGS use_query_cache = 0, enable_reads_from_query_cache = 0, enable_writes_to_query_cache = 0"
  end_ns=$(date +%s%N)
  elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
  TIMINGS_MS+=("${elapsed_ms}")
  echo "  run ${i}: ${elapsed_ms} ms"
done

median_ms=$(printf '%s\n' "${TIMINGS_MS[@]}" | sort -n | awk 'NR==3')
echo "${median_ms}" > "${EXPECTED_DIR}/baseline-ms.txt"
echo "  baseline median: ${median_ms} ms (target after fix: < 100 ms)"

echo "=== seed complete ==="
