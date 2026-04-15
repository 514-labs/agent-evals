Fix 4 known bugs in the broken taxi data pipeline at /workspace/.

## Bug 1: Type error in src/schema.ts
- The `pickup_location` and `dropoff_location` fields in the `TripSchema` interface are typed as `number`, but they are used as string column names in the `selectColumns` mapping.
- The code casts column names `as number` instead of keeping them as strings.
- Fix: correct the interface types and remove the invalid casts.

## Bug 2: Wrong table name in src/api.ts
- The API handlers reference `analytics.taxi_data` but the actual table created by the schema is `analytics.taxi_trips`.
- Fix: change all references from `analytics.taxi_data` to `analytics.taxi_trips`.

## Bug 3: Column mismatch in src/mv.ts
- The materialized view SELECT uses `avg(fare)` but the source table has no column named `fare` -- it should be `fare_amount`.
- Fix: change `fare` to `fare_amount` in the MV definition.

## Bug 4: Missing import in src/ingest.ts
- The `createClient` function is used but never imported -- the import statement is commented out.
- Fix: uncomment or add `import { createClient } from "@clickhouse/client";`.

## Expected Outcome
After fixing all 4 bugs:
1. `npm run build` should compile without errors.
2. Running the schema creation, ingestion, and MV creation scripts should populate analytics.taxi_trips with ~3M rows.
3. `npm run start` should serve the API on port 3000 with working /trips and /trips/summary endpoints.
