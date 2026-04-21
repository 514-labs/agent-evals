I want to set up a Moose project to model user activity events and get them into ClickHouse. There's sample data in `/data/samples/user_activity_sample.csv` showing the shape of the events.

Start by creating a new Moose project with `moose init --template typescript-empty`, then define a data model that captures the fields from the CSV. Run `moose dev --dockerless` in the project to start the stack, load the sample data through Moose, and make sure the resulting ClickHouse table is optimized for two query patterns:

1. Activity counts per user over a date range
2. Total duration per action type

Nullable duration values should default to 0.

Verify everything works by running both queries against ClickHouse after the data is loaded.
