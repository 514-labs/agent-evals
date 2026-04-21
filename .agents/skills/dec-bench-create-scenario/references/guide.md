# DEC Bench Eval Guide

Use this reference when you need the full DEC Bench contract while authoring or reviewing a scenario.

## Prerequisites

- Install `dec-bench` with `curl -fsSL https://decbench.ai/install.sh | sh`
- Run Docker locally
- Use Node.js 20+ and `pnpm` 10.4+
- Use `gh auth status` before `dec-bench registry publish`

## Current Enum Values

Use the current schema values inline instead of guessing.

### Domains

- `foo-bar`
- `b2b-saas`
- `b2c-saas`
- `ugc`
- `e-commerce`
- `advertising`
- `consumption-based-infra`

### Tiers

- `tier-1`
- `tier-2`
- `tier-3`

### Task Categories vs Registry Competencies

Two separate axes. `tasks[].category` goes in `scenario.json` (per-task activity). `--competencies` is passed to `dec-bench registry add` at publish time (per-scenario leaderboard tags). No strict mapping — pick 1–3 competencies that match what the scenario actually tests.

**Task categories** (`tasks[].category`): `schema-design`, `query-optimization`, `ingestion`, `migration`, `debugging`, `materialized-views`, `partitioning`, `replication`, `compression`, `monitoring`.

**Registry competencies** (`--competencies`): `environment-setup`, `data-modeling-and-schema-design`, `data-ingestion-and-integration`, `transformation-and-semantic-modeling`, `storage-and-data-layout`, `orchestration-and-dataops`, `data-quality-and-observability`, `reliability-and-fault-tolerance`, `distributed-systems-and-consistency`, `scalability-and-performance-engineering`, `security-privacy-and-governance`, `technology-selection-and-architecture-tradeoffs`.

### Built-In Harnesses

- `base-rt`
- `classic-de`
- `olap-for-swe`

### Personas

- `baseline`
- `informed`

### Planning Modes

- `plan`
- `no-plan`

### Registry Starting States

- `broken`
- `greenfield`

## `scenario.json` Contract

Use this shape as the working contract:

```json
{
  "id": "foo-bar-csv-ingest",
  "title": "Foo Bar CSV Ingest",
  "description": "Load five messy CSV files into clean ClickHouse tables.",
  "tier": "tier-1",
  "domain": "foo-bar",
  "harnesses": ["base-rt", "classic-de", "olap-for-swe"],
  "tasks": [
    {
      "id": "ingest-csvs",
      "description": "Create a ClickHouse table and load all five CSV files.",
      "category": "ingestion"
    }
  ],
  "personaPrompts": {
    "baseline": "prompts/baseline.md",
    "informed": "prompts/informed.md"
  },
  "infrastructure": {
    "services": ["clickhouse"],
    "description": "ClickHouse running but empty. Five messy CSV files in /data/csv/."
  },
  "tags": ["csv", "ingestion", "data-cleaning", "type-coercion"],
  "baselineMetrics": {
    "queryLatencyMs": 0,
    "storageBytes": 0,
    "costPerQueryUsd": 0
  },
  "referenceMetrics": {
    "queryLatencyMs": 50,
    "storageBytes": 5000000,
    "costPerQueryUsd": 0.001
  }
}
```

Field notes:

- `id`: directory name and scenario identifier; keep lowercase and hyphenated.
- `title`: human-readable display name.
- `description`: concrete task and failure surface, not marketing copy.
- `tier`: use the smallest tier that still exercises the target competency.
- `domain`: use one of the current enum values above.
- `harnesses`: array of harness profiles. Default to all three unless you have a reason to exclude one.
- `tasks[]`: one or more concrete tasks with a current task category.
- `personaPrompts`: always point to both prompt files.
- `infrastructure`: required in practice for clear starting-state docs, even if some code paths do not enforce it yet.
- `tags`: use search-friendly terms like data source, workload, and failure mode.
- `baselineMetrics`: before-agent state.
- `referenceMetrics`: good achievable state, not perfect fantasy numbers.

## Tier Scoping

Use tier as a scope control, not a prestige label.

| Tier | Typical shape | Good fit |
|---|---|---|
| `tier-1` | Single service, one focused task | isolated ingestion, simple debugging, one model or table |
| `tier-2` | Multiple tasks or light service coordination | CDC setup, schema evolution, recovery plus validation |
| `tier-3` | Cross-service orchestration and stricter constraints | Postgres -> Redpanda -> ClickHouse pipelines, performance plus reliability |

Heuristics:

- Start with `tier-1` for a new pattern.
- Use `tier-2` for most production-relevant evals.
- Use `tier-3` only when cross-service reasoning is the point.

## Infrastructure and Environment Files

A scenario directory controls its runtime environment through four files. The base image (`docker/base/Dockerfile`) already includes Postgres 16, ClickHouse, Redpanda, Node.js 22, and Python 3 — a scenario chooses which of those to start and how they are configured.

