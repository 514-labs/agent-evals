A MooseStack project is scaffolded at `/workspace/migrations_demo` pinned to `@514labs/moose-lib@0.6.521` with `features.migrate_with_deltas = true` in `moose.config.toml`. The project declares `analytics.events` with ORDER BY `(event_ts, event_id)`; 8 rows are already seeded. `moose dev` is NOT running — start it yourself with `moose dev --dockerless`.

Change the `OlapTable<Event>` so the effective ORDER BY becomes `(event_type, event_ts, event_id)`, generate a delta migration file under `./migrations/`, and apply it. All 8 original rows must survive.

Use the delta-based migration workflow: `moose generate migration --save --clickhouse-url http://panda:pandapass@localhost:18123` (produces a timestamped YAML under `./migrations/`), review the generated deltas, then `moose migrate --clickhouse-url http://panda:pandapass@localhost:18123` to apply.
