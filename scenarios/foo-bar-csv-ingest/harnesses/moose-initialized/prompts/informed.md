I have five messy CSV files with event data in /data/csv/ that need to get into ClickHouse. Some of the files have problems — weird date formats, different null representations, a duplicate header row, and trailing commas.

A Moose project has already been scaffolded at `/workspace/moose-project`, and `moose dev --dockerless` is already running at `http://localhost:4000`. `cd` into the project, define a data model for the events in `app/index.ts` — the dev server hot-reloads on file changes. Then clean and load all the data through Moose.

The target columns are: event_id, event_ts (DateTime), user_id, event_type, and value (Float64, nulls should become 0).

Verify all 15 rows loaded correctly with no duplicates or bad dates.
