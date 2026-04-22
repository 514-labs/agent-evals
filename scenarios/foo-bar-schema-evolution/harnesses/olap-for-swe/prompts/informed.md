Evolve the products schema by adding a `weight_kg` (nullable decimal) column to both `app.products` in Postgres and `analytics.products` in ClickHouse.

Requirements:
1. Add `weight_kg` to the Postgres table with a default of NULL for existing rows.
2. Add the matching column to the ClickHouse table.
3. Create a view (or equivalent) that joins/combines the data so consumers can query products with the new column.
4. Verify that existing queries (e.g., `SELECT id, name, price, category FROM ...`) still return the same results as before the migration.
