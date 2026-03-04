#!/bin/bash
# Intentionally broken setup: wrong topic name, no ClickHouse table.
# Agent must fix: create events topic (not eventz), create analytics.events in CH.
BROKER="${REDPANDA_BROKER:-localhost:9092}"

python3 -c "
from kafka import KafkaAdminClient
from kafka.admin import NewTopic
import os
broker = os.environ.get('REDPANDA_BROKER', 'localhost:9092')
admin = KafkaAdminClient(bootstrap_servers=[broker])
try:
    admin.create_topics([NewTopic(name='eventz', num_partitions=2, replication_factor=1)])
except Exception as e:
    if 'TopicExistsError' not in str(type(e).__name__):
        print('Topic:', e)
admin.close()
"
