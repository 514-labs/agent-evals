Optimize the ORDER BY for analytics.events:

1. Table has columns: event_id, region, event_ts, amount. Current ORDER BY tuple() or (event_id) causes full scans.
2. Common queries filter by region and event_ts range. Recreate the table with ORDER BY (region, event_ts, event_id) so ClickHouse can skip blocks.
3. Preserve all 2M rows. Target: `SELECT sum(amount) FROM analytics.events WHERE region = 'us-west' AND event_ts >= '2026-01-01'` runs under 100ms.
