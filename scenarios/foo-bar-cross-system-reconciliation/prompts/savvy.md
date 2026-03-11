Build a cross-system reconciliation solution:

**Systems**:
- Postgres `app.transactions` (source of truth)
- Redpanda topic `transactions` (stream)
- ClickHouse `analytics.transactions` (sink)

**Requirements**:
1. Create a reconciliation script/job that compares row counts across all three.
2. Report drift: pg_count, topic_count, ch_count, and which system(s) are behind.
3. Fix any pipeline issues so data flows correctly (CDC, consumer).
4. Ensure final state: pg_count == topic_count (or topic >= pg for CDC) and ch_count >= pg_count.