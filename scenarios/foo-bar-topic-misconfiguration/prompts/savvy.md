Fix the orders topic misconfiguration:

1. The topic `orders` has 1 partition and replication factor 1, causing consumer lag and no parallelism.
2. Create a migration script or rpk commands to:
   - Increase partitions to at least 6 (for consumer parallelism).
   - Set replication factor to 2 if running a multi-broker cluster (or document for single-node).
3. Document the new config in /workspace/topic-config.md.
4. Ensure the consumer at /workspace/consumer.py can consume from the reconfigured topic (may need to create new topic and migrate, or use partition increase).
