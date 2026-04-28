The slow query in `/workspace/query.sql` is an OLAP cube-aggregation: monthly rollup of `region × tag × priority` over `analytics.events` (30M rows, 6 months of data, 5 regions, 20 tag values, 5 priority levels) computing `count`, `avg(value)`, `quantileTDigest(0.5)`, `quantileTDigest(0.9)`, `uniqExact(user_id)`, plus a `COUNT() OVER ()` window total. Several things compound to make it slow:

- The table is `MergeTree() ORDER BY event_id`, which prunes nothing for the `event_ts` filter.
- `arrayJoin(tags)` triples the rows the GROUP BY sees (each event has 3 tags from a pool of 20).
- `quantileTDigest(0.5)(value)` and `quantileTDigest(0.9)(value)` each maintain sketch state over every row in the filter — they can't be cheaply approximated.
- `event_type != 'deleted'` is a string filter on a non-prefix column.

Bring the median latency below 100ms over 5 cache-cold runs (`SYSTEM DROP MARK CACHE; SYSTEM DROP UNCOMPRESSED CACHE` between runs). Do not drop or alter the row contents of `analytics.events`: row count, `uniqExact(event_id)`, `sum(value)`, `sum(length(user_id))`, `sum(length(tags))`, and `sum(priority)` must remain identical after your fix. The result rows of the canonical query must also match (integer columns exactly, `avg_value` / `p50` / `p90` within ~0.1% relative tolerance).

Common ClickHouse fixes for this shape:

- An `AggregatingMergeTree` materialized view rolling the cube up by `(toStartOfMonth(event_ts), region, tag, priority)` with `countState`, `avgState(value)`, `quantileTDigestState(0.5)(value)`, `quantileTDigestState(0.9)(value)`, `uniqExactState(user_id)`. The query then reads from the rollup with `Merge` finalizers.
- `ALTER TABLE analytics.events ADD PROJECTION p_cube (SELECT month, region, tag, priority, count(), avg(value), ...)` then `MATERIALIZE PROJECTION`.
- Recreate the table (or use `ALTER TABLE ... MODIFY ORDER BY`) with a sort key whose prefix matches the filter, e.g. `ORDER BY (event_ts, region)`. This alone is unlikely to hit 100ms because of the t-digest cost, but it can be combined with the above.

Use `clickhouse-client --query 'EXPLAIN indexes=1 ...'` to verify the optimizer is reading fewer granules. Document what you changed in `/workspace/README.md`.
