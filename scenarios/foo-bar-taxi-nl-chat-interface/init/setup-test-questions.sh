#!/bin/bash
set -euo pipefail

mkdir -p /data/taxi

cat > /data/taxi/test_questions.json << 'EOF'
[
  {"question": "How many trips were there?", "expected_approximate": 3000000, "tolerance_pct": 5},
  {"question": "What was the total revenue?", "expected_approximate": 55000000, "tolerance_pct": 5},
  {"question": "What was the average fare?", "expected_approximate": 18, "tolerance_pct": 10},
  {"question": "How many green taxi trips?", "expected_approximate": 80000, "tolerance_pct": 5}
]
EOF

chmod 644 /data/taxi/test_questions.json
