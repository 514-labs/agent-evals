Our analytics.events table needs changes. Product has defined a "session" as all events from the same user on the same calendar day (UTC). We need a session_id column populated for every existing row following that rule, and queries that filter by session should be fast. The table has 10,000 rows today and none of them can go missing.

Leave a short README for the on-call operator (what you did and how to verify), and keep your steps safe to re-run in case we need to replay them.
