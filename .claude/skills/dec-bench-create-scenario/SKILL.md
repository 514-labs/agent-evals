---
name: dec-bench-create-scenario
description: Create a new DEC Bench evaluation scenario from scratch. Use when a user says "create scenario", "new scenario", "add eval", "write a benchmark for", "create a performance test", or describes a data engineering task they want to benchmark.
---

# DEC Bench Create Scenario

Create a new DEC Bench evaluation scenario. This skill gathers context from the user, scaffolds the correct directory structure using the CLI, then guides you through filling in each file.

**CRITICAL: Never generate scenario files from scratch.** Always use `dec-bench create` to scaffold. The scaffold enforces the correct directory structure, file naming, and JSON shape. Generating files manually is how agents produce wrong output.

## Object model (read this first)

A scenario is a matrix, not a single run.

  1 scenario × N harnesses × 2 personas = 2N evaluations.

- A scenario declares `harnesses[]` in `scenario.json`.
- For every entry there, the (scenario, harness) pair is its own unit of ownership: it has its own `prompts/baseline.md` and `prompts/informed.md`, and may have its own `init/` (seed data) and `install.sh` (build-time tools).
- `init/`, `assertions/`, `supervisord.conf`, and `scenario.json` at the scenario root are shared across all harnesses.

```
scenarios/<id>/
  scenario.json                     # declares harnesses[]
  supervisord.conf                  # services (shared)
  init/                             # shared seed data
  assertions/                       # shared gates
  harnesses/<harness-id>/
    prompts/{baseline,informed}.md  # required per pair
    init/                           # optional; only this pair
    install.sh                      # optional; only this pair
```

When the user describes a task, decide first: is this one harness or a comparison across harnesses? That choice determines how many prompt sets you write.

Why prompts and init can differ per harness:

- Prompts diverge to control whether the agent reaches for a specific tool. The baseline tests whether the agent picks the tool unprompted; an informed prompt that names the tool tests how well the agent uses the tool when told to. Different harnesses ship different tools, so informed prompts usually name different tools per harness.
- Init diverges when harnesses need different starting infrastructure (e.g. a scaffolded Moose project for `olap-for-swe` vs a scaffolded dbt project for `classic-de`) so each harness boots into the state its tools expect.

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

> **CLI version note.** This skill targets `dec-bench` v0.2.0 or later (`--harnesses` plural, `"harnesses": [...]` array in `scenario.json`). If your CLI errors with `unexpected argument '--harnesses'`, you are on v0.1.0 — upgrade with `curl -fsSL https://decbench.ai/install.sh | sh`.

This generates the correct directory structure:

```
scenarios/<scenario-id>/
  assertions/                              # one TypeScript file per quality gate
  harnesses/<harness-id>/prompts/          # baseline.md + informed.md per harness
  harnesses/<harness-id>/init/             # harness-specific seed data (2+ harnesses only)
  init/                                    # common seed data (all harnesses)
  scenario.json                            # scenario metadata
  supervisord.conf                         # which services start in the container
```

## Step 4: Complete scenario.json

The scaffold pre-fills `id`, `domain`, `tier`, and `harnesses`. There is no `personaPrompts` field — prompts are owned by the harness-scenario pair. It does NOT emit `infrastructure` — you must add it by hand. Fill in:

- `title`: human-readable name
- `description`: concrete task description
- `lede`: "In this scenario, an agent must..."
- `tasks[]`: one or more tasks with `id`, `description`, and `category`
- `infrastructure` (add this block yourself):
  - `services`: array of service ids the scenario uses (`clickhouse`, `postgres`, `redpanda`, or `[]` for agent-bootstrapped)
  - `description`: one-line summary of the starting state
- `tags`: searchable terms

Task categories: `schema-design`, `query-optimization`, `ingestion`, `migration`, `debugging`, `materialized-views`, `partitioning`, `replication`, `compression`, `monitoring`. These describe the task activity (per-task, for `scenario.json`). Broader leaderboard capability tags (`--competencies`) are set separately at registry publish time — see `guide.md`.

See [references/guide.md](references/guide.md) for the full schema contract and a worked example.

## Step 5: Write persona prompts

Each harness-scenario pair has two prompts — both must target the same outcome. Prompts live under `harnesses/<harness-id>/prompts/`, not at the scenario root.

- **`harnesses/<harness-id>/prompts/baseline.md`**: plain language, no tool names, no implementation hints. Tests what the agent figures out on its own.
- **`harnesses/<harness-id>/prompts/informed.md`**: names specific tools, schemas, paths, constraints. Tests whether domain knowledge changes the outcome.

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

