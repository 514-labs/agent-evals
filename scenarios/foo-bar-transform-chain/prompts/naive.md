We have a bunch of JSON event data sitting in Postgres. We need to get it into ClickHouse so we can build dashboards on daily session activity.

The events are in the `raw.events` table and each row has a JSONB `payload` column with things like session_id, event_type, user_id, and value.

Can you set this up so we have a nice daily summary we can query?
