Add indexes to optimize the slow queries:

1. Table `app.orders` has columns: order_id, user_id, created_at, amount. ~500k rows, no indexes on user_id or created_at.
2. The queries in /workspace/queries/ filter by user_id and/or created_at. They currently do full table scans.
3. Create indexes so that:
   - `SELECT * FROM app.orders WHERE user_id = $1` uses an index.
   - `SELECT * FROM app.orders WHERE created_at >= $1 AND created_at < $2` uses an index.
4. Target: both query patterns run under 50ms.
