#!/usr/bin/env bash
set -euo pipefail

PREFIX_ROOT="/data/s3/foo-bar-prod-exports/initial-load/orders/2026-01"
mkdir -p "${PREFIX_ROOT}/archive/replayed"

cat > "${PREFIX_ROOT}/manifest.csv" << 'EOF'
object_key,format,should_load,row_count
initial-load/orders/2026-01/orders_2026_01.csv,csv,true,4
initial-load/orders/2026-01/orders_2026_02.csv,csv,true,4
initial-load/orders/2026-01/orders_2026_03.jsonl,jsonl,true,4
initial-load/orders/2026-01/archive/replayed/orders_2026_02_copy.csv,csv,false,4
EOF

cat > "${PREFIX_ROOT}/orders_2026_01.csv" << 'EOF'
order_id,order_ts,customer_id,amount_cents,status,channel,country,promo_code
ord_1001,2026-01-02T09:00:00Z,cus_001,1299,paid,web,US,
ord_1002,2026-01-02T09:05:00Z,cus_002,2599,paid,mobile,CA,WINTER10
ord_1003,2026-01-02T09:10:00Z,cus_003,749,refunded,web,US,
ord_1004,2026-01-02T09:15:00Z,cus_004,1840,paid,api,GB,
EOF

cat > "${PREFIX_ROOT}/orders_2026_02.csv" << 'EOF'
order_id,order_ts,customer_id,amount_cents,status,channel,country,promo_code
ord_1005,2026-01-03T10:00:00Z,cus_005,4200,paid,web,US,
ord_1006,2026-01-03T10:10:00Z,cus_006,3199,paid,mobile,US,FREESHIP
ord_1007,2026-01-03T10:20:00Z,cus_007,999,failed,web,DE,
ord_1008,2026-01-03T10:30:00Z,cus_008,8800,paid,api,FR,ENTERPRISE
EOF

cat > "${PREFIX_ROOT}/orders_2026_03.jsonl" << 'EOF'
{"order_id":"ord_1009","order_ts":"2026-01-04T11:00:00Z","customer_id":"cus_009","amount_cents":1599,"status":"paid","channel":"web","country":"US","promo_code":"WINTER10"}
{"order_id":"ord_1010","order_ts":"2026-01-04T11:15:00Z","customer_id":"cus_010","amount_cents":6400,"status":"paid","channel":"mobile","country":"CA","promo_code":null}
{"order_id":"ord_1011","order_ts":"2026-01-04T11:30:00Z","customer_id":"cus_011","amount_cents":500,"status":"paid","channel":"web","country":"US","promo_code":null}
{"order_id":"ord_1012","order_ts":"2026-01-04T11:45:00Z","customer_id":"cus_012","amount_cents":3100,"status":"paid","channel":"api","country":"GB","promo_code":null}
EOF

cp "${PREFIX_ROOT}/orders_2026_02.csv" "${PREFIX_ROOT}/archive/replayed/orders_2026_02_copy.csv"
chmod -R a+rX /data/s3
