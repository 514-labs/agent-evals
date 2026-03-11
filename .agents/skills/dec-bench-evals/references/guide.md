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

### Task Categories

- `schema-design`
- `query-optimization`
- `ingestion`
- `migration`
- `debugging`
- `materialized-views`
- `partitioning`
- `replication`
- `compression`
- `monitoring`

### Built-In Harnesses

- `base-rt`
- `classic-de`
- `olap-for-swe`

### Personas

- `naive`
- `savvy`

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
  "harness": "base-rt",
  "tasks": [
    {
      "id": "ingest-csvs",
      "description": "Create a ClickHouse table and load all five CSV files.",
      "category": "ingestion"
    }
  ],
  "personaPrompts": {
    "naive": "prompts/naive.md",
    "savvy": "prompts/savvy.md"
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
- `harness`: pick a built-in harness unless tooling needs force a custom one.
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

## Prompt Writing

Both personas must ask for the same outcome.

### Naive Example

```markdown
I have five CSV files with event data in /data/csv/. They need to go into ClickHouse but I think some of the files have problems. Can you get all the data into a clean table?
```

### Savvy Example

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

- Naive uses plain language and avoids naming tools unless a real user would.
- Savvy can name schemas, tables, commands, and explicit constraints.
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

| Harness | Use when | Notes |
|---|---|---|
| `base-rt` | default choice | base infra plus Python, Node.js, and common DB CLIs |
| `classic-de` | dbt, Airflow, or heavier DE tooling | broader install surface, higher build cost |
| `olap-for-swe` | MooseStack workflows | narrower but specialized |

Create a custom harness only when:

- no built-in harness provides the needed packages
- outbound network restrictions are part of the scenario
- tool installation itself is part of the benchmark contract

Keep custom harness scripts short, reproducible, and version-pinned when it matters.

## Registry Publish Flow

Authoring flow:

```bash
dec-bench create --name <id> --domain <domain> --tier <tier>
dec-bench validate --scenario <id>
dec-bench run --scenario <id> --harness <harness> --persona naive --mode no-plan
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

This skill is packaged under `.agents/skills/dec-bench-evals/`, which is discoverable by the `skills` CLI and compatible with skills.sh.

Typical install command from a repository that contains this skill:

```bash
npx skills add 514-labs/agent-evals --skill dec-bench-evals
```

To list discoverable skills in that repository without installing:

```bash
npx skills add 514-labs/agent-evals --list
```
