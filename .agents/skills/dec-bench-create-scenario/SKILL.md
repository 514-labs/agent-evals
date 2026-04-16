---
name: dec-bench-create-scenario
description: Create a new DEC Bench evaluation scenario from scratch. Use when a user says "create scenario", "new scenario", "add eval", "write a benchmark for", "create a performance test", or describes a data engineering task they want to benchmark.
---

# DEC Bench Create Scenario

Create a new DEC Bench evaluation scenario. This skill gathers context from the user, scaffolds the correct directory structure using the CLI, then guides you through filling in each file.

**CRITICAL: Never generate scenario files from scratch.** Always use `dec-bench create` to scaffold. The scaffold enforces the correct directory structure, file naming, and JSON shape. Generating files manually is how agents produce wrong output.

## Step 1: Gather context from the user

Before scaffolding, you MUST confirm these with the user:

1. **What is the task?** A concrete data engineering problem (not a vague idea like "improve the pipeline")
2. **Domain**: which business domain? For v0.x, use `foo-bar`
3. **Tier**: how complex? (see [tier definitions](https://decbench.ai/#difficulty-tiers))
   - `tier-1`: one focused task, 1-2 services
   - `tier-2`: design decisions or cross-service coordination, 1-2 services
   - `tier-3`: multiple interacting failure modes, 2-3+ services
4. **Starting state**: broken/incomplete (agent diagnoses and fixes) or greenfield (agent builds from scratch)?
5. **Which services?** Postgres, ClickHouse, Redpanda — or a subset?

Do NOT proceed until you have clear answers to these. Ask follow-up questions if the task is vague.

## Step 2: Scaffold with the CLI

Run `dec-bench create` with the gathered context:

```bash
dec-bench create \
  --name <scenario-id> \
  --domain <domain> \
  --tier <tier> \
  --harnesses base-rt,classic-de,olap-for-swe
```

The scenario ID should be lowercase, hyphenated, and specific to the task (e.g. `foo-bar-csv-ingest`, not `data-test`).

This generates the correct directory structure:

```
scenarios/<scenario-id>/
  assertions/       # one TypeScript file per quality gate
  init/             # SQL and scripts to seed data
  prompts/          # one prompt per persona (baseline + informed)
  scenario.json     # scenario metadata
  supervisord.conf  # which services start in the container
```

## Step 3: Complete scenario.json

The scaffold pre-fills `id`, `domain`, `tier`, and `harnesses`. Fill in the rest:

- `title`: human-readable name
- `description`: concrete task description
- `lede`: "In this scenario, an agent must..."
- `tasks[]`: one or more tasks with `id`, `description`, and `category`
- `infrastructure.services`: which services the scenario uses
- `infrastructure.description`: what the starting state looks like
- `tags`: searchable terms

Task categories: `schema-design`, `query-optimization`, `ingestion`, `migration`, `debugging`, `materialized-views`, `partitioning`, `replication`, `compression`, `monitoring`

See [references/guide.md](references/guide.md) for the full schema contract and a worked example.

## Step 4: Write persona prompts

Each scenario has two prompts — both must target the same outcome.

- **`prompts/baseline.md`**: plain language, no tool names, no implementation hints. Tests what the agent figures out on its own.
- **`prompts/informed.md`**: names specific tools, schemas, paths, constraints. Tests whether domain knowledge changes the outcome.

### Good example (from foo-bar-csv-ingest)

**baseline.md:**
```
I have five CSV files with event data in /data/csv/. They need to go into ClickHouse but I think some of the files have problems — weird dates, missing values, maybe duplicate headers. Can you get all the data into a clean table?
```

**informed.md:**
```
Ingest five CSV files from /data/csv/ into a single ClickHouse table `analytics.events`.

Known issues in the source files:
- `events_02.csv`: dates are in `DD/MM/YYYY` format instead of ISO-8601
- `events_03.csv`: nulls represented as "N/A", "null", and empty strings
- `events_04.csv`: duplicate header row mid-file
- `events_05.csv`: trailing comma on every row

Target schema:
- event_id: String
- event_ts: DateTime
- user_id: String
- event_type: String
- value: Float64 (nullable values should be 0)
```

### Bad example — DO NOT do this

```
Write a script that loads CSV files into a database and handles errors.
```

This is too vague, doesn't specify infrastructure, and doesn't set testable acceptance criteria.

## Step 5: Set up infrastructure and seed data

Edit `supervisord.conf` to start only the services the scenario needs:

```ini
[program:clickhouse]
command=/usr/bin/clickhouse-server --config-file=/etc/clickhouse-server/config.xml
autostart=true
autorestart=false
```

Add init scripts in `init/` to create schemas and seed data. These run after services are ready but before the agent starts.

- For broken/incomplete starts: seed defects (misconfigured connections, missing indexes, schema drift)
- For greenfield starts: seed healthy infrastructure and source data

Keep all seed data deterministic and reproducible.

## Step 6: Write gate assertions

Each scenario has five assertion files in `assertions/`, one per quality gate. The framework provides core assertions — you add scenario-specific checks.

Each exported async function tests one thing and returns `AssertionResult`:

```typescript
import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function target_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.clickhouse.query({
    query: "SELECT count() AS n FROM system.tables WHERE database = 'analytics' AND name = 'events'",
    format: "JSONEachRow",
  });
  const rows = await (result as any).json();
  const count = Number(rows[0]?.n ?? 0);
  return {
    passed: count === 1,
    message: count === 1 ? "Target table exists." : `Expected 1 table, got ${count}.`,
    details: { expected: 1, actual: count },
  };
}
```

Gate model:
1. **Functional**: it runs (table exists, process exits clean)
2. **Correct**: output is right (row counts, checksums, schema matches)
3. **Robust**: handles edge cases (nulls, duplicates, idempotent reruns)
4. **Performant**: meets latency/throughput targets
5. **Production**: you would ship it (no hardcoded secrets, tests present)

Assertion context provides:
- `ctx.clickhouse` for ClickHouse queries
- `ctx.postgres` for Postgres queries
- `ctx.env()` for environment variables

Shared helpers are available at `scenarios/_shared/assertion-helpers.ts` — read this file before writing production-gate assertions. It includes reusable checks like `scanWorkspaceForHardcodedConnections`, `hasReadmeOrDocs`, and `avoidsSelectStarQueries`.

See [references/guide.md](references/guide.md) for examples of all five gates.

## Step 7: Validate and test

```bash
dec-bench validate --scenario <scenario-id>
dec-bench build --scenario <scenario-id>
dec-bench run --scenario <scenario-id>
dec-bench results --latest --scenario <scenario-id>
```

Verify:
- All gates produce pass/fail results
- Failure messages are actionable
- Results are stable across repeated runs

## Common mistakes — DO NOT do these

1. **Generating a bash script instead of scenario files.** Always use `dec-bench create` to scaffold.
2. **Skipping the assertions directory.** Every scenario needs all five gate files.
3. **Using LLM-as-judge scoring.** All assertions must be deterministic — no text similarity or subjective rubrics.
4. **Making the informed prompt easier by changing the required outcome.** Both prompts must target the same acceptance criteria.
5. **Using non-deterministic seed data.** Every run must start from the same state.
6. **Generating a flat file structure.** The directory structure must match what `dec-bench create` produces.

## Reference

For the full schema contract, all enum values, assertion examples for every gate, and a worked example, see [references/guide.md](references/guide.md).

For a complete real scenario to study, read the files in `scenarios/foo-bar-csv-ingest/`.
