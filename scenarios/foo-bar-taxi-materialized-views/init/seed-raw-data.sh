#!/bin/bash
set -euo pipefail

curl -fSL -o /tmp/yellow.parquet "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet"
curl -fSL -o /tmp/green.parquet "https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-01.parquet"

clickhouse-client --query "CREATE DATABASE IF NOT EXISTS raw"
clickhouse-client --query "CREATE TABLE IF NOT EXISTS raw.yellow_trips_2024_01 ENGINE = MergeTree() ORDER BY tuple() AS SELECT * FROM file('/tmp/yellow.parquet', Parquet)"
clickhouse-client --query "CREATE TABLE IF NOT EXISTS raw.green_trips_2024_01 ENGINE = MergeTree() ORDER BY tuple() AS SELECT * FROM file('/tmp/green.parquet', Parquet)"

# Create the naive analytics table with ORDER BY tuple() — intentionally slow
clickhouse-client --query "CREATE DATABASE IF NOT EXISTS analytics"
clickhouse-client --query "
CREATE TABLE IF NOT EXISTS analytics.taxi_trips
ENGINE = MergeTree()
ORDER BY tuple()
AS
SELECT
  'yellow' AS taxi_type,
  tpep_pickup_datetime AS pickup_datetime,
  tpep_dropoff_datetime AS dropoff_datetime,
  passenger_count,
  trip_distance,
  fare_amount,
  tip_amount,
  total_amount,
  payment_type,
  PULocationID AS pu_location_id,
  DOLocationID AS do_location_id
FROM raw.yellow_trips_2024_01
"

cat > /workspace/assertions.json << 'EOF'
{
  "mv_names": [],
  "target_table_names": []
}
EOF

chmod 644 /workspace/assertions.json
