#!/bin/bash
mkdir -p /workspace

cat > /workspace/consumer.py << 'PYEOF'
import json
import os
# Broken: no DLQ - failed messages are dropped
# from kafka import KafkaConsumer
# consumer = KafkaConsumer('events', bootstrap_servers=os.environ.get('REDPANDA_BROKER', 'localhost:9092'))
# for msg in consumer:
#     try:
#         data = json.loads(msg.value)
#         # insert into clickhouse
#     except json.JSONDecodeError:
#         pass  # DROPS FAILED MESSAGES
PYEOF

echo "Broken consumer created. No DLQ configured."