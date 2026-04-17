#!/bin/bash
mkdir -p /data/samples

cat > /data/samples/user_activity_sample.csv << 'EOF'
event_id,event_ts,user_id,action,duration_ms
evt_001,2026-01-15T08:00:00Z,usr_01,click,120
evt_002,2026-01-15T08:05:00Z,usr_01,scroll,340
evt_003,2026-01-15T09:00:00Z,usr_02,click,90
evt_004,2026-01-15T09:30:00Z,usr_02,view,
evt_005,2026-01-15T10:00:00Z,usr_03,click,200
evt_006,2026-01-16T08:00:00Z,usr_01,view,150
evt_007,2026-01-16T08:30:00Z,usr_03,scroll,280
evt_008,2026-01-16T09:00:00Z,usr_02,click,110
evt_009,2026-01-16T10:00:00Z,usr_01,click,95
evt_010,2026-01-16T11:00:00Z,usr_03,view,0
EOF

chmod 644 /data/samples/user_activity_sample.csv
