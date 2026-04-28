The slow query in `/workspace/query.sql` is an OLAP cube-aggregation against `analytics.events` (30M rows, 6 months of data, 5 regions, 20 tag values, 5 priority levels, 6 event types including `deleted`). The table is `MergeTree() ORDER BY event_id`, deliberately uncorrelated with how this query filters and groups.

Make the canonical query in `/workspace/query.sql` run in under **100ms** (median of 5 cache-cold runs — `SYSTEM DROP MARK CACHE; SYSTEM DROP UNCOMPRESSED CACHE` between runs). The evaluator runs that exact query as-is — your job is to change the storage / indexing / aggregation layer so that query becomes fast, not to rewrite the query itself. Keep iterating until you actually hit the target; measure each iteration end-to-end against the canonical query the way the evaluator will, and don't stop at the first attempt that "feels faster".

Constraints:

- The contents of `analytics.events` must remain identical: row count, `uniqExact(event_id)`, `sum(value)`, `sum(length(user_id))`, `sum(length(tags))`, and `sum(priority)` are all checked.
- The result rows of the canonical query must still match: integer columns exactly, float aggregates within ~3% relative (the `quantileTDigest` sketch tolerates that).
- Don't leave temp / backup tables in the `analytics` database.

Document what you tried, what worked, and what didn't in `/workspace/README.md`.
