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
    admin.create_topics([NewTopic(name='order_events', num_partitions=1, replication_factor=1)])
except Exception as e:
    if 'TopicExistsError' not in str(type(e).__name__):
        print('Topic:', e)
admin.close()

producer = KafkaProducer(bootstrap_servers=[broker], value_serializer=lambda v: json.dumps(v).encode())
events = [
    {'order_id': 'ord_001', 'event_type': 'created', 'amount': 29.99, 'ts': '2026-01-15T09:00:00Z'},
    {'order_id': 'ord_002', 'event_type': 'created', 'amount': 59.50, 'ts': '2026-01-15T09:01:00Z'},
    {'order_id': 'ord_003', 'event_type': 'created', 'amount': 14.25, 'ts': '2026-01-15T09:02:00Z'},
    {'order_id': 'ord_001', 'event_type': 'updated', 'amount': 20.00, 'ts': '2026-01-15T09:03:00Z'},
    {'order_id': 'ord_002', 'event_type': 'cancelled', 'amount': 0, 'ts': '2026-01-15T09:05:00Z'},
    {'order_id': 'ord_004', 'event_type': 'created', 'amount': 99.00, 'ts': '2026-01-15T09:06:00Z'},
]
for e in events:
    producer.send('order_events', e)
producer.flush()
producer.close()
print('Seeded', len(events), 'events')
"
