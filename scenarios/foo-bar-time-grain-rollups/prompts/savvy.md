Fix the time-grain rollup tables for `analytics.raw_events`.

Create or repair:
- `analytics.rollup_hourly`: bucket by toStartOfHour(event_ts), event_count per hour
- `analytics.rollup_daily`: bucket by toDate(event_ts), event_count per day
- `analytics.rollup_monthly`: bucket by toStartOfMonth(event_ts), event_count per month

Ensure each rollup's event_count sums to the total in raw_events. The current rollups have wrong aggregations or missing grains.
