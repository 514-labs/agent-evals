Stand up a healthy production deployment on 514 Hosting that ingests events and
serves an aggregated read path. The user wants to track events with
`primaryKey` (string), `timestamp` (Unix seconds), and optional `optionalText`
fields, with an ingest endpoint, an aggregated-counts endpoint, and a health
endpoint for monitoring.

The `514` CLI is installed and authenticated against the eval org — env vars
in your shell point it at the right backend, so don't pass `--api-url` or any
auth flags. The template is pinned: deploy `$DEPLOY_TEMPLATE`
(`typescript-express`); don't modify the template's code.
`/data/test_event.json` is the smoke-test event for post-deploy verification.

Scenario contracts:

1. Create a *new* project with `514 project create --name <your-name> --template "$DEPLOY_TEMPLATE"`.
   Pick any unique, descriptive name — do **not** `514 project list` and reuse
   an existing project, even if one looks like it would do the job. The
   scenario is bootstrapping from scratch. Time budget for it to be serving
   traffic: `DEPLOY_HEALTHY_TIMEOUT_SECONDS` (default 600s).

2. Write the deployed base URL to `/workspace/.deployed-url`. The assertion
   runner reads this file to probe the URL independently — if it's missing or
   empty, every assertion fails.

3. Round-trip the smoke event against the `typescript-express` routes:
   POST `/data/test_event.json` to `<url>/ingest/Foo` with
   `Content-Type: application/json` (expect 200, body `SUCCESS`), then GET
   `<url>/api/bar?orderBy=totalRows&startDay=1&endDay=31&limit=31`. The
   response is a JSON array `[{dayOfMonth, totalRows}, ...]`. Confirm the row
   for today's UTC `dayOfMonth` has `totalRows >= 1`. The Foo → Bar →
   BarAggregatedMV transform is async; allow a few seconds and retry if
   needed.

4. Leave a note in `/workspace/README.md` recording the project name you
   chose, the template (`$DEPLOY_TEMPLATE`), and the deployed URL, so the
   on-call can find what you created.

Don't commit `HOSTING_CLI_API_KEY` or any other secret into a workspace file —
the production gate scans for them. The deployed URL must be reachable from
outside the container; assertions probe it independently using `fetch()`, so
your own claim of success is not sufficient.
