#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{
  "tables": {
    "trips": "",
    "metrics": ""
  },
  "api_endpoints": [],
  "chat_endpoint": "",
  "auth_enabled": false,
  "guardrails_enabled": false,
  "observability_enabled": false
}
EOF

chmod 644 /workspace/assertions.json
echo "assertions.json template created."
