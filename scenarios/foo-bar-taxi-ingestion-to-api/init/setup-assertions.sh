#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{
  "source_table": "",
  "mv_tables": [],
  "api_endpoints": [],
  "total_ingested_rows": 0
}
EOF

chmod 644 /workspace/assertions.json
