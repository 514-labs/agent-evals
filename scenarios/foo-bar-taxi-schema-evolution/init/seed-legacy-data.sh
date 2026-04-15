#!/bin/bash
set -euo pipefail

# Download Jan 2024 yellow parquet
curl -fSL -o /tmp/yellow_jan.parquet "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet"

# Download Feb 2024 yellow parquet and stage it as "new format" data
mkdir -p /data/taxi
curl -fSL -o /data/taxi/yellow_tripdata_2024-02.parquet "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-02.parquet"

clickhouse-client --query "CREATE DATABASE IF NOT EXISTS analytics"

# Create legacy table WITHOUT congestion_surcharge and airport_fee,
# and with payment_type as Int32 (simulating old schema)
clickhouse-client --query "
CREATE TABLE IF NOT EXISTS analytics.taxi_trips_v1
(
    VendorID Int32,
    tpep_pickup_datetime DateTime,
    tpep_dropoff_datetime DateTime,
    passenger_count Float64,
    trip_distance Float64,
    RatecodeID Float64,
    store_and_fwd_flag String,
    PULocationID Int32,
    DOLocationID Int32,
    payment_type Int32,
    fare_amount Float64,
    extra Float64,
    mta_tax Float64,
    tip_amount Float64,
    tolls_amount Float64,
    improvement_surcharge Float64,
    total_amount Float64
)
ENGINE = MergeTree()
ORDER BY (tpep_pickup_datetime, VendorID)
"

# Load Jan data into legacy table, EXCLUDING congestion_surcharge and airport_fee,
# and casting payment_type to Int32
clickhouse-client --query "
INSERT INTO analytics.taxi_trips_v1
SELECT
    VendorID,
    tpep_pickup_datetime,
    tpep_dropoff_datetime,
    passenger_count,
    trip_distance,
    RatecodeID,
    store_and_fwd_flag,
    PULocationID,
    DOLocationID,
    toInt32(payment_type) AS payment_type,
    fare_amount,
    extra,
    mta_tax,
    tip_amount,
    tolls_amount,
    improvement_surcharge,
    total_amount
FROM file('/tmp/yellow_jan.parquet', Parquet)
"

# Record pre-migration fare_amount sum as ground truth for later assertions
clickhouse-client --query "SELECT round(sum(fare_amount), 2) FROM analytics.taxi_trips_v1" > /tmp/jan_fare_sum_ground_truth.txt
