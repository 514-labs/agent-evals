A MooseStack project is scaffolded at `/workspace/migrations_demo` pinned to `@514labs/moose-lib@0.6.521`. The project declares `analytics.events` with ORDER BY `(event_ts, event_id)`; 10,000 rows are already seeded. `moose dev` is NOT running — start it yourself.

Change the `OlapTable<Event>` so the effective ORDER BY becomes `(event_type, event_ts, event_id)` and apply the migration. ClickHouse MergeTree does not allow `ALTER TABLE … MODIFY ORDER BY` for this kind of change — the migration is destructive: rebuild the table with the new ORDER BY, backfill every row, and swap it in atomically so downstream consumers see no gap.

All 10,000 original rows must survive.

Leave a short README for the on-call operator (what you did and how to verify), and keep your steps safe to re-run in case we need to replay them.
