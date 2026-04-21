Build data quality gates for the `raw.events` table in Postgres. A chaos script has injected four categories of issues:

1. **Null primary keys** — Some rows have NULL `event_id`.
2. **Duplicates** — Identical rows appear multiple times for the same event_id.
3. **Schema drift** — Some rows contain JSON properties (like `device_type`) that don't exist in the target ClickHouse schema.
4. **Stale timestamps** — Some rows have `event_ts` from years ago (2020) mixed in with current data.

Requirements:
- Build quality checks that detect each of the four issues.
- Store the results (counts and categories) in a table or structured output.
- The checks must not produce false positives on the 50 clean rows.
- All quality checks should complete within 500ms.
