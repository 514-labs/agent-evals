I have user activity events in /data/samples/user_activity_sample.csv that I want to analyze through Moose.

Set up a Moose project with `moose init --template typescript-empty`, define a data model for the activity events, and run `moose dev --dockerless` to start the stack. Load the sample data through Moose.

Then create two materialized views in ClickHouse for dashboard access patterns:

1. A daily summary per user — event count and total duration for each day
2. A top-users leaderboard — all-time total duration and event count ranked by user

Both views should auto-update when new data arrives. Nullable duration values should default to 0.

Verify by querying both views after the data is loaded.
