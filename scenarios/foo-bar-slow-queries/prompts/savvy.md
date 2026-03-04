Optimize five analytical queries in /workspace/queries/ against `analytics.events_log` (10M rows, MergeTree).

Current table: ORDER BY tuple() (no useful ordering). The queries filter on event_type, user_id, and date ranges.

Approach:
1. Examine each query's access pattern
2. Create indexes, materialized columns, or restructure the table
3. Rewrite queries to leverage the new structure
4. Result sets must remain identical to the originals

Target: all queries under 200ms.