A scenario controls its runtime environment through three files: `supervisord.conf` (which services start), `init/` (schema and seed data, with optional per-harness subdirs), and optionally `env.sh` (ports and connection strings). The base image (`docker/base/Dockerfile`) already includes Postgres, ClickHouse, Redpanda, Node.js, and Python — you do not install them.

These map to the object model above. Four setup layers. Put each thing in the right one:

| Layer | Lives in | Runs at | Contents |
|---|---|---|---|
| 1. Harness install | `apps/web/data/harnesses/<id>.json::installScript` | Image build, once per image | **Tools.** CLIs and frameworks: Moose CLI, dbt, the 514 CLI, language runtimes beyond the base. |
| 2. Scenario-harness install | `scenarios/<id>/harnesses/<harness-id>/install.sh` | Image build, after layer 1, per scenario+harness | **Scenario-specific tool overrides.** Additional or scenario-specific install steps for one harness. Only needed when the global harness isn't quite right for this scenario. |
| 3. Scenario init (common) | `scenarios/<id>/init/*.sh`, `*.sql` | Container startup, every run | **Seed data, common.** Schemas, tables, fixtures, CSVs, deterministic source state that applies to every harness. |
| 4. Scenario init (per-harness) | `scenarios/<id>/harnesses/<harness-id>/init/*` | Container startup, only when that harness is active | **Seed data, harness-specific.** Starting state that differs per harness — e.g. a scaffolded Moose project vs a scaffolded dbt project in a comparison scenario. Owned by the harness-scenario pair, not the persona. |
| 5. Agent prompt | `scenarios/<id>/harnesses/<harness-id>/prompts/<persona>.md` | Agent startup | **Prompt for this harness.** `baseline.md` and `informed.md` tailored to the tools available in this harness. |

Rules of thumb:

- Installing a tool? Layer 1 (harness). See Step 6b.
- Need a scenario-specific twist on a harness install? Layer 2 (`harnesses/<harness-id>/install.sh`).
- Seeding state every harness needs? Layer 3 (flat `init/`).
- Seeding state only one harness needs? Layer 4 (`harnesses/<harness-id>/init/`). Almost always comparison scenarios.
- Mixing Layer 1 and Layer 3 is the most common mistake: installing a CLI in `init/*.sh` runs it every single run and leaks setup across scenarios.

### What the scaffold gives you

`dec-bench create` ships an opinionated Postgres-flavored starting point:

- `supervisord.conf` with a `[program:postgres]` block that auto-starts Postgres.
- `init/postgres-setup.sql` (placeholder).

For ClickHouse-only, Redpanda-only, Moose-dockerless, or multi-service scenarios, overwrite or delete these — do not leave unused Postgres startup in place.

### `supervisord.conf` — which services start

Edit `supervisord.conf` to start only the services the scenario needs:

```ini
[program:clickhouse]
command=/usr/bin/clickhouse-server --config-file=/etc/clickhouse-server/config.xml
autostart=true
autorestart=false
```

