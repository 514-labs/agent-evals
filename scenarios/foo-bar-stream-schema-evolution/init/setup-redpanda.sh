#!/bin/bash
# Create orders topic with initial schema. Agent must evolve schema to add region field.
BROKER="${REDPANDA_BROKER:-localhost:9092}"

python3 -c "
import os, socket, time, sys
host, port = os.environ.get('REDPANDA_BROKER', 'localhost:9092').split(':')
port = int(port)
for _ in range(60):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(1.0)
    try:
        sock.connect((host, port))
        sock.close()
        sys.exit(0)
    except Exception:
        time.sleep(1)
print('Timed out waiting for Redpanda broker at %s:%s' % (host, port))
sys.exit(1)
"

python3 -c "
from kafka import KafkaAdminClient
from kafka.admin import NewTopic
import os
broker = os.environ.get('REDPANDA_BROKER', 'localhost:9092')
client = KafkaAdminClient(bootstrap_servers=[broker])
try:
    client.create_topics([NewTopic(name='orders', num_partitions=2, replication_factor=1)])
except Exception as e:
    if 'TopicExistsError' not in str(type(e).__name__):
        print('Topic creation:', e)
finally:
    client.close()
"
