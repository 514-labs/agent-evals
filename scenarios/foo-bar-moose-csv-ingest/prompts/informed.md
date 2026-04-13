In /workspace, bootstrap a Moose project and ingest five CSV files from /data/csv/ into a single ClickHouse table `analytics.events`.

Requirements:
- Use Moose for the project and start it with `moose dev --dockerless`.
- Start from a fresh workspace; `moose init` is the expected first step.
- Verify `moose --version` before you start the dev server, and make sure the generated project dependencies line up with that installed CLI.
- If the installed Moose CLI is a `-ci-` build and matching npm packages are available, pin `@514labs/moose-lib` and `@514labs/moose-cli` to that same CI version before you run `moose dev --dockerless`.
- If `moose init` scaffolds older `@514labs/moose-lib` or `@514labs/moose-cli` dependencies, upgrade them to the newest matching version before you run `moose dev --dockerless`.
- Define a model that produces this target schema:
  - event_id: String
  - event_ts: DateTime
  - user_id: String
  - event_type: String
  - value: Float64 (nullable values should become 0)
- Handle the known CSV issues:
  - `events_02.csv`: dates are in `DD/MM/YYYY` format instead of ISO-8601
  - `events_03.csv`: nulls represented as "N/A", "null", and empty strings
  - `events_04.csv`: duplicate header row mid-file
  - `events_05.csv`: trailing comma on every row

Operational details:
- Once Moose is running, ClickHouse is available at `http://localhost:18123`.
- Moose's ingest endpoint pattern is `http://localhost:4000/ingest/<ModelName>`.
- Load all 15 rows into `analytics.events` with no duplicate header rows and no out-of-range timestamps.
