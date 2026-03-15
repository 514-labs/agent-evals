#!/usr/bin/env bash
set -euo pipefail
apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless && rm -rf /var/lib/apt/lists/* && pip3 install --no-cache-dir --break-system-packages dbt-core==1.10.19 dbt-postgres==1.10.0 dbt-clickhouse==1.10.0 apache-airflow==2.10.5 pyspark==3.5.5
