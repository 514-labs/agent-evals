#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{
  "tables": {
    "trips": "",
    "daily_metrics": ""
  },
  "api_endpoints": {
    "trips": "",
    "metrics": "",
    "summary": ""
  },
  "auth": {
    "jwt_header": "",
    "tenant_claim": ""
  },
  "observability": {
    "langfuse_configured": false
  }
}
EOF

chmod 644 /workspace/assertions.json
echo "assertions.json template created."
