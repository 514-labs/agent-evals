Fix the OLTP-to-OLAP migration pipeline:

**Source**: Postgres `app.sales` (id, product_id, quantity, amount, sale_date).

**Target**: ClickHouse `analytics.sales` with matching schema and appropriate MergeTree ordering (e.g., sale_date, product_id).

**Requirements**:
1. Align schema: id, product_id, quantity, amount, sale_date (DateTime or Date).
2. Sync all 15 rows from app.sales to analytics.sales.
3. Support incremental load (e.g., by sale_date or id) for future runs.
4. Ensure sum(amount) and count match between source and target.