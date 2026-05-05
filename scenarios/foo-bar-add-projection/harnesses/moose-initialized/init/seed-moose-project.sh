#!/usr/bin/env bash
# Seed a Moose project with the Orders model (no projection yet), start
# `moose dev --dockerless`, wait for the table to be created in ClickHouse,
# bulk-load 3M rows, and plant the slow query the agent will optimize.
#
# Diverges from the shared tools/moose/seed-project.sh because:
#   - We pre-write app/index.ts BEFORE `moose dev` starts so the table is
#     created at startup (no hot-reload window during init).
#   - We need to wait for the table in ClickHouse, then seed data directly,
#     then plant /workspace/queries/top_orders_by_sku.sql.

set -euo pipefail

MOOSE_PROJECT_DIR=/workspace/moose-project

# Extract a key under `[clickhouse_config]` from moose.config.toml. Tolerates
# both quoted and unquoted values. Returns empty if the key is missing.
extract_ch_value() {
  local key="$1"
  awk -v key="$key" '
    /^\[clickhouse_config\]/ { in_section = 1; next }
    /^\[/ { in_section = 0 }
    in_section && $1 == key {
      gsub(/^[^=]*=[[:space:]]*/, "")
      gsub(/^"|"$/, "")
      print
      exit
    }
  ' "${MOOSE_PROJECT_DIR}/moose.config.toml"
}

mkdir -p /workspace
cd /workspace
if [[ ! -d moose-project ]]; then
  moose init moose-project typescript-empty
fi

# Pre-define the Orders model. ORDER BY (customerId, orderTs) makes the
# customer-history access pattern fast (prefix-pruned), but forces a full
# scan for productSku-driven queries — exactly the shape that benefits from
# a projection on (productSku, orderTs). The agent's job is to add that
# projection via the typed OlapTable config.
cat > "${MOOSE_PROJECT_DIR}/app/index.ts" << 'EOF'
import { OlapTable, DateTime } from "@514labs/moose-lib";

/**
 * Wide order-style row used to model an OLTP-style orders table mirrored
 * into ClickHouse. The two text columns (itemDescription, shippingNotes)
 * intentionally widen the row so a full scan reads meaningful bytes per
 * row.
 */
export interface Order {
  orderId: string;
  orderTs: DateTime;
  customerId: string;
  productSku: string;
  region: string;
  amount: number;
  quantity: number;
  itemDescription: string;
  shippingNotes: string;
  statusCode: number;
  isReturned: boolean;
  discountPct: number;
}

/**
 * Primary access pattern is "show me a customer's order history", so the
 * table is sorted by (customerId, orderTs).
 *
 * A secondary access pattern — "for product SKU X, show me the most
 * recent orders" — currently runs a full scan because productSku is not
 * a prefix of ORDER BY. Add a projection here to speed that pattern up
 * without disturbing the primary key.
 */
export const OrdersTable = new OlapTable<Order>("Orders", {
  orderByFields: ["customerId", "orderTs"],
});
EOF

cd "${MOOSE_PROJECT_DIR}"
if [[ ! -d node_modules ]]; then
  npm install
fi

nohup moose dev --dockerless > "${MOOSE_PROJECT_DIR}/moose.log" 2>&1 &
echo "moose dev --dockerless started (pid $!)"

echo "Waiting for moose dev to become ready on :4000..."
for i in $(seq 1 120); do
  if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
    echo "moose dev is ready after ${i}s"
    break
  fi
  sleep 1
done
if ! curl -sf http://localhost:4000/health >/dev/null 2>&1; then
  echo "ERROR: moose dev did not become ready after 120s" >&2
  exit 1
fi

# Read CH connection details from the project config that moose dev is
# actually running against. Defaults match the typescript-empty template's
# moose.config.toml (panda/pandapass on :18123 in db `local`).
CH_USER="$(extract_ch_value user)"
CH_PASS="$(extract_ch_value password)"
CH_HOST="$(extract_ch_value host)"
CH_PORT="$(extract_ch_value host_port)"
CH_DB="$(extract_ch_value db_name)"
: "${CH_USER:=panda}"
: "${CH_PASS:=pandapass}"
: "${CH_HOST:=localhost}"
: "${CH_PORT:=18123}"
: "${CH_DB:=local}"
CH_URL="http://${CH_USER}:${CH_PASS}@${CH_HOST}:${CH_PORT}"
echo "Using CH connection from moose.config.toml: http://${CH_USER}:***@${CH_HOST}:${CH_PORT}/?database=${CH_DB}"

echo "Waiting for Orders table to be created in ClickHouse..."
table_exists_query="SELECT count() FROM system.tables WHERE database = '${CH_DB}' AND name = 'Orders'"
for i in $(seq 1 60); do
  count="$(curl -sS --get --data-urlencode "query=${table_exists_query}" "${CH_URL}/" 2>/dev/null || echo 0)"
  if [[ "${count}" == "1" ]]; then
    echo "Orders table exists after ${i}s"
    break
  fi
  sleep 1
done
count="$(curl -sS --get --data-urlencode "query=${table_exists_query}" "${CH_URL}/" 2>/dev/null || echo 0)"
if [[ "${count}" != "1" ]]; then
  echo "ERROR: Orders table did not appear in ${CH_DB}.Orders after 60s" >&2
  echo "--- moose.log tail ---" >&2
  tail -50 "${MOOSE_PROJECT_DIR}/moose.log" >&2 || true
  exit 1
fi

# Seed 3M rows. Decorrelate productSku from customerId by hashing the row
# index with different salts, so productSku is uniformly distributed across
# all customers. Without this decorrelation, ClickHouse can use the primary
# index to skip granules for productSku queries (ruining the "full scan"
# shape we're testing).
echo "Seeding 3M rows into ${CH_DB}.Orders..."
SEED_SQL=$(cat << SQL
INSERT INTO ${CH_DB}.Orders
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
SQL
)
curl -sS --fail --data-binary "${SEED_SQL}" "${CH_URL}/" > /dev/null

ROW_COUNT="$(curl -sS --get --data-urlencode "query=SELECT count() FROM ${CH_DB}.Orders FORMAT TSV" "${CH_URL}/" || echo 0)"
echo "Orders row count: ${ROW_COUNT}"
if [[ "${ROW_COUNT}" != "3000000" ]]; then
  echo "ERROR: expected 3000000 rows, got ${ROW_COUNT}" >&2
  exit 1
fi

# Plant the slow query. productSku '42' is a real value in the seeded data
# (productSku ranges from '0' to '999'). The query filters on productSku
# (not a prefix of ORDER BY) and sorts by orderTs DESC — forcing a full
# scan today, served from a projection after the agent's edit.
#
# The query references the table by its bare name `Orders`. Connection
# details (port, user, password, database) come from moose.config.toml —
# the agent should source those rather than relying on default ports.
mkdir -p /workspace/queries
cat > /workspace/queries/top_orders_by_sku.sql << EOF
-- Show the most recent 100 orders for a given product SKU.
-- This is the secondary access pattern that is currently slow.
-- ClickHouse connection details live in /workspace/moose-project/moose.config.toml
-- under the \`[clickhouse_config]\` section.
SELECT productSku, orderTs, orderId, amount, itemDescription
FROM Orders
WHERE productSku = '42'
ORDER BY orderTs DESC
LIMIT 100
FORMAT JSONEachRow;
EOF

echo "Seed complete. moose dev is running, Orders has 3M rows, slow query planted."
