# DEC Bench

**Data Engineering Competency Bench** — an open-source benchmark for evaluating AI agent competency on real-world data engineering tasks and workloads.

## What is DEC Bench?

DEC Bench measures how well AI agents perform actual data engineering work — not toy SQL puzzles, but realistic scenarios drawn from production domains. Agents are evaluated against a real infrastructure stack and scored on a formula that rewards correctness first, then optimizes for speed, cost, quality, and efficiency.

## Running Evals

Each benchmark run is a single `docker run` command. No setup, no config files, no cloud accounts. 
The image tag encodes exactly what is being evaluated: **scenario × harness × agent × model**.

```bash
docker run \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e OPENAI_API_KEY=sk-... \
  -e CURSOR_API_KEY=cur-... \
  ghcr.io/514-labs/dec-bench:ecommerce-pipeline.classic-de.claude-code.sonnet-4.v1.0.0
```

Output is a JSON payload on stdout containing the score, efficiency metrics, and a path to the session log.

## Scoring

Scoring uses a **gated assertion model** with five sequential gates representing increasing levels of production readiness.

1. **Functional** — "It runs"
2. **Correct** — "It produces right answers"
3. **Robust** — "It handles real-world conditions"
4. **Performant** — "It's fast enough"
5. **Production** — "You'd ship this"

A gate passes when all core assertions (universal) and scenario-specific assertions for that gate pass. Efficiency metrics (wall clock time, agent steps, tokens, API cost) are tracked separately as tiebreakers and never inflate the gate-based score.

## Scenarios

### Internal Analytics & Data Warehousing

| Domain            | Example Data                                          | Characteristic Challenges                                    |
|-------------------|-------------------------------------------------------|--------------------------------------------------------------|
| Foo Bar (Dummy)   | Synthetic tables, generated events, placeholder metrics | Dummy data for testing eval scaffolding and pipeline wiring  |
| B2B SaaS          | Product usage events, subscription lifecycle          | High-cardinality user/account dimensions, event versioning   |
| B2C SaaS          | User activity streams, content interactions           | Massive event volumes, time-series heavy, retention queries  |
| UGC               | Posts, comments, reactions, moderation signals         | Variable schema (JSON-heavy), content search + analytics     |
| E-Commerce        | Orders, inventory, catalog, customer behavior         | Transactional correctness critical, complex JOINs            |
| Advertising       | Impressions, clicks, conversions, bid data            | Extreme write throughput, real-time aggregation              |
| Consumption Infra | API calls, compute usage, storage metering            | Billing accuracy critical, high-cardinality metering keys    |

### User-Facing Analytics

| Feature          | What the agent needs to build / optimize                                          |
|------------------|-----------------------------------------------------------------------------------|
| Dashboards       | Pre-aggregated models, sub-second query latency, concurrent access                |
| Exported Reports | Batch query optimization, large result sets, scheduling                           |
| Feeds            | Real-time materialized views, incremental updates, personalization queries        |
| Analytical Chat  | Ad-hoc query generation, EXPLAIN-based optimization, natural language → SQL       |

## Agent Modes

Agents are tested across two dimensions:

- **Persona** — *Naive vs Savvy*: Agents are given varying levels of data engineering expertise to measure adaptability across knowledge levels.
- **Strategy** — *Plan vs Execute*: Compare agents that think before acting (strategic planners) against those that execute directly.

## Data Stack

Every scenario runs against real infrastructure, not mocks:

| Layer     | Technology  | Role                                                                      |
|-----------|-------------|---------------------------------------------------------------------------|
| OLTP      | Postgres    | Transactional source of truth — schema migrations, referential integrity  |
| Streaming | Redpanda    | High-throughput event streaming — topic management, consumer groups        |
| OLAP      | ClickHouse  | Columnar analytics — materialized views, real-time aggregation            |

More stacks coming soon (MySQL, DuckDB, Kafka, Snowflake, BigQuery). Contributions welcome.

## Getting Started

### Prerequisites

- Node.js >= 20
- [pnpm](https://pnpm.io/) 10.4+
- Docker
- Rust toolchain (for `apps/cli`)

### Install & Run

```bash
pnpm install
pnpm dev
```

The web app (docs + leaderboard) runs at `http://localhost:3000`.

## CLI Workflow (Local Evals)

The CLI now supports scenario scaffolding, running eval containers, listing scenarios, and reading stored results.

Built-in agent runner IDs:

- `claude-code`
- `codex`
- `cursor`

### Build CLI

```bash
cd apps/cli
cargo build
```

### Scaffold a Scenario

```bash
dec-bench create \
  --name my-first-eval \
  --domain ugc \
  --tier tier-1
```

This creates:

- `scenario.json`
- `prompts/naive.md` and `prompts/savvy.md`
- `init/` seed scripts
- `assertions/` files for all five gates
- `supervisord.conf`

### Build a Local Eval Image

Use the layered build helper:

```bash
./docker/build.sh \
  --scenario ecommerce-pipeline-recovery \
  --harness classic-de \
  --agent claude-code \
  --model claude-sonnet-4-20250514 \
  --version v1.0.0
```

This builds:

1. base image (`docker/base/Dockerfile`)
2. scenario layer (`docker/scenario/Dockerfile`)
3. harness layer (`docker/harness/Dockerfile`)
4. agent layer (`docker/agent/Dockerfile`)

### Run an Eval via CLI

```bash
dec-bench run \
  --scenario ecommerce-pipeline-recovery \
  --harness classic-de \
  --persona naive \
  --mode no-plan
```

- Streams container logs
- Extracts structured JSON result
- Writes output to `results/<scenario>-<timestamp>.json`

Run the full matrix with CLI-managed parallelism:

```bash
dec-bench run --matrix --parallel 9
# or let the CLI choose based on host parallelism
dec-bench run --matrix --parallel auto
```

- `--parallel 1` runs sequentially (default)
- `--parallel auto` uses host available parallelism
- higher values run multiple scenario/persona/mode jobs concurrently

### View Results

```bash
dec-bench results --format table
dec-bench results --format json
dec-bench results --format csv
```

Filter by scenario:

```bash
dec-bench results --scenario ecommerce-pipeline-recovery --format json
```

### Reference Scenario

A complete reference implementation is included at:

- `scenarios/ecommerce-pipeline-recovery/`

It contains prompts, seed SQL, service config, and gate assertions.

## Testing

### Workspace checks

```bash
pnpm --filter @dec-bench/eval-core check-types
pnpm --filter @dec-bench/scenarios check-types
```

### CLI checks and tests

```bash
cd apps/cli
cargo check
cargo test
```

The CLI test suite includes:

- Unit tests for command internals
- Integration tests for multi-command flows
- End-to-end command tests against the built binary

### Project Structure

```
├── apps/
│   └── web/              # Next.js app (landing page, docs, leaderboard)
├── packages/
│   ├── ui/               # Shared UI components (shadcn/ui)
│   ├── eval-core/        # Core evaluation logic
│   ├── scenarios/         # Scenario definitions
│   ├── eslint-config/    # Shared ESLint config
│   └── typescript-config/ # Shared TypeScript config
```

## Contributing

DEC Bench is open source. We welcome contributions — new scenarios, additional data stack support, evaluation improvements, and more.

## Sponsors

DEC Bench is brought to you by [FiveOneFour](https://fiveonefour.com). Interested in sponsoring? [Get in touch](https://fiveonefour.com).

## License

Open source. See [LICENSE](./LICENSE) for details.
