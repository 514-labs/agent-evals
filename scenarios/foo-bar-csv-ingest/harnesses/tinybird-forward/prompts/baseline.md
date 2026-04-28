I have five CSV files of event data in `/data/csv/` that need to get into a queryable analytics table. The files are messy — different date formats, different ways of representing nulls, a duplicate header row in one, trailing delimiters in another. Clean them up and load everything into a single events table.

Target columns: event_id, event_ts (DateTime), user_id, event_type, and value (Float64, nulls should become 0). There should be 15 rows total with no duplicates or bad dates.
