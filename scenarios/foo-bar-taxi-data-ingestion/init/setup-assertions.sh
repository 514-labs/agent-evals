#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{"table_name": "", "database_name": "", "total_row_count": 0}
EOF

chmod 644 /workspace/assertions.json
