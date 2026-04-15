#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{"agent_endpoint": "", "langfuse_project": ""}
EOF

chmod 644 /workspace/assertions.json
