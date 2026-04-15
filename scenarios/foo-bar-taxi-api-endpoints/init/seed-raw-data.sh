#!/bin/bash
set -euo pipefail

curl -fSL -o /tmp/yellow.parquet "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet"
curl -fSL -o /tmp/green.parquet "https://d37ci6vzurychx.cloudfront.net/trip-data/green_tripdata_2024-01.parquet"

clickhouse-client --query "CREATE DATABASE IF NOT EXISTS raw"
clickhouse-client --query "CREATE TABLE IF NOT EXISTS raw.yellow_trips_2024_01 ENGINE = MergeTree() ORDER BY tuple() AS SELECT * FROM file('/tmp/yellow.parquet', Parquet)"
clickhouse-client --query "CREATE TABLE IF NOT EXISTS raw.green_trips_2024_01 ENGINE = MergeTree() ORDER BY tuple() AS SELECT * FROM file('/tmp/green.parquet', Parquet)"

cat > /workspace/assertions.json << 'EOF'
{
  "analytics_table_name": "",
  "api_base_url": "http://localhost:3000",
  "endpoints": [
    {"path": "", "method": "GET", "description": "List trips with pagination"},
    {"path": "", "method": "GET", "description": "Fare summary"},
    {"path": "", "method": "GET", "description": "Top trips by fare"}
  ]
}
EOF

chmod 644 /workspace/assertions.json
