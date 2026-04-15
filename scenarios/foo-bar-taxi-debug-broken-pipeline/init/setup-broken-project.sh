#!/bin/bash
set -euo pipefail

mkdir -p /workspace/src

# package.json
cat > /workspace/package.json << 'PKGEOF'
{
  "name": "taxi-pipeline",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/api.js",
    "ingest": "node dist/ingest.js",
    "create-mv": "node dist/mv.js"
  },
  "dependencies": {
    "@clickhouse/client": "^1.0.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0"
  }
}
PKGEOF

# tsconfig.json
cat > /workspace/tsconfig.json << 'TSEOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
TSEOF

# src/schema.ts -- BUG: pickup_location typed as number, but it's used as a string column name
cat > /workspace/src/schema.ts << 'SCHEMAEOF'
import { createClient } from "@clickhouse/client";

interface TripSchema {
  taxi_type: string;
  pickup_datetime: string;
  dropoff_datetime: string;
  passenger_count: number;
  trip_distance: number;
  pickup_location: number;  // BUG: This should be string for the column name mapping
  dropoff_location: number; // BUG: Same issue
  fare_amount: number;
  total_amount: number;
  tip_amount: number;
}

const ANALYTICS_COLUMNS: Record<keyof TripSchema, string> = {
  taxi_type: "LowCardinality(String)",
  pickup_datetime: "DateTime",
  dropoff_datetime: "DateTime",
  passenger_count: "UInt8",
  trip_distance: "Float64",
  pickup_location: "UInt16",
  dropoff_location: "UInt16",
  fare_amount: "Float64",
  total_amount: "Float64",
  tip_amount: "Float64",
};

export async function createAnalyticsTable(): Promise<void> {
  const client = createClient({ url: process.env.CLICKHOUSE_URL || "http://localhost:8123" });

  const columnDefs = Object.entries(ANALYTICS_COLUMNS)
    .map(([name, type]) => `${name} ${type}`)
    .join(", ");

  await client.command({
    query: `CREATE DATABASE IF NOT EXISTS analytics`,
  });

  // BUG: The column definition uses pickup_location as a number type in the interface,
  // but then tries to use it as a key in ANALYTICS_COLUMNS. The real issue is that
  // the code below tries to concat a number with a string when building the SELECT.
  const selectColumns: string = Object.keys(ANALYTICS_COLUMNS)
    .map((col: string) => {
      if (col === "pickup_location") return `PULocationID AS ${col as number}`; // BUG: casting to number instead of string
      if (col === "dropoff_location") return `DOLocationID AS ${col as number}`; // BUG: same
      return col;
    })
    .join(", ");

  await client.command({
    query: `CREATE TABLE IF NOT EXISTS analytics.taxi_trips (${columnDefs}) ENGINE = MergeTree() ORDER BY (taxi_type, pickup_datetime)`,
  });

  await client.close();
}

export { TripSchema, ANALYTICS_COLUMNS };
SCHEMAEOF

# src/api.ts -- BUG: References wrong table name (analytics.taxi_data instead of analytics.taxi_trips)
cat > /workspace/src/api.ts << 'APIEOF'
import express from "express";
import { createClient } from "@clickhouse/client";

const app = express();
const client = createClient({ url: process.env.CLICKHOUSE_URL || "http://localhost:8123" });

app.get("/trips", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    // BUG: Wrong table name -- should be analytics.taxi_trips
    const result = await client.query({
      query: `SELECT * FROM analytics.taxi_data LIMIT ${limit} OFFSET ${offset}`,
      format: "JSONEachRow",
    });
    const rows = await (result as any).json();
    res.json({ data: rows, limit, offset });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/trips/summary", async (req, res) => {
  try {
    // BUG: Wrong table name -- should be analytics.taxi_trips
    const result = await client.query({
      query: `SELECT
        count() AS total_trips,
        sum(total_amount) AS total_revenue,
        avg(fare_amount) AS avg_fare,
        avg(trip_distance) AS avg_distance
      FROM analytics.taxi_data`,
      format: "JSONEachRow",
    });
    const rows = await (result as any).json();
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Taxi API listening on port ${PORT}`);
});

export default app;
APIEOF

# src/mv.ts -- BUG: Column mismatch -- selects 'fare' but target expects 'fare_amount'
cat > /workspace/src/mv.ts << 'MVEOF'
import { createClient } from "@clickhouse/client";

export async function createMaterializedViews(): Promise<void> {
  const client = createClient({ url: process.env.CLICKHOUSE_URL || "http://localhost:8123" });

  // Create target table for daily stats
  await client.command({
    query: `CREATE TABLE IF NOT EXISTS analytics.daily_stats (
      trip_date Date,
      taxi_type LowCardinality(String),
      trip_count UInt64,
      total_revenue Float64,
      avg_fare_amount Float64
    ) ENGINE = SummingMergeTree()
    ORDER BY (trip_date, taxi_type)`,
  });

  // BUG: Selects 'fare' but the column is 'fare_amount' in the source table
  await client.command({
    query: `CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.daily_stats_mv
    TO analytics.daily_stats
    AS SELECT
      toDate(pickup_datetime) AS trip_date,
      taxi_type,
      count() AS trip_count,
      sum(total_amount) AS total_revenue,
      avg(fare) AS avg_fare_amount
    FROM analytics.taxi_trips
    GROUP BY trip_date, taxi_type`,
  });

  await client.close();
  console.log("Materialized views created successfully.");
}

createMaterializedViews().catch(console.error);
MVEOF

# src/ingest.ts -- BUG: Missing import for the clickhouse client
cat > /workspace/src/ingest.ts << 'INGESTEOF'
// BUG: Missing import -- createClient is not imported
// import { createClient } from "@clickhouse/client";

async function ingestData(): Promise<void> {
  const client = createClient({ url: process.env.CLICKHOUSE_URL || "http://localhost:8123" });

  console.log("Ingesting yellow taxi data...");
  await client.command({
    query: `INSERT INTO analytics.taxi_trips
      SELECT
        'yellow' AS taxi_type,
        tpep_pickup_datetime AS pickup_datetime,
        tpep_dropoff_datetime AS dropoff_datetime,
        passenger_count,
        trip_distance,
        PULocationID AS pickup_location,
        DOLocationID AS dropoff_location,
        fare_amount,
        total_amount,
        tip_amount
      FROM raw.yellow_trips_2024_01`,
  });

  console.log("Ingesting green taxi data...");
  await client.command({
    query: `INSERT INTO analytics.taxi_trips
      SELECT
        'green' AS taxi_type,
        lpep_pickup_datetime AS pickup_datetime,
        lpep_dropoff_datetime AS dropoff_datetime,
        passenger_count,
        trip_distance,
        PULocationID AS pickup_location,
        DOLocationID AS dropoff_location,
        fare_amount,
        total_amount,
        tip_amount
      FROM raw.green_trips_2024_01`,
  });

  const result = await client.query({
    query: `SELECT count() AS n FROM analytics.taxi_trips`,
    format: "JSONEachRow",
  });
  const rows = await (result as any).json();
  console.log(`Ingested ${rows[0]?.n} total rows.`);

  await client.close();
}

ingestData().catch(console.error);
INGESTEOF

cd /workspace && npm install 2>/dev/null || true
