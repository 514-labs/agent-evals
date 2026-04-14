#!/bin/bash
mkdir -p /data/csv

cat > /data/csv/events_01.csv << 'EOF'
event_id,event_ts,user_id,event_type,value
evt_001,2026-01-15T10:00:00Z,usr_01,click,1.5
evt_002,2026-01-15T10:05:00Z,usr_02,purchase,42.0
evt_003,2026-01-15T10:10:00Z,usr_03,click,0.8
EOF

cat > /data/csv/events_02.csv << 'EOF'
event_id,event_ts,user_id,event_type,value
evt_004,15/01/2026,usr_01,view,0.0
evt_005,16/01/2026,usr_02,click,3.2
evt_006,17/01/2026,usr_04,purchase,99.9
EOF

cat > /data/csv/events_03.csv << 'EOF'
event_id,event_ts,user_id,event_type,value
evt_007,2026-01-18T08:00:00Z,usr_05,click,N/A
evt_008,2026-01-18T09:00:00Z,usr_06,purchase,null
evt_009,2026-01-18T10:00:00Z,usr_07,view,
EOF

cat > /data/csv/events_04.csv << 'EOF'
event_id,event_ts,user_id,event_type,value
evt_010,2026-01-19T11:00:00Z,usr_01,click,2.1
event_id,event_ts,user_id,event_type,value
evt_011,2026-01-19T12:00:00Z,usr_08,purchase,55.0
evt_012,2026-01-19T13:00:00Z,usr_09,view,0.5
EOF

cat > /data/csv/events_05.csv << 'EOF'
event_id,event_ts,user_id,event_type,value,
evt_013,2026-01-20T14:00:00Z,usr_10,click,7.7,
evt_014,2026-01-20T15:00:00Z,usr_11,purchase,120.0,
evt_015,2026-01-20T16:00:00Z,usr_12,view,0.3,
EOF

chmod 644 /data/csv/*.csv