| File | Purpose | Required |
|---|---|---|
| `supervisord.conf` | Which services auto-start and in what order (`priority`). | yes |
| `harnesses/<harness-id>/prompts/baseline.md` | Baseline prompt for this harness (no tool names or hints). One per declared harness. | yes |
| `harnesses/<harness-id>/prompts/informed.md` | Informed prompt for this harness (tool names, paths, constraints). One per declared harness. | yes |
| `init/*.sql`, `init/*.sh` | Schema and seed data, common to every harness. Runs after services are ready, before the agent. | yes (at least one file) |
| `harnesses/<harness-id>/init/*` | Harness-scenario pair owned seed data. Runs only when that harness is active, after flat init, before the agent. Dir names must match `scenario.json::harnesses[]`. | optional |
| `harnesses/<harness-id>/install.sh` | Scenario-specific build-time install steps for one harness. Runs after the global harness install at image build time. | optional |
| `env.sh` | Exported environment variables for non-default ports, credentials, and connection strings. Sourced before readiness checks, init, agent, and assertions. | optional |
| `scenario.json::infrastructure` | Declarative marker of services and starting state. Used for registry and audit UI. | recommended |

### `env.sh` contract

When present at the scenario root, the entrypoint (`docker/base/entrypoint.sh`) sources it at the start of every lifecycle phase. Example from `scenarios/foo-bar-moose-csv-ingest/env.sh`:

```bash
#!/usr/bin/env bash

export CLICKHOUSE_URL="http://panda:pandapass@localhost:18123"
export CLICKHOUSE_HOST="localhost"
export CLICKHOUSE_PORT="18123"
export CLICKHOUSE_USER="panda"
export CLICKHOUSE_PASSWORD="pandapass"
```

Use `env.sh` when:

- The scenario uses a non-default port (e.g. Moose dockerless on 18123, not the image default).
- Seed credentials are different from the image defaults and init scripts + assertions both need them.
- A cross-service scenario needs a single source of truth for connection strings.

Keep `env.sh` side-effect free — no network calls, no waits, no writes. Treat it as a pure export block.

