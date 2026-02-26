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
  ghcr.io/514-labs/dec-bench:ecommerce-pipeline.dbt.claude-code.sonnet-4.v1.0.0
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

### Install & Run

```bash
pnpm install
pnpm dev
```

The web app (docs + leaderboard) runs at `http://localhost:3000`.

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
