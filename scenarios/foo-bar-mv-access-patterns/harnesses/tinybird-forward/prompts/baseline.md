We've got user activity events landing in a table, and two dashboards we need to feed: one shows per-user activity broken down by day (event counts + total time on page per user per day), and the other is an all-time leaderboard of the most engaged users (event count + total time on page, ranked by total time).

Both views need to stay fresh when new events arrive. Null durations should be treated as zero. Leave a short README for whoever picks this up next describing what you built and how to verify.
