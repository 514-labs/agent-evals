Our analytics.events table was set up with a sort order that's turning out to be wrong for how we actually query the data — we almost always filter by event type first. We need to change how it's sorted without losing any of the existing rows.

Can you reshape the table so queries that filter by event type scan less data, and make sure we don't lose anything? Leave a short README for the on-call operator (what you did and how to verify), and keep your steps safe to re-run in case we need to replay them.
