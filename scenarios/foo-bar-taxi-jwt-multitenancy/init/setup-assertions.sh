#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{
  "api_base_url": "http://localhost:3000",
  "trips_endpoint": "",
  "jwt_header_name": "Authorization",
  "tenant_claim_field": "tenant"
}
EOF

chmod 644 /workspace/assertions.json
