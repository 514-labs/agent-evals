#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{"migrated_table_name": "", "new_columns": [], "total_rows_after_migration": 0}
EOF

chmod 644 /workspace/assertions.json
