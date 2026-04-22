Our orders topic in Redpanda has events with order_id, customer_id, and amount. We need to add a region field for analytics. The consumer is failing when we try to produce messages with the new field.

Can you fix the schema so we can add region without breaking existing consumers?
