Our events table in Postgres is getting slow when we filter by date. It has a lot of rows and no partitioning.

Can you partition it by date so date-range queries are faster?
