#!/bin/bash
mkdir -p /workspace

cat > /workspace/topic-config.md << 'EOF'
# Current (broken) topic config
- Topic: orders
- Partitions: 1  (bottleneck - consumers cannot parallelize)
- Replication: 1
EOF

echo "Broken topic config documented."