#!/bin/bash
set -euo pipefail

echo "Downloading yellow taxi parquet..."
curl -fSL -o /tmp/yellow.parquet "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet"

echo "Downloading green taxi parquet..."
curl -fSL -o /tmp/green.parquet "https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-01.parquet"

echo "Creating raw database and loading data..."
clickhouse-client --query "CREATE DATABASE IF NOT EXISTS raw"
clickhouse-client --query "CREATE TABLE IF NOT EXISTS raw.yellow_trips_2024_01 ENGINE = MergeTree() ORDER BY tuple() AS SELECT * FROM file('/tmp/yellow.parquet', Parquet)"
clickhouse-client --query "CREATE TABLE IF NOT EXISTS raw.green_trips_2024_01 ENGINE = MergeTree() ORDER BY tuple() AS SELECT * FROM file('/tmp/green.parquet', Parquet)"

echo "Raw data seeded successfully."
clickhouse-client --query "SELECT 'yellow' AS source, count() AS rows FROM raw.yellow_trips_2024_01 UNION ALL SELECT 'green', count() FROM raw.green_trips_2024_01"
