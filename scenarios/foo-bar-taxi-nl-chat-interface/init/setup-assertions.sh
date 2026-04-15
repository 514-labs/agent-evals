#!/bin/bash
set -euo pipefail

cat > /workspace/assertions.json << 'EOF'
{
  "chat_endpoint": "",
  "supported_question_types": []
}
EOF

chmod 644 /workspace/assertions.json
