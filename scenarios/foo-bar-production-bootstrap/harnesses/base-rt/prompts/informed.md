Stand up a healthy production deployment that ingests events and serves
aggregated counts. The user wants to track events with `primaryKey` (string),
`timestamp` (Unix seconds), and optional `optionalText` fields — events go in
via an HTTP POST, aggregated counts come out via an HTTP GET, and a health
endpoint exposes liveness for monitoring.

This is the control-group harness. The container has Python, Node.js, and CLI
access to ClickHouse, Redpanda, and Postgres locally, but **no managed-platform
tooling and no pre-seeded hosting credentials**. You're not given a "deploy"
button; you decide how to deliver a production URL. Bring your own hosting if
you want — outbound network is open. `/data/test_event.json` is the smoke-test
event for post-deploy verification.

Scenario contracts:

1. The deployed base URL must be reachable from outside the container over
   HTTPS at a public hostname. Localhost, dev tunnels, and `*.local` will not
   pass the production gate.

2. Write the base URL to `/workspace/.deployed-url`. The assertion runner
   reads this file to probe the URL independently — if it's missing or empty,
   every assertion fails.

3. Tell the assertion runner what endpoints you built. Drop a JSON file at
   `/workspace/.endpoints.json` with the paths you exposed:

   ```json
   {
     "ingest": "/events",
     "query": "/counts",
     "health": "/health"
   }
   ```

   Defaults match the example above if you skip the file. The assertion
   runner POSTs `/data/test_event.json` to `<url><ingest>` (expect 2xx),
   then GETs `<url><query>` and expects a 200 JSON response that reflects
   the ingested event (e.g. row-count goes up, the `primaryKey` shows up,
   or a `count`/`total` field is non-zero). Poll for a few seconds before
   giving up — async pipelines are fine.

4. `<url><health>` must return 200. The gate doesn't care about the body
   shape on this harness — it just probes liveness.

5. Leave a note in `/workspace/README.md` recording the project name you
   chose and the deployed URL, so the on-call can find what you created.
   Stand up a new deployment for this scenario — don't reuse some other
   service that already exists.

Don't commit any API keys or hosting credentials into a workspace file —
the production gate scans for them. Assertions probe the URL independently
using `fetch()`, so your own claim of success is not sufficient.