Reference example: `scenarios/foo-bar-moose-csv-ingest/env.sh`. Full docs: [Adding Multiple Services](https://decbench.ai/docs/add-eval/adding-multiple-services).

## Prompt Writing

Both personas must ask for the same outcome.

### Baseline Example

```markdown
I have five CSV files with event data in /data/csv/. They need to go into ClickHouse but I think some of the files have problems. Can you get all the data into a clean table?
```

### Informed Example

```markdown
Ingest five CSV files from /data/csv/ into a single ClickHouse table `analytics.events`.

Known issues in the source files:
- `events_02.csv`: dates are in `DD/MM/YYYY`
- `events_03.csv`: nulls represented as `N/A`, `null`, and empty strings
- `events_04.csv`: duplicate header row mid-file
- `events_05.csv`: trailing comma on every row

Target schema:
- event_id: String
- event_ts: DateTime
- user_id: String
- event_type: String
- value: Float64, fill null-like values with 0
```

Prompt rules:

- Baseline uses plain language and avoids naming tools unless a real user would.
- Informed can name schemas, tables, commands, and explicit constraints.
- Both prompts must preserve the same scoring bar.

## Assertion Design

DEC Bench scoring is deterministic and gate-based:

1. Functional
2. Correct
3. Robust
4. Performant
5. Production

Framework facts:

- Core assertions are universal and not authored in the scenario files.
- Scenario authors export named async functions.
- A gate passes when all core assertions pass and scenario assertions meet the 80% threshold.
- Function names become assertion keys in output and audit logs.

### Functional Example

```ts
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function target_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const count = Number(rows[0]?.n ?? 0);
  return {
    passed: count === 1,
    message: count === 1 ? "Target table exists." : `Expected 1 table, got ${count}.`,
    details: { count },
  };
}
```

### Correct Example

```ts
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function all_fifteen_events_loaded(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events");
  const count = Number(rows[0]?.n ?? 0);
  return {
    passed: count === 15,
    message: count === 15 ? "All 15 events loaded." : `Expected 15, got ${count}.`,
    details: { expected: 15, actual: count },
  };
}
```

### Robust Example

```ts
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function no_duplicate_header_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events WHERE event_id = 'event_id'",
  );
  const count = Number(rows[0]?.n ?? 0);
  return {
    passed: count === 0,
    message: count === 0 ? "No duplicate header rows." : `Found ${count} header rows.`,
    details: { count },
  };
}
```

### Performant Example

```ts
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function scan_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT event_type, count() AS n, sum(value) AS total FROM analytics.events GROUP BY event_type",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  return {
    passed: elapsed < 100,
    message: elapsed < 100 ? "Scan query under 100ms." : `Scan query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
```

### Production Example

```ts
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
  return {
    passed: hasClickHouse,
    message: hasClickHouse ? "Connection env vars available." : "Missing CLICKHOUSE_URL.",
    details: { hasClickHouse },
  };
}
```

Assertion heuristics:

- One exported function per check.
- Keep helper functions local to the file.
- Prefer explicit evidence in `details`.
- Use side effects only when the gate is specifically testing rerun or recovery behavior.
- Do not score with text similarity or human-style rubric judgments.

## Harness Selection

Harnesses define the tool layer on top of the base image. Each is a JSON file at `apps/web/data/harnesses/<id>.json`. The build pipeline (`docker/build.sh` → `docker/harness/Dockerfile`) extracts `installScript` and bakes it into an image layer at build time.

| Harness | Use when | Notes |
|---|---|---|
| `base-rt` | default choice | base infra plus Python, Node.js, and common DB CLIs |
| `classic-de` | dbt, Airflow, or heavier DE tooling | broader install surface, higher build cost |
| `olap-for-swe` | MooseStack workflows | narrower but specialized |

### Harness JSON schema

```json
{
  "id": "<matches filename>",
  "title": "Display name",
  "tagline": "One-line pitch",
  "description": "What this harness adds on top of the base image.",
  "installScript": "bash one-liner that runs at image build time",
  "networkPolicy": "open",
  "allowlistedEndpoints": [],
  "tools": [
    { "name": "moose-cli", "version": "0.6.506-ci-69-gb64f930bd", "category": "framework" }
  ]
}
```

Fields:

- `installScript`: a single shell string executed as `bash -c` against the scenario image layer. Use `&&` chains, pin versions, and avoid long-running steps — build time hits the author feedback loop.
- `networkPolicy`: `open` or `allowlist`. Most scenarios use `open`.
- `allowlistedEndpoints`: list of hostnames when `networkPolicy` is `allowlist`.
- `tools`: display-only manifest surfaced in the audit UI. Keep versions in sync with what `installScript` actually installs.

### Adding a custom harness

Create one only when:

- No built-in harness provides the needed packages or tool versions.
- Outbound network restrictions are part of the scenario.
- Tool installation itself is part of the benchmark contract.

Minimal custom harness:

```json title="apps/web/data/harnesses/my-custom.json"
{
  "id": "my-custom",
  "title": "My Custom Harness",
  "tagline": "dbt-core + one extra CLI.",
  "description": "Adds dbt-core and an internal CLI to the base image.",
  "installScript": "pip3 install --no-cache-dir --break-system-packages dbt-core==1.10.19 && npm install -g some-cli@1.2.3",
  "networkPolicy": "open",
  "allowlistedEndpoints": [],
  "tools": [
    { "name": "dbt-core", "version": "1.10.19", "category": "framework" },
    { "name": "some-cli", "version": "1.2.3", "category": "cli" }
  ]
}
```

Then list it in the scenario:

```json
"harnesses": ["my-custom"]
```

Keep custom harness scripts short, reproducible, and version-pinned. Full docs: [Creating a Custom Harness](https://decbench.ai/docs/add-eval/creating-a-custom-harness).

### Tool-version pinning across scenarios

Tool versions inside a built-in harness are shared across every scenario that selects it. Two escape hatches:

1. **Scenario-specific install extension** — place `harnesses/<harness-id>/install.sh` inside the scenario directory. It runs at image build time after the global harness install, so you can `pip install` a different version for just this scenario.
2. **Custom harness** — fork a new JSON file at `apps/web/data/harnesses/<id>.json` when you need a fully different tool set or version baseline.

## Registry Publish Flow

Authoring flow:

```bash
dec-bench create --name <id> --domain <domain> --tier <tier>
dec-bench validate --scenario <id>
dec-bench run --scenario <id> --harness <harness> --persona baseline --mode no-plan
dec-bench results --latest --scenario <id>
dec-bench audit open --scenario <id> --run-id <run-id>
dec-bench registry add --scenario scenarios/<id>
dec-bench registry publish --id <id>
```

Useful flags:

- `dec-bench registry add --competencies <a,b,c>`
- `dec-bench registry add --features <a,b,c>`
- `dec-bench registry add --starting-state broken|greenfield`
- `dec-bench registry add --services <a,b,c>`
- `dec-bench registry publish --base <branch>`
- `dec-bench registry publish --draft`

`registry publish` automates:

- branch creation
- staging generated registry JSON
- commit creation
- push to remote
- PR creation through `gh`

Review checklist:

- scenario ID is unique
- domain, competencies, and features match the actual scenario
- required files exist and are coherent
- scenario validates and runs locally before publish

## Worked Example: `foo-bar-csv-ingest`

This is a good tier-1 reference because it stays small but still shows the full DEC pattern.

- Domain: `foo-bar`
- Tier: `tier-1`
- Start: greenfield-ish ClickHouse with messy source files
- Harness: `base-rt`
- Task: one ingestion workflow
- Assertions: table existence, row counts, duplicate-header handling, latency threshold, env-var hygiene

Use it when you need a clean reference for prompt style, assertion granularity, and `scenario.json` shape.

## Skill Distribution

This reference is shared across the DEC Bench skills:

From the repo root:

```bash
npx skills add . -a claude-code -a cursor -a codex
```

To list available skills without installing:

```bash
npx skills add . --list
```
