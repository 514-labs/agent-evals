Debug and fix the full pipeline: Postgres (app.events) -> CDC -> Redpanda (topic) -> Consumer -> ClickHouse (analytics.events).

**Known issues** (find and fix):
1. CDC connector may point to wrong table or topic.
2. Redpanda topic name may not match consumer expectation.
3. ClickHouse table analytics.events may not exist or have wrong schema.
4. Connection strings may be misconfigured.

**Success criteria**: All rows from app.events appear in analytics.events in ClickHouse.