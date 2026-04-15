#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{"query_endpoint": "", "guardrail_id": ""}
EOF

chmod 644 /workspace/assertions.json
