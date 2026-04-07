Build a cross-system reconciliation solution:

**Systems**:
- Postgres `app.transactions` (source of truth)
- Redpanda topic `transactions` (stream)
- ClickHouse `analytics.transactions` (sink)

**Requirements**:
1. Create a reusable reconciliation entrypoint under `scripts/` or `bin/` that can be scheduled later.
2. Support `--tolerance <float>` and `--report-path <path>`.
3. Write the canonical structured report to `artifacts/drift-report.json`.
4. The report must include:
   - `status`
   - `generated_at`
   - `tolerance`
   - `pg_count`
   - `topic_count`
   - `ch_count`
   - `behind_systems`
   - `discrepancies` with concrete `{ system, expected, actual, difference }` entries when drift exists
   - `summary`
   - `report_path`
5. Use exit code `0` when counts are within tolerance, `2` when drift is detected, and `1` when the command cannot run because a dependency or configuration is broken.
6. Log an operator-friendly summary that makes it obvious which system is behind and where the report was written.
7. Keep the implementation production-credible: no `SELECT *`, no unbounded dependency waits, and no one-off throwaway scripts outside the reusable entrypoint.