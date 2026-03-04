Fix the consumer lag for the events pipeline:

1. The consumer at /workspace/consumer.py reads from topic `events` and writes to `analytics.events_sink`.
2. The topic has ~10,000 messages; the sink has far fewer due to slow consumer (single thread, batch size 10).
3. Tune the consumer: increase `max_poll_records`, use multiple consumer instances or threads, and/or increase `fetch_min_bytes`/`fetch_max_wait_ms` for better throughput.
4. The sink table `analytics.events_sink` should eventually contain at least 9,500 rows (allowing for some tolerance).
