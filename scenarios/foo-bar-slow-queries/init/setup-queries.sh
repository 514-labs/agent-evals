#!/bin/bash
mkdir -p /workspace/queries

cat > /workspace/queries/q1.sql << 'EOF'
SELECT toDate(event_ts) AS day, count() AS events FROM analytics.events_log WHERE event_type = 'purchase' GROUP BY day ORDER BY day
EOF

cat > /workspace/queries/q2.sql << 'EOF'
SELECT user_id, count() AS n FROM analytics.events_log WHERE event_type = 'click' AND event_ts >= '2026-02-01' AND event_ts < '2026-03-01' GROUP BY user_id ORDER BY n DESC LIMIT 20
EOF

cat > /workspace/queries/q3.sql << 'EOF'
SELECT page_url, avg(duration_ms) AS avg_dur FROM analytics.events_log WHERE event_type = 'pageview' GROUP BY page_url ORDER BY avg_dur DESC LIMIT 10
EOF

cat > /workspace/queries/q4.sql << 'EOF'
SELECT event_type, uniq(user_id) AS unique_users FROM analytics.events_log WHERE event_ts >= '2026-03-01' AND event_ts < '2026-04-01' GROUP BY event_type
EOF

cat > /workspace/queries/q5.sql << 'EOF'
SELECT toStartOfHour(event_ts) AS hour, count() AS cnt FROM analytics.events_log WHERE user_id = 'usr_0042' GROUP BY hour ORDER BY hour
EOF
