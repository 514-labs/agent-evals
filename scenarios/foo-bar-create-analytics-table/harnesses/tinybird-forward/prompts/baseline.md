I've got user activity events in a CSV at `/data/samples/user_activity_sample.csv`. I need an analytics table to hold them, optimized for two query patterns:

1. Activity counts per user over a date range
2. Total duration per action type

Null duration values should default to zero. Load the sample data so I can verify both queries return results.
