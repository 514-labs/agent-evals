Stand up a healthy production deployment on Boreal that ingests events and
serves an aggregated read path matching the user need in `/data/user-need.md`.

The `514` CLI is installed and authenticated against Boreal (eval org) — env
vars in your shell point it at the right backend, so do not pass `--api-url`
or any auth flags. The CLI exposes `project create` for template-based
deploys; run `514 project create --help` for args. The template is pinned:
deploy `$DEPLOY_TEMPLATE` (`typescript-express`), which exposes the routes
the user need maps onto out of the box — do not modify the template's code.
`/data/test_event.json` is the smoke-test event for post-deploy verification.

Do these in order:

1. Run `514 project create --name "$DEPLOY_PROJECT_NAME" --template "$DEPLOY_TEMPLATE"`.
   The deploy is asynchronous — the CLI exiting 0 only means the project was
   created, not that the runtime is serving traffic.

2. Poll the deployment status until Boreal reports it healthy and the URL
   responds. Time budget: `DEPLOY_HEALTHY_TIMEOUT_SECONDS` (default 600s). A
   successful run reaches a state where `GET <url>/health` returns 200 with
   body `{"healthy":[...],"unhealthy":[]}` and at minimum ClickHouse,
   Redpanda, and Consumption API in `healthy`.

3. Write the deployed base URL to `/workspace/.deployed-url`. The assertion
   runner reads this file to probe the URL independently — if the file is
   missing or empty, every assertion fails.

4. Round-trip the smoke event: POST `/data/test_event.json` to
   `<url>/ingest/Foo` with `Content-Type: application/json` (expect 200 with
   body `SUCCESS`), then GET
   `<url>/api/bar?orderBy=totalRows&startDay=1&endDay=31&limit=31`. The
   response is a JSON array `[{dayOfMonth, totalRows}, ...]`. Confirm the row
   for today's UTC dayOfMonth has `totalRows >= 1`. The transform from Foo →
   Bar → BarAggregatedMV is async; allow a few seconds and retry if needed.

5. Leave a note in `/workspace/README.md` recording the project name
   (`$DEPLOY_PROJECT_NAME`), the template (`$DEPLOY_TEMPLATE`), and the
   deployed URL, so the on-call can find what you created.

Do not commit the `HOSTING_CLI_API_KEY` or any other secret into a workspace
file — the production gate scans for them. The deployed URL must be reachable
from outside the container; assertions probe it independently using `fetch()`,
so the agent's own claim of success is not sufficient.
