I have five messy CSV files with event data in /data/csv/ that need to get into ClickHouse. Some of the files have problems — weird date formats, different null representations, a duplicate header row, and trailing commas.

Set up a Moose project with `moose init --template typescript-empty`, define a data model for the events, and run `moose dev --dockerless` to start the stack. Then clean and load all the data through Moose.

The target columns are: event_id, event_ts (DateTime), user_id, event_type, and value (Float64, nulls should become 0).

Verify all 15 rows loaded correctly with no duplicates or bad dates.
