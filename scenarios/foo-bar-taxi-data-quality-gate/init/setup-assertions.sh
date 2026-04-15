#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{
  "valid_table_name": "",
  "rejected_table_name": "",
  "valid_count": 0,
  "rejected_count": 0
}
EOF

chmod 644 /workspace/assertions.json
