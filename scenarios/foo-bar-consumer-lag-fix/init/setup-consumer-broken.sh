#!/bin/bash
mkdir -p /workspace

cat > /workspace/consumer.py << 'PYEOF'
# Broken: single thread, batch size 10 - causes lag
# max_poll_records=10
# Single KafkaConsumer - no parallelism
PYEOF

echo "Broken consumer config created."