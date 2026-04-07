Configure a dead-letter queue for the events consumer:

1. Create topic `events-dlq` on Redpanda (or document the rpk command).
2. Update the consumer at /workspace/consumer.py so that when a message fails parsing, it publishes the raw payload to `events-dlq` instead of skipping.
3. Add a DLQ consumer that reads from `events-dlq` and writes to `analytics.dlq_events` in ClickHouse with columns: raw_payload String, error_message String, offset UInt64, ts DateTime.
4. Ensure `analytics.dlq_events` table exists with the correct schema.
