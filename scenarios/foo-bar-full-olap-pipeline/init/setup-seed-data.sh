#!/bin/bash
mkdir -p /data/events

# 40 product interaction events as JSON files, one per file.
# Mix of views/carts/purchases across 3 products and 10 users, spanning 6 hours.

cat > /data/events/evt_001.json <<'EOF'
{"event_id":"evt_001","event_ts":"2026-01-15T09:00:00Z","user_id":"usr_01","product_id":"prod_a","event_type":"view","properties":{"page":"home"}}
EOF
cat > /data/events/evt_002.json <<'EOF'
{"event_id":"evt_002","event_ts":"2026-01-15T09:01:00Z","user_id":"usr_02","product_id":"prod_b","event_type":"view","properties":{"page":"search"}}
EOF
cat > /data/events/evt_003.json <<'EOF'
{"event_id":"evt_003","event_ts":"2026-01-15T09:02:00Z","user_id":"usr_01","product_id":"prod_a","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_004.json <<'EOF'
{"event_id":"evt_004","event_ts":"2026-01-15T09:05:00Z","user_id":"usr_03","product_id":"prod_c","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_005.json <<'EOF'
{"event_id":"evt_005","event_ts":"2026-01-15T09:10:00Z","user_id":"usr_01","product_id":"prod_a","event_type":"purchase","properties":{"price":29.99}}
EOF
cat > /data/events/evt_006.json <<'EOF'
{"event_id":"evt_006","event_ts":"2026-01-15T09:15:00Z","user_id":"usr_04","product_id":"prod_b","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_007.json <<'EOF'
{"event_id":"evt_007","event_ts":"2026-01-15T09:20:00Z","user_id":"usr_02","product_id":"prod_b","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_008.json <<'EOF'
{"event_id":"evt_008","event_ts":"2026-01-15T09:25:00Z","user_id":"usr_05","product_id":"prod_a","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_009.json <<'EOF'
{"event_id":"evt_009","event_ts":"2026-01-15T09:30:00Z","user_id":"usr_02","product_id":"prod_b","event_type":"purchase","properties":{"price":49.00}}
EOF
cat > /data/events/evt_010.json <<'EOF'
{"event_id":"evt_010","event_ts":"2026-01-15T09:45:00Z","user_id":"usr_06","product_id":"prod_c","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_011.json <<'EOF'
{"event_id":"evt_011","event_ts":"2026-01-15T10:00:00Z","user_id":"usr_07","product_id":"prod_a","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_012.json <<'EOF'
{"event_id":"evt_012","event_ts":"2026-01-15T10:05:00Z","user_id":"usr_03","product_id":"prod_c","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_013.json <<'EOF'
{"event_id":"evt_013","event_ts":"2026-01-15T10:10:00Z","user_id":"usr_08","product_id":"prod_b","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_014.json <<'EOF'
{"event_id":"evt_014","event_ts":"2026-01-15T10:20:00Z","user_id":"usr_03","product_id":"prod_c","event_type":"purchase","properties":{"price":15.50}}
EOF
cat > /data/events/evt_015.json <<'EOF'
{"event_id":"evt_015","event_ts":"2026-01-15T10:30:00Z","user_id":"usr_09","product_id":"prod_a","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_016.json <<'EOF'
{"event_id":"evt_016","event_ts":"2026-01-15T10:45:00Z","user_id":"usr_10","product_id":"prod_b","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_017.json <<'EOF'
{"event_id":"evt_017","event_ts":"2026-01-15T11:00:00Z","user_id":"usr_04","product_id":"prod_b","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_018.json <<'EOF'
{"event_id":"evt_018","event_ts":"2026-01-15T11:05:00Z","user_id":"usr_05","product_id":"prod_a","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_019.json <<'EOF'
{"event_id":"evt_019","event_ts":"2026-01-15T11:15:00Z","user_id":"usr_04","product_id":"prod_b","event_type":"purchase","properties":{"price":49.00}}
EOF
cat > /data/events/evt_020.json <<'EOF'
{"event_id":"evt_020","event_ts":"2026-01-15T11:30:00Z","user_id":"usr_06","product_id":"prod_c","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_021.json <<'EOF'
{"event_id":"evt_021","event_ts":"2026-01-15T11:45:00Z","user_id":"usr_05","product_id":"prod_a","event_type":"purchase","properties":{"price":29.99}}
EOF
cat > /data/events/evt_022.json <<'EOF'
{"event_id":"evt_022","event_ts":"2026-01-15T12:00:00Z","user_id":"usr_06","product_id":"prod_c","event_type":"purchase","properties":{"price":15.50}}
EOF
cat > /data/events/evt_023.json <<'EOF'
{"event_id":"evt_023","event_ts":"2026-01-15T12:10:00Z","user_id":"usr_07","product_id":"prod_a","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_024.json <<'EOF'
{"event_id":"evt_024","event_ts":"2026-01-15T12:20:00Z","user_id":"usr_08","product_id":"prod_b","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_025.json <<'EOF'
{"event_id":"evt_025","event_ts":"2026-01-15T12:30:00Z","user_id":"usr_07","product_id":"prod_a","event_type":"purchase","properties":{"price":29.99}}
EOF
cat > /data/events/evt_026.json <<'EOF'
{"event_id":"evt_026","event_ts":"2026-01-15T12:40:00Z","user_id":"usr_09","product_id":"prod_a","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_027.json <<'EOF'
{"event_id":"evt_027","event_ts":"2026-01-15T12:50:00Z","user_id":"usr_01","product_id":"prod_b","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_028.json <<'EOF'
{"event_id":"evt_028","event_ts":"2026-01-15T13:00:00Z","user_id":"usr_09","product_id":"prod_a","event_type":"purchase","properties":{"price":29.99}}
EOF
cat > /data/events/evt_029.json <<'EOF'
{"event_id":"evt_029","event_ts":"2026-01-15T13:10:00Z","user_id":"usr_10","product_id":"prod_b","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_030.json <<'EOF'
{"event_id":"evt_030","event_ts":"2026-01-15T13:20:00Z","user_id":"usr_02","product_id":"prod_c","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_031.json <<'EOF'
{"event_id":"evt_031","event_ts":"2026-01-15T13:30:00Z","user_id":"usr_10","product_id":"prod_b","event_type":"purchase","properties":{"price":49.00}}
EOF
cat > /data/events/evt_032.json <<'EOF'
{"event_id":"evt_032","event_ts":"2026-01-15T13:45:00Z","user_id":"usr_08","product_id":"prod_b","event_type":"purchase","properties":{"price":49.00}}
EOF
cat > /data/events/evt_033.json <<'EOF'
{"event_id":"evt_033","event_ts":"2026-01-15T14:00:00Z","user_id":"usr_03","product_id":"prod_c","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_034.json <<'EOF'
{"event_id":"evt_034","event_ts":"2026-01-15T14:15:00Z","user_id":"usr_04","product_id":"prod_a","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_035.json <<'EOF'
{"event_id":"evt_035","event_ts":"2026-01-15T14:30:00Z","user_id":"usr_01","product_id":"prod_c","event_type":"cart","properties":{}}
EOF
cat > /data/events/evt_036.json <<'EOF'
{"event_id":"evt_036","event_ts":"2026-01-15T14:45:00Z","user_id":"usr_02","product_id":"prod_a","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_037.json <<'EOF'
{"event_id":"evt_037","event_ts":"2026-01-15T15:00:00Z","user_id":"usr_01","product_id":"prod_c","event_type":"purchase","properties":{"price":15.50}}
EOF
cat > /data/events/evt_038.json <<'EOF'
{"event_id":"evt_038","event_ts":"2026-01-15T15:15:00Z","user_id":"usr_05","product_id":"prod_b","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_039.json <<'EOF'
{"event_id":"evt_039","event_ts":"2026-01-15T15:30:00Z","user_id":"usr_06","product_id":"prod_a","event_type":"view","properties":{}}
EOF
cat > /data/events/evt_040.json <<'EOF'
{"event_id":"evt_040","event_ts":"2026-01-15T15:45:00Z","user_id":"usr_07","product_id":"prod_b","event_type":"view","properties":{}}
EOF

chmod 644 /data/events/*.json
