A query in `/workspace/query.sql` runs against a ClickHouse table called `analytics.events`. It's much too slow. The numbers it returns are correct — we just need it to be fast.

Make the query run in under 100ms (median of a few runs, with caches cleared between runs). Do not drop or modify the underlying data — the same rows must still be there afterwards, and the query result must still match what it returned before. Read `/workspace/README.md` for the full constraints.
