Build a CDC pipeline from Postgres to Redpanda:

**Source**: `app.orders` (id, customer_id, amount, created_at). Enable logical replication (wal_level=logical, publication).

**Target**: Redpanda topic `orders` with messages containing: op (insert/update/delete), id, customer_id, amount, created_at, and optionally before/after for updates.

**Requirements**:
1. Use Postgres logical decoding (pgoutput or wal2json) or a CDC connector (Debezium, pgcapture, or custom).
2. Create the `orders` topic in Redpanda if it does not exist.
3. Ensure at least the 10 seeded rows are streamed to the topic.
4. Handle schema consistently (JSON or Avro).