A MooseStack project is scaffolded at `/workspace/migrations_demo` pinned to `@514labs/moose-lib@0.6.521`. The `events` `OlapTable<Event>` currently declares `event_id`, `event_ts`, `event_type`, `user_id` with ORDER BY `(event_ts, event_id)`. 10,000 rows are already loaded. `moose dev` is NOT running — start it yourself.

Target shape for the `events` data source:
- Existing fields preserved: `event_id` (string), `event_ts` (Date), `event_type` (string), `user_id` (string)
- New field: `session_id` (string)
- Every existing row must have `session_id` populated as `concat(user_id, '_', toString(toUnixTimestamp(toStartOfDay(event_ts))))` — verified byte-for-byte by assertions
- Queries that filter by `session_id` should hit the primary-key index

All 10,000 rows must survive. Anchor data sources `local._seed_meta` and `local._seed_spotchecks` also live in this workspace and must not be dropped or mutated.

Leave a short README in `/workspace/` for the on-call operator (what you did and how to verify), and keep your steps safe to re-run.
