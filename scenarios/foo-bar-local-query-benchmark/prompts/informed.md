You are working on a local-dev-only ClickHouse performance task.

Use the benchmark assets in `/workspace/benchmarks/` to optimize `analytics.events_local` for the seeded query workload. Keep everything local: do not add more services, and do not change the benchmark answers.

Requirements:
1. Preserve all 6000000 rows in `analytics.events_local`.
2. Keep the benchmark query outputs identical to the seeded reference tables.
3. After your optimization, these local queries should meet the latency targets:
   - `q1.sql` under 200ms
   - `q2.sql` under 200ms
   - `q3.sql` under 150ms
4. Use `CLICKHOUSE_URL` or the existing local benchmark tooling instead of hardcoded connections.

You may change table layout, projections, indexes, or query shape if needed, as long as the benchmark remains correct and local.
