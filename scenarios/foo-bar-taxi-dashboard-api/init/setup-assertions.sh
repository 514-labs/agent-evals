#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{
  "api_base_url": "http://localhost:3000",
  "endpoints": {
    "summary": "",
    "daily_trend": "",
    "taxi_type_breakdown": "",
    "top_routes": ""
  }
}
EOF

chmod 644 /workspace/assertions.json
