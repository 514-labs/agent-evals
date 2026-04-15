#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{"analytics_table_name": "", "metric_names": [], "definition_file": "", "api_base_url": "", "endpoints": []}
EOF

chmod 644 /workspace/assertions.json
