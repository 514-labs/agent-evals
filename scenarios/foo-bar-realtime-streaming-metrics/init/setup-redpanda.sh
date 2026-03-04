#!/bin/bash
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
from kafka import KafkaAdminClient, KafkaProducer
from kafka.admin import NewTopic
import json
import os

broker = os.environ.get('REDPANDA_BROKER', 'localhost:9092')

admin = KafkaAdminClient(bootstrap_servers=[broker])
try:
    admin.create_topics([NewTopic(name='metrics', num_partitions=2, replication_factor=1)])
except Exception as e:
    if 'TopicExistsError' not in str(type(e).__name__):
        print('Topic:', e)
admin.close()

producer = KafkaProducer(bootstrap_servers=[broker], value_serializer=lambda v: json.dumps(v).encode())
metrics = [
    ('host_a', 'cpu', 45.0, '2026-01-15T10:00:00Z'),
    ('host_a', 'cpu', 52.0, '2026-01-15T10:01:00Z'),
    ('host_a', 'memory', 68.0, '2026-01-15T10:00:00Z'),
    ('host_b', 'cpu', 78.0, '2026-01-15T10:00:00Z'),
    ('host_b', 'memory', 55.0, '2026-01-15T10:00:00Z'),
    ('host_b', 'cpu', 81.0, '2026-01-15T10:01:00Z'),
    ('host_c', 'cpu', 23.0, '2026-01-15T10:00:00Z'),
    ('host_c', 'memory', 72.0, '2026-01-15T10:00:00Z'),
    ('host_a', 'memory', 70.0, '2026-01-15T10:01:00Z'),
    ('host_c', 'cpu', 25.0, '2026-01-15T10:01:00Z'),
]
for host_id, metric_name, value, ts in metrics:
    producer.send('metrics', {'host_id': host_id, 'metric_name': metric_name, 'value': value, 'ts': ts})
producer.flush()
producer.close()
print('Seeded', len(metrics), 'metrics')
"
