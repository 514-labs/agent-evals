Our `events` table in the `analytics` database has started returning duplicate rows whenever the same user performs the same action twice. We need queries to return only the most recent version of each duplicated row, based on the `updated_at` timestamp.

Fix this. Keep all historical data — we may need it for audits later.
