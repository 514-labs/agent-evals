#!/bin/bash
mkdir -p /data/samples

cat > /data/samples/user_activity_sample.csv << 'EOF'
event_id,event_ts,user_id,action,duration_ms
evt_001,2026-01-15T09:00:00Z,usr_01,page_view,1200.5
evt_002,2026-01-15T09:01:30Z,usr_01,button_click,0.0
evt_003,2026-01-15T09:05:00Z,usr_02,page_view,3400.2
evt_004,2026-01-15T10:00:00Z,usr_03,form_submit,850.0
evt_005,2026-01-16T08:30:00Z,usr_01,page_view,2100.0
evt_006,2026-01-16T08:35:00Z,usr_04,button_click,0.0
evt_007,2026-01-16T09:00:00Z,usr_02,page_view,4500.8
evt_008,2026-01-16T11:00:00Z,usr_05,form_submit,920.3
evt_009,2026-01-17T07:45:00Z,usr_01,page_view,1800.0
evt_010,2026-01-17T08:00:00Z,usr_03,button_click,0.0
EOF

chmod 644 /data/samples/user_activity_sample.csv
