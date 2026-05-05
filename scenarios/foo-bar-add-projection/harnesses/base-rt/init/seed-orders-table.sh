#!/usr/bin/env bash
# Per-harness init for base-rt: start system ClickHouse, create the Orders
# table with the same shape as the moose-initialized harness, seed 3M rows
# with a decorrelated productSku distribution, and plant the slow query.
#
# Why CH starts here instead of in /scenario/supervisord.conf: this scenario
# also runs on the moose-initialized harness, where `moose dev --dockerless`
# brings up its own ClickHouse on :18123. Keeping the scenario-level
# supervisord.conf empty lets each harness own its CH lifecycle. Same
# pattern as scenarios/foo-bar-clickhouse-destructive-migration/harnesses/base-rt.
#
# Unlike destructive-migration, we do NOT tear ClickHouse down after seeding
# — the agent's job is to add a projection and materialize it, which
# requires CH stay running through the agent phase.
set -euo pipefail

CH_HOST="localhost"
CH_HTTP_PORT="8123"
CH_TCP_PORT="9000"
CH_DB="local"
CH_TABLE="Orders"
CH_URL="http://${CH_HOST}:${CH_HTTP_PORT}"

# Ownership on data + log dirs; harmless if already correct.
chown -R clickhouse:clickhouse /var/lib/clickhouse 2>/dev/null || true
mkdir -p /var/log/clickhouse-server
chown -R clickhouse:clickhouse /var/log/clickhouse-server 2>/dev/null || true

su -s /bin/bash clickhouse -c '/usr/bin/clickhouse-server --config-file=/etc/clickhouse-server/config.xml --daemon'

echo "Waiting for ClickHouse to become ready on :${CH_HTTP_PORT}..."
READY=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "${CH_URL}/?query=SELECT%201" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "${READY}" != "1" ]]; then
  echo "ERROR: ClickHouse never became ready on ${CH_HTTP_PORT}" >&2
  tail -80 /var/log/clickhouse-server/clickhouse-server.log 2>/dev/null || true
  exit 1
fi

# Schema mirrors what the moose-initialized harness creates via OlapTable<Order>:
# 12 columns, ORDER BY (customerId, orderTs). The two text columns
# (itemDescription, shippingNotes) widen the row so a full scan reads
# meaningful bytes, making the projection-vs-scan delta measurable.
clickhouse-client --host "${CH_HOST}" --port "${CH_TCP_PORT}" --multiquery <<EOF
CREATE DATABASE IF NOT EXISTS ${CH_DB};

CREATE TABLE ${CH_DB}.${CH_TABLE} (
  orderId String,
  orderTs DateTime,
  customerId String,
  productSku String,
  region String,
  amount Float64,
  quantity UInt32,
  itemDescription String,
  shippingNotes String,
  statusCode UInt8,
  isReturned Boolean,
  discountPct Float32
) ENGINE = MergeTree()
ORDER BY (customerId, orderTs);
EOF

# Seed 3M rows. productSku is decorrelated from customerId via independent
# cityHash64 salts so the productSku predicate cannot be served from the
# (customerId, orderTs) primary index — that's what makes the planted query
# a full scan today and a projection-served scan after the agent's edit.
echo "Seeding 3M rows into ${CH_DB}.${CH_TABLE}..."
clickhouse-client --host "${CH_HOST}" --port "${CH_TCP_PORT}" --query "
INSERT INTO ${CH_DB}.${CH_TABLE}
SELECT
  toString(number) AS orderId,
  toDateTime('2025-01-01 00:00:00') + INTERVAL number SECOND AS orderTs,
  toString(cityHash64(number, 'cust') % 5000) AS customerId,
  toString(cityHash64(number, 'sku') % 1000) AS productSku,
  ['us-east','us-west','eu-central','ap-south'][1 + (cityHash64(number, 'reg') % 4)] AS region,
  toFloat64(cityHash64(number, 'amt') % 100000) / 100 AS amount,
  toUInt32(1 + (cityHash64(number, 'qty') % 50)) AS quantity,
  randomPrintableASCII(80) AS itemDescription,
  randomPrintableASCII(40) AS shippingNotes,
  toUInt8(cityHash64(number, 'sts') % 5) AS statusCode,
  (cityHash64(number, 'ret') % 10) = 0 AS isReturned,
  toFloat32(cityHash64(number, 'dis') % 30) AS discountPct
FROM numbers(3000000)
"

ROW_COUNT="$(curl -sS --get --data-urlencode "query=SELECT count() FROM ${CH_DB}.${CH_TABLE} FORMAT TSV" "${CH_URL}/" || echo 0)"
echo "${CH_DB}.${CH_TABLE} row count: ${ROW_COUNT}"
if [[ "${ROW_COUNT}" != "3000000" ]]; then
  echo "ERROR: expected 3000000 rows, got ${ROW_COUNT}" >&2
  exit 1
fi

# Plant the slow query. productSku '42' is a real value in the seeded data
# (productSku ranges from '0' to '999'). The query filters on productSku
# (not a prefix of ORDER BY) and sorts by orderTs DESC — forcing a full
# scan today, served from a projection after the agent's edit.
mkdir -p /workspace/queries
cat > /workspace/queries/top_orders_by_sku.sql << EOF
-- Show the most recent 100 orders for a given product SKU.
-- This is the secondary access pattern that is currently slow.
SELECT productSku, orderTs, orderId, amount, itemDescription
FROM ${CH_TABLE}
WHERE productSku = '42'
ORDER BY orderTs DESC
LIMIT 100
FORMAT JSONEachRow;
EOF

echo "Seed complete. ClickHouse running on :${CH_HTTP_PORT}, ${CH_DB}.${CH_TABLE} has 3M rows, slow query planted."
