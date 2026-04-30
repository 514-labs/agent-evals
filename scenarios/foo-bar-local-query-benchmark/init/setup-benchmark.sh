#!/usr/bin/env bash
set -euo pipefail

mkdir -p /workspace/benchmarks

cat > /workspace/benchmarks/README.md <<'EOF'
# Local Benchmark

This scenario is intentionally scoped to local development only.

Use `run.sh` to benchmark the three seeded ClickHouse queries after your optimization. The goal is to make the benchmark faster without changing the query results or adding other services.

Latency targets:
- `q1.sql` under 200ms
- `q2.sql` under 200ms
- `q3.sql` under 150ms
EOF

cat > /workspace/benchmarks/q1.sql <<'EOF'
SELECT
  toDate(event_ts) AS day,
  count() AS events,
  sum(bytes) AS total_bytes
FROM analytics.events_local
WHERE workspace_id = 42
  AND event_date >= toDate('2026-02-01')
  AND event_date < toDate('2026-03-01')
GROUP BY day
ORDER BY day
EOF

cat > /workspace/benchmarks/q2.sql <<'EOF'
SELECT
  event_type,
  uniqExact(account_id) AS active_accounts,
  quantileExact(0.95)(duration_ms) AS p95_duration
FROM analytics.events_local
WHERE workspace_id = 42
  AND event_date >= toDate('2026-02-01')
  AND event_date < toDate('2026-03-01')
GROUP BY event_type
ORDER BY event_type
EOF

cat > /workspace/benchmarks/q3.sql <<'EOF'
SELECT
  toStartOfHour(event_ts) AS hour,
  count() AS events
FROM analytics.events_local
WHERE workspace_id = 42
  AND event_ts >= toDateTime('2026-02-10 00:00:00')
  AND event_ts < toDateTime('2026-02-12 00:00:00')
GROUP BY hour
ORDER BY hour
EOF

cat > /workspace/benchmarks/run.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

CLICKHOUSE_URL="${CLICKHOUSE_URL:?CLICKHOUSE_URL must be set}"
BENCH_DIR="/workspace/benchmarks"
REPEATS="${1:-3}"

for query in "$BENCH_DIR"/q1.sql "$BENCH_DIR"/q2.sql "$BENCH_DIR"/q3.sql; do
  best_ms=""
  echo "== $(basename "$query") =="
  for run in $(seq 1 "$REPEATS"); do
    start_ms="$(date +%s%3N)"
    curl -fsS "${CLICKHOUSE_URL%/}/" --data-binary @"$query" >/tmp/local-query-benchmark.out
    end_ms="$(date +%s%3N)"
    elapsed_ms="$((end_ms - start_ms))"
    echo "run ${run}: ${elapsed_ms}ms"
    if [[ -z "$best_ms" || "$elapsed_ms" -lt "$best_ms" ]]; then
      best_ms="$elapsed_ms"
    fi
  done
  echo "best: ${best_ms}ms"
  echo
done
EOF