Use `priority` to order startup when multiple services depend on each other. See [Adding Multiple Services](https://decbench.ai/docs/add-eval/adding-multiple-services) for the full multi-service pattern (Postgres → Redpanda → ClickHouse).

For scenarios where the agent is expected to start services itself (e.g. `moose dev --dockerless`), leave `supervisord.conf` with just the `[supervisord]` header and no `[program:*]` blocks. `scenarios/foo-bar-moose-csv-ingest/supervisord.conf` is the reference example.

### `init/` — schema and seed data

Add init scripts in `init/`. The entrypoint runs them after services pass readiness checks and before the agent starts. `.sql` files are piped into their service's client; `.sh` files are executed with bash.

- For broken/incomplete starts: seed defects (misconfigured connections, missing indexes, schema drift).
- For greenfield starts: seed healthy infrastructure and source data.

**Source files (CSV, JSON, fixtures) live inside the container, not the scenario directory.** Write an `init/setup-*.sh` that creates `/data/<...>` and writes the files inline with heredocs so every run starts from a deterministic state:

```bash
#!/bin/bash
mkdir -p /data/csv

cat > /data/csv/events_01.csv << 'EOF'
event_id,event_ts,user_id,event_type,value
evt_001,2026-01-15T10:00:00Z,usr_01,click,1.5
evt_002,2026-01-15T10:05:00Z,usr_02,purchase,42.0
EOF
```

Reference: `scenarios/foo-bar-csv-ingest/init/setup-csvs.sh`. Keep all seed data deterministic — every run must start from the same state.

#### Per-harness init (for comparison scenarios)

When a scenario runs under multiple harnesses and the seeded starting state differs per harness, put harness-specific scripts in `harnesses/<harness-id>/init/`. These run only when that harness is active. Flat files in `init/` still run first for every harness. The harness-scenario pair owns these init scripts — not the persona.

```
scenarios/foo-bar-ingest-compare/
├── init/
│   └── 01-clickhouse-setup.sql          # common — runs for every harness
└── harnesses/
    ├── olap-for-swe/
    │   └── init/
    │       └── seed.sh                  # runs only when harness is olap-for-swe
    └── classic-de/
        └── init/
            └── seed.sh                  # runs only when harness is classic-de
```

Run order: flat `init/` files first (alphabetical), then `harnesses/<harness-id>/init/` (alphabetical within). Subdir names must match entries in `scenario.json`'s `harnesses[]`; `dec-bench validate` warns on drift. `dec-bench create` scaffolds subdir skeletons automatically when you pass 2+ entries to `--harnesses`.

You can also place an `install.sh` directly under `harnesses/<harness-id>/` (not inside `init/`) for scenario-specific build-time tool installation that runs after the global harness install.

### `env.sh` — custom ports and connection strings (optional)

Add `env.sh` at the scenario root when the scenario uses non-default ports, non-default credentials, or needs to expose connection strings to init scripts, the agent, and assertions. The container entrypoint (`docker/base/entrypoint.sh`) **sources** `env.sh` (`. /scenario/env.sh`) before readiness checks, init scripts, agent execution, and assertions — so every layer sees the same values. No executable bit needed.

```bash
#!/usr/bin/env bash

export CLICKHOUSE_URL="http://panda:pandapass@localhost:18123"
export CLICKHOUSE_HOST="localhost"
export CLICKHOUSE_PORT="18123"
export CLICKHOUSE_USER="panda"
export CLICKHOUSE_PASSWORD="pandapass"
```

Keep `env.sh` side-effect free: exports only, no waits, no network calls, no writes. Reference: `scenarios/foo-bar-moose-csv-ingest/env.sh`. Omit the file entirely if the scenario uses default ports and credentials.

#### Bad example — DO NOT do this

```bash
#!/usr/bin/env bash

export CLICKHOUSE_URL="http://localhost:18123"

# BAD: blocks every lifecycle phase, turns env.sh into a readiness probe.
until curl -sf http://localhost:18123/ping; do sleep 1; done

# BAD: writes state on each sourcing (entrypoint, init, agent, assertions).
echo "ClickHouse ready at $(date)" >> /tmp/startup.log
```

`env.sh` is sourced at the start of every lifecycle phase. Work belongs in `supervisord.conf` (readiness) or `init/*.sh` (one-time seeding), not here.

#### Per-harness `env.sh` (comparison scenarios)

When a scenario runs under multiple harnesses whose connection strings or database layouts differ — e.g. Tinybird's `:7182` ClickHouse-compatible interface with workspace-scoped auth vs. a vanilla `:8123` ClickHouse — put harness-specific exports in `harnesses/<harness-id>/env.sh`. The entrypoint sources this file **after** the scenario-level `env.sh`, so harness exports override defaults.

Sourcing order per lifecycle phase:
1. `/scenario/env.sh` (scenario defaults)
2. `/scenario/harnesses/$EVAL_HARNESS/env.sh` (harness override, optional)

Both files are sourced **twice** per run: once before init, and once after the agent exits (so assertions see init-written state). Per-harness env.sh files MUST be idempotent across those two passes when they reference files written by init. Guard those reads:

```bash
if [[ -r /workspace/.tb-env ]]; then
  source /workspace/.tb-env
  export CLICKHOUSE_URL="http://${TB_WORKSPACE}:${TB_ADMIN_TOKEN}@localhost:7182"
  export EVENTS_DATABASE="${TB_WORKSPACE}"
else
  # First pass, before init has run — provide defaults.
  export CLICKHOUSE_URL="http://localhost:7182"
  export EVENTS_DATABASE="default"
fi
```

Reference: `scenarios/foo-bar-mv-access-patterns/harnesses/tinybird-forward/env.sh`.

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

**Note on tool versions in built-in harnesses:** tool versions in each built-in harness are shared across every scenario that selects it. If you need a minor tweak for one scenario (e.g. a post-install config step), add `harnesses/<harness-id>/install.sh` inside the scenario directory — it runs after the global harness install (layer 2). For a fully different tool version, fork to a custom harness.

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

### How a gate passes

Each gate combines **core assertions** (framework-provided, you don't write them) with **scenario assertions** (the functions you export). A gate passes when:

1. **All core assertions pass** (not 80% — all of them).
2. **Scenario assertion pass rate ≥ 0.8** (80% threshold, `PASS_THRESHOLD` in `packages/eval-core/src/runner.ts`).

A failed gate blocks every subsequent gate in the scenario — downstream gates get marked as not-run. This is why assertion authoring discipline matters most at the earliest gates.

If a scenario assertion file exports zero functions, its score is treated as 1.0 (vacuous truth) and the gate's pass/fail reduces to the core assertions. Empty files are valid but wasteful — you're letting the framework's core do all the work.

### What core assertions already cover (you do not write these)

| Gate | Core assertions | What they cover |
|---|---:|---|
| Functional | 2 | `process_exits_clean`, `no_unhandled_errors` (scans session log for tracebacks / panics) |
| Correct | 0 | none — all checks are scenario-authored |
| Robust | 1 | `idempotent_rerun` (second run against the same seed produces the same state) |
| Performant | 0 | none — all checks are scenario-authored |
| Production | 12 | env-var use, secret scan, output line count, dead-code markers, file size, debug artifacts, compiler errors, lint errors, type safety, focused functions, deep nesting |

Production is where the framework does the heaviest lifting. Your scenario-authored production assertions should be surgical (README presence, no hardcoded connections, no SELECT *) — do not duplicate core checks. Shared helpers for these live at `scenarios/_shared/assertion-helpers.ts` (`scanWorkspaceForHardcodedConnections`, `hasReadmeOrDocs`, `avoidsSelectStarQueries`) — read that file before writing production assertions.

### How many functions per file

Typical scenarios ship **1–3 exported functions per gate file**. Observed across `foo-bar-csv-ingest`, `foo-bar-moose-csv-ingest`, `foo-bar-cross-system-reconciliation`, `foo-bar-clickhouse-materialized-view`, `foo-bar-slow-queries`:

- `functional.ts`: 1–2 (beyond the 2 core checks)
- `correct.ts`: 1–3 (this is where most scenario-specific correctness lives)
- `robust.ts`: 2–3 (beyond `idempotent_rerun`)
- `performant.ts`: 2–3
- `production.ts`: 3–5 (on top of 12 core checks)

If you find yourself writing 8+ functions in a single gate file, split the scenario.

### Assertion context

- `ctx.clickhouse` — ClickHouse client (use `ctx.clickhouse.query({ query, format: "JSONEachRow" })`)
- `ctx.pg` — Postgres client (use `ctx.pg.query(sql, params)`)
- `ctx.env(key)` — reads environment variables set by `env.sh` or the container

### Good vs bad assertions

Assertions must be **deterministic and exact**. Every run of the same scenario state must produce the same pass/fail result.

Good — exact count, deterministic, useful failure detail:

```typescript
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

Bad — text similarity / LLM-as-judge / subjective rubric:

```typescript
// DO NOT do this
export async function data_looks_right(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows(ctx, "SELECT * FROM events LIMIT 5");
  const passed = JSON.stringify(rows).includes("evt_") && rows.length > 0;
  return { passed, message: passed ? "Looks good." : "Doesn't look right." };
}
```

Bad — time-dependent / flaky:

```typescript
// DO NOT do this
export async function latency_ok(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({ query: "SELECT count() FROM analytics.events", format: "JSONEachRow" });
  const elapsed = Date.now() - start;
  return { passed: elapsed < 50, message: `Took ${elapsed}ms.` };
}
```

The second version is flaky because network latency, cache state, and concurrent load make 50ms arbitrary. If you need a latency bound, choose one that survives retries (e.g. `< 500` for a simple count, not `< 50`) and average across a small number of runs in the assertion itself.

See [references/guide.md](references/guide.md) for assertion examples at every gate.

### LLM-as-judge assertions (use sparingly)

For checks that genuinely cannot be encoded deterministically (e.g. "did the agent inspect query patterns before changing the schema?"), `@dec-bench/eval-core` exports an `llmJudge(...)` helper. It returns a normal `AssertionFn`, so the result lands in the same gate alongside deterministic assertions and is logged in the same shape.

```typescript
import { llmJudge } from "@dec-bench/eval-core";

export const orderby_choice_is_well_reasoned = llmJudge({
  rubric: `Read the agent's session log. Pass if the agent inspected actual query
  patterns before choosing the new ORDER BY. Fail if the agent guessed.`,
  inputs: ["sessionLog"],            // available: sessionLog, prompt, workspaceFiles, assertionOutcomes
  tools: ["clickhouse-readonly"],    // available: clickhouse-readonly, pg-readonly, http-get (read-only)
  // model: "claude-sonnet-4-6", samples: 1, maxTurns: 6  (defaults)
});
```

Rules:

- Default to deterministic. Reach for `llmJudge` only when no deterministic check can be written.
- Tools are read-only and server-enforced. The judge cannot mutate state.
- The judge fails closed if `ANTHROPIC_API_KEY` is unset; deterministic assertions in the same gate still run.
- The verdict (pass/fail + reasoning + tool-call transcript) is recorded in `details.judge` of the assertion log.
- Two **meta-judges** (`agent-did-not-cheat`, `eval-or-product-concerns`) run automatically on every scenario and surface in `meta` of the assertion log; they do **not** affect gate scores. Opt out per-scenario in `scenario.json`: `"metaJudges": { "agent-did-not-cheat": false }`. Globally disable with `EVAL_DISABLE_META_JUDGES=1`.

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
3. **Reaching for LLM-as-judge when a deterministic assertion would do.** Deterministic assertions are preferred. The `llmJudge(...)` helper from `@dec-bench/eval-core` is available for cases that genuinely cannot be encoded deterministically (see "LLM-as-judge assertions" below); use it sparingly and never in place of a deterministic check that would work.
4. **Making the informed prompt easier by changing the required outcome.** Both prompts must target the same acceptance criteria.
5. **Using non-deterministic seed data.** Every run must start from the same state.
6. **Generating a flat file structure.** The directory structure must match what `dec-bench create` produces.
7. **Hard-coding non-default ports in init scripts and prompts.** Put them in `env.sh` instead so init, agent, and assertions all see the same values.
8. **Pinning tool versions inside a prompt.** Tool versions belong in the harness JSON (`apps/web/data/harnesses/<id>.json`). If you need a different version than the built-in harness provides, add a custom harness — do not instruct the agent to `npm install` at runtime.

## Reference

For the full schema contract, all enum values, `env.sh` and harness JSON schemas, and assertion examples for every gate, see [references/guide.md](references/guide.md).

For a scenario "that looks like mine," browse by shape rather than grepping `scenarios/`:

- **Single-service ClickHouse, greenfield** — `foo-bar-csv-ingest`, `foo-bar-clickhouse-ttl-lifecycle`, `foo-bar-table-layout`
- **Single-service ClickHouse, broken / seeded** — `foo-bar-slow-queries`, `foo-bar-clickhouse-materialized-view`, `foo-bar-clickhouse-historical-backfill`, `foo-bar-clickhouse-live-schema-migration`
- **Single-service Postgres** — `foo-bar-postgres-index-tuning`, `foo-bar-postgres-readiness-race`, `foo-bar-postgres-table-partitioning`
- **Single-service Redpanda** — `foo-bar-stream-schema-evolution`
- **Two-service Redpanda → ClickHouse (stream to OLAP)** — `foo-bar-stream-to-olap`, `foo-bar-dlq-setup`, `foo-bar-consumer-lag-fix`, `foo-bar-topic-misconfiguration`
- **Two-service Postgres + ClickHouse (OLTP + OLAP)** — `foo-bar-idempotent-pipeline`, `foo-bar-consistent-metrics-layer`, `foo-bar-ingest-to-api`, `foo-bar-schema-evolution`
- **Two-service Postgres → Redpanda (CDC)** — `foo-bar-cdc-postgres-to-redpanda`, `foo-bar-event-sourcing-replay`
- **Three-service full pipeline (Postgres → Redpanda → ClickHouse)** — `foo-bar-cross-system-reconciliation`, `foo-bar-full-pipeline-debug`, `foo-bar-realtime-streaming-metrics`
- **Moose dockerless, agent bootstraps its own services** — `foo-bar-moose-csv-ingest`
- **Multi-task (multiple categories in one scenario)** — `ecommerce-pipeline-recovery` (ingestion + debugging + monitoring), `foo-bar-ingest-to-api` (ingestion + materialized-views + schema-design)
- **Custom `env.sh` for non-default ports / credentials** — `foo-bar-moose-csv-ingest`
