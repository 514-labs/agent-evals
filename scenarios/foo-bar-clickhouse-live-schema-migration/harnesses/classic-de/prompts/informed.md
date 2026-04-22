Perform a live schema migration on `analytics.events`.

Add a `region` column (String, default 'unknown'). Use ALTER TABLE ADD COLUMN. Backfill existing rows: set region based on user_id prefix (e.g. user_id starting with 'u1' -> 'us-east', 'u2' -> 'eu-west', else 'unknown'). Ensure SELECT * and existing queries still work. No table rebuild—use ALTER only.
