I want to set up a Moose project to model user activity events and get them into ClickHouse. There's sample data in `/data/samples/user_activity_sample.csv` showing the shape of the events.

A Moose project has already been scaffolded at `/workspace/moose-project`, and `moose dev --dockerless` is already running at `http://localhost:4000`. `cd` into the project, define a data model in `app/index.ts` that captures the fields from the CSV — the dev server hot-reloads on file changes. Load the sample data through Moose, and make sure the resulting ClickHouse table is optimized for two query patterns:

1. Activity counts per user over a date range
2. Total duration per action type

Nullable duration values should default to 0.

Verify everything works by running both queries against ClickHouse after the data is loaded.
