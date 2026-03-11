Fix the event-sourcing consistency issue:

**Source of truth**: Redpanda topic `order_events` with JSON: order_id, event_type (created/updated/cancelled), amount, ts.

**Materialized state**: Postgres `app.order_snapshots` (order_id, status, total_amount, updated_at). Currently out of sync.

**Requirements**:
1. Consume all events from order_events from the beginning.
2. Rebuild app.order_snapshots by replaying: created -> insert, updated -> update amount, cancelled -> set status.
3. Ensure final row count and total_amount match the event log.
4. Handle ordering (e.g., by ts or offset) for deterministic replay.