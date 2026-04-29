# ORDER BY optimization

The analytics.events ClickHouse table has ORDER BY tuple(), causing full scans for queries that filter by region and event_ts. Redesign the ORDER BY so those queries run under 100ms while preserving row counts.
