Fix the broken ClickHouse materialized view over `analytics.raw_events`.

The MV should aggregate to `analytics.daily_event_summary` with columns: `day` (Date), `event_type` (String), `event_count` (UInt64). The current MV definition has schema mismatches or incorrect TO clause. Ensure the MV populates correctly on INSERT and that existing source data is reflected.
