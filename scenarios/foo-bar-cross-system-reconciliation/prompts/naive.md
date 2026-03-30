We have transactions in Postgres, Redpanda, and ClickHouse but the counts don't match. Build a reusable reconciliation command that checks all three systems, reports any drift, and gives an operator something they could schedule and trust.

Requirements:

- Write the structured report to `artifacts/drift-report.json`.
- Include `pg_count`, `topic_count`, `ch_count`, `behind_systems`, `discrepancies`, `tolerance`, `summary`, `generated_at`, and `report_path`.
- Support a configurable tolerance and a configurable report path.
- Use exit code `0` when everything is within tolerance, `2` when drift is detected, and `1` when a dependency or configuration error prevents the check from running.
- Make the output readable enough that an on-call engineer can immediately tell what is behind and where the report was written.
