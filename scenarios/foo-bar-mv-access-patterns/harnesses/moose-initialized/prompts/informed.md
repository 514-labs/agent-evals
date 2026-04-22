I have user activity events in /data/samples/user_activity_sample.csv that I want to analyze through Moose.

A Moose project has already been scaffolded at `/workspace/moose-project`, and `moose dev --dockerless` is already running at `http://localhost:4000`. `cd` into the project, define a data model for the activity events in `app/index.ts` — the dev server hot-reloads on file changes. Load the sample data through Moose.

Then create two materialized views in ClickHouse for dashboard access patterns:

1. A daily summary per user — event count and total duration for each day
2. A top-users leaderboard — all-time total duration and event count ranked by user

Both views should auto-update when new data arrives. Nullable duration values should default to 0.

Verify by querying both views after the data is loaded.
