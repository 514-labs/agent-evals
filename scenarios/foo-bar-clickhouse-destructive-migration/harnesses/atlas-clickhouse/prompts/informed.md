Change the ORDER BY of `analytics.events` from `(event_ts, event_id)` to `(event_type, event_ts, event_id)`. ClickHouse MergeTree does not allow `ALTER TABLE … MODIFY ORDER BY` for this kind of change — the migration is destructive: rebuild the table with the new ORDER BY, backfill every row, and swap it in atomically so downstream consumers see no gap.

The primary ClickHouse is NOT running — start the server yourself from its persisted data dir (`/var/lib/clickhouse`). All 10,000 original rows are on disk and must survive the migration.

You have [Atlas](https://atlasgo.io/) (`atlas` CLI, already logged in via a bind-mounted `~/.atlas/`) available for schema management. Use the declarative (`schema.hcl` / `schema.sql` + `atlas schema apply`) or versioned (`atlas migrate diff` + `atlas migrate apply`) workflow — whichever makes the swap + backfill cleanest. A separate empty ClickHouse for Atlas's `--dev-url` is already running on `localhost:9001` (HTTP on 8124) with an empty `_atlas_dev` database; the connection URL is in `$CLICKHOUSE_DEV_URL`.

Important: Atlas's declarative workflow treats your schema file as the **complete desired state** — any table missing from it will be proposed for DROP. The baseline schema includes three tables in the `analytics` database: `events` (the one you're changing), `_seed_meta` (key/value anchor, used by verification), and `_seed_spotchecks` (5-row anchor, used by verification). Your schema file must declare **all three**, or Atlas will plan to delete the anchor tables. Start by running `atlas schema inspect` to capture the current shape, then edit only the `events` table's `primary_key` / order-by to the new `(event_type, event_ts, event_id)`.

If Atlas's generated plan does not preserve rows on an ORDER BY change (MergeTree can't ALTER that key), you're responsible for the backfill — Atlas plans the schema change, you ensure data survives.

Leave a short README for the on-call operator (what you did and how to verify), and keep your steps safe to re-run in case we need to replay them.
