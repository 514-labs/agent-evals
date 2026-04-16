---
name: dec-bench-create-scenario
description: Create a new DEC Bench evaluation scenario from scratch. Use when a user says "create scenario", "new scenario", "add eval", "write a benchmark for", "create a performance test", or describes a data engineering task they want to benchmark.
---

# DEC Bench Create Scenario

Create a new DEC Bench evaluation scenario. This skill gathers context from the user, scaffolds the correct directory structure using the CLI, then guides you through filling in each file.

**CRITICAL: Never generate scenario files from scratch.** Always use `dec-bench create` to scaffold. The scaffold enforces the correct directory structure, file naming, and JSON shape. Generating files manually is how agents produce wrong output.

## Step 1: Check for similar scenarios

Before creating anything, scan the existing scenarios to avoid duplicating work:

```bash
dec-bench list
ls scenarios/
```

Read the `scenario.json` of any scenarios that look similar to what the user is asking for. If a close match exists, tell the user and ask whether they want to extend the existing scenario or create a new one.

## Step 2: Gather context from the user

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

## Step 3: Scaffold with the CLI

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

## Step 4: Complete scenario.json

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

## Step 5: Write persona prompts

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

## Step 6: Set up infrastructure and seed data

A scenario controls its runtime environment through three files: `supervisord.conf` (which services start), `init/` (schema and seed data), and optionally `env.sh` (ports and connection strings). The base image (`docker/base/Dockerfile`) already includes Postgres, ClickHouse, Redpanda, Node.js, and Python — you do not install them.

### `supervisord.conf` — which services start

Edit `supervisord.conf` to start only the services the scenario needs:

```ini
[program:clickhouse]
command=/usr/bin/clickhouse-server --config-file=/etc/clickhouse-server/config.xml
autostart=true
autorestart=false
```

Use `priority` to order startup when multiple services depend on each other. See [Adding Multiple Services](https://decbench.ai/docs/add-eval/adding-multiple-services) for the full multi-service pattern (Postgres → Redpanda → ClickHouse).

For scenarios where the agent is expected to start services itself (e.g. `moose dev --dockerless`), leave `supervisord.conf` empty of `[program:*]` blocks. `scenarios/foo-bar-moose-csv-ingest/supervisord.conf` is the reference example.

### `init/` — schema and seed data

Add init scripts in `init/`. These run after services pass readiness checks but before the agent starts.

- For broken/incomplete starts: seed defects (misconfigured connections, missing indexes, schema drift)
- For greenfield starts: seed healthy infrastructure and source data

Keep all seed data deterministic and reproducible — every run must start from the same state.

### `env.sh` — custom ports and connection strings (optional)

Add `env.sh` at the scenario root when the scenario uses non-default ports, non-default credentials, or needs to expose connection strings to init scripts, the agent, and assertions. The container entrypoint (`docker/base/entrypoint.sh`) sources `env.sh` before readiness checks, init scripts, agent execution, and assertions — so every layer sees the same values.

```bash
#!/usr/bin/env bash

export CLICKHOUSE_URL="http://panda:pandapass@localhost:18123"
export CLICKHOUSE_HOST="localhost"
export CLICKHOUSE_PORT="18123"
export CLICKHOUSE_USER="panda"
export CLICKHOUSE_PASSWORD="pandapass"
```

Reference example: `scenarios/foo-bar-moose-csv-ingest/env.sh` (Moose dockerless on port 18123 with non-default credentials). Omit `env.sh` entirely if the scenario uses the default ports and credentials.

## Step 6b: When no built-in harness fits

The three built-in harnesses (`base-rt`, `classic-de`, `olap-for-swe`) live as JSON files at `apps/web/data/harnesses/<id>.json`. They define what gets installed on top of the base image, the network policy, and the tool manifest shown in the audit UI. Pick an existing one when its tool list covers your scenario.

Create a **custom harness** only when:

- No built-in harness provides the packages or tool versions you need.
- The scenario requires outbound network restrictions beyond the harness default.
- Tool installation itself is part of the benchmark contract.

To add one, drop a new JSON file next to the built-ins:

```json title="apps/web/data/harnesses/my-custom.json"
{
  "id": "my-custom",
  "title": "My Custom Harness",
  "tagline": "Short pitch.",
  "description": "What the harness adds on top of the base image.",
  "installScript": "pip3 install --no-cache-dir --break-system-packages dbt-core==1.10.19 && npm install -g some-cli@1.2.3",
  "networkPolicy": "open",
  "allowlistedEndpoints": [],
  "tools": [
    { "name": "dbt-core", "version": "1.10.19", "category": "framework" },
    { "name": "some-cli", "version": "1.2.3", "category": "cli" }
  ]
}
```

Then list it in your scenario's `harnesses` array:

```json
"harnesses": ["my-custom"]
```

The `installScript` runs once at image-build time (see `docker/build.sh` and `docker/harness/Dockerfile`). Pin versions, keep the surface area small, and avoid long-running installs — build time directly hits the author's feedback loop.

See [Creating a Custom Harness](https://decbench.ai/docs/add-eval/creating-a-custom-harness) for the full docs and `apps/web/data/harnesses/olap-for-swe.json` for a non-trivial worked example (Moose install, pinned versions, MCP config).

**Note on tool versions in built-in harnesses:** as of today, tool versions in each built-in harness are shared across every scenario that selects that harness. If you need a different Moose/dbt/514 version for one specific scenario, forking to a custom harness is the only supported path.

## Step 7: Write gate assertions

Each scenario has five assertion files in `assertions/`, one per quality gate. The framework provides core assertions — you add scenario-specific checks.

The API types:

```typescript
interface AssertionResult {
  passed: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

interface AssertionContext {
  pg: { query: (text: string, params?: unknown[]) => Promise<QueryResult> };
  clickhouse: ClickHouseClient;
  env: (key: string) => string | undefined;
}
```

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

## Step 8: Validate and test

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
7. **Hard-coding non-default ports in init scripts and prompts.** Put them in `env.sh` instead so init, agent, and assertions all see the same values.
8. **Pinning tool versions inside a prompt.** Tool versions belong in the harness JSON (`apps/web/data/harnesses/<id>.json`). If you need a different version than the built-in harness provides, add a custom harness — do not instruct the agent to `npm install` at runtime.

## Reference

For the full schema contract, all enum values, `env.sh` and harness JSON schemas, and assertion examples for every gate, see [references/guide.md](references/guide.md).

For complete real scenarios to study:
- `scenarios/foo-bar-csv-ingest/` — minimal tier-1, `base-rt` harness, default ports.
- `scenarios/foo-bar-moose-csv-ingest/` — `olap-for-swe` harness, custom ports via `env.sh`, agent bootstraps services itself.
- `scenarios/foo-bar-cross-system-reconciliation/` — multi-service with supervisord priorities across Postgres, Redpanda, and ClickHouse.
