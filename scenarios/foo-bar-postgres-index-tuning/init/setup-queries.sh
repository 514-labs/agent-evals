#!/bin/bash
mkdir -p /workspace/queries

cat > /workspace/queries/q1.sql << 'EOF'
SELECT * FROM app.orders WHERE user_id = 'user_42' ORDER BY created_at DESC LIMIT 10
EOF

cat > /workspace/queries/q2.sql << 'EOF'
SELECT * FROM app.orders WHERE created_at >= '2025-02-01' AND created_at < '2025-03-01' ORDER BY created_at
EOF
