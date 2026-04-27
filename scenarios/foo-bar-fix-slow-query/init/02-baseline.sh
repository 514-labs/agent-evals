#!/usr/bin/env bash
set -eu

CH="clickhouse-client --host ${CLICKHOUSE_HOST:-localhost} --port 9000"

EXPECTED_DIR="/scenario/expected"
mkdir -p "${EXPECTED_DIR}" /workspace

# The canonical slow query. The agent gets a copy at /workspace/query.sql for
# their own EXPLAIN/iteration, but assertions use their own hardcoded copy so
# the agent cannot pass by editing this file.
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

- Source data integrity: row count, unique event ids, `sum(value)` and
  `sum(length(user_id))` over `analytics.events` must remain unchanged.
- Result equivalence: the rows the canonical query returns must be the same
  set of `(day, event_count)` pairs as before your fix.
- Don't add temporary or backup tables to the `analytics` database.

## Tips

- `clickhouse-client --query 'EXPLAIN indexes=1, json=1 ...'` shows how much
  data the optimizer thinks it must read.
- Common ClickHouse fixes for this shape: change ORDER BY, add a projection,
  add a MaterializedView rolling up by `(region, day)`.
EOF

echo "=== Capturing source-data integrity fingerprint ==="
$CH --query "SELECT count() FROM analytics.events" \
  > "${EXPECTED_DIR}/source-row-count.txt"
$CH --query "SELECT toString(sum(value)) FROM analytics.events" \
  > "${EXPECTED_DIR}/source-value-sum.txt"
$CH --query "SELECT toString(sum(length(user_id))) FROM analytics.events" \
  > "${EXPECTED_DIR}/source-userid-len-sum.txt"
$CH --query "SELECT toString(uniqExact(event_id)) FROM analytics.events" \
  > "${EXPECTED_DIR}/source-uniq-event-id.txt"

echo "  row count:        $(cat ${EXPECTED_DIR}/source-row-count.txt)"
echo "  uniq event_id:    $(cat ${EXPECTED_DIR}/source-uniq-event-id.txt)"
echo "  sum(value):       $(cat ${EXPECTED_DIR}/source-value-sum.txt)"
echo "  sum(len user_id): $(cat ${EXPECTED_DIR}/source-userid-len-sum.txt)"

echo "=== Capturing golden query result ==="
$CH --query "${CANONICAL_QUERY} FORMAT JSONEachRow" \
  > "${EXPECTED_DIR}/golden-result.jsonl"
golden_lines=$(wc -l < "${EXPECTED_DIR}/golden-result.jsonl")
echo "  golden rows:      ${golden_lines}"

echo "=== Measuring baseline latency (5 cache-cold runs) ==="
declare -a TIMINGS_MS
for i in 1 2 3 4 5; do
  $CH --query "SYSTEM DROP MARK CACHE" >/dev/null 2>&1 || true
  $CH --query "SYSTEM DROP UNCOMPRESSED CACHE" >/dev/null 2>&1 || true
  start_ns=$(date +%s%N)
  $CH --query "${CANONICAL_QUERY} FORMAT Null"
  end_ns=$(date +%s%N)
  elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
  TIMINGS_MS+=("${elapsed_ms}")
  echo "  run ${i}: ${elapsed_ms} ms"
done

# Median of 5 = 3rd value of sorted list.
median_ms=$(printf '%s\n' "${TIMINGS_MS[@]}" | sort -n | awk 'NR==3')
echo "${median_ms}" > "${EXPECTED_DIR}/baseline-ms.txt"
echo "  baseline median: ${median_ms} ms (target after fix: < 100 ms)"

echo "=== Init complete ==="
