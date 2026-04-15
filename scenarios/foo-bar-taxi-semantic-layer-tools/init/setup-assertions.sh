#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{"analytics_table_name": "", "metric_names": [], "definition_file": "", "tool_names": [], "mcp_server_url": ""}
EOF

chmod 644 /workspace/assertions.json
