# DEC Bench

**Open-source benchmark for evaluating AI agents on real data engineering work.**

DEC Bench tests whether coding agents can build pipelines, optimize queries, fix broken connections, and design schemas against live Postgres, Redpanda, and ClickHouse. Five sequential gates score each run from "it runs" to "you'd ship this."

This is a **research preview** (v0.1). Install the CLI, run a scenario, and tell us what's missing.

## Quick Start

```bash
git clone https://github.com/514-labs/agent-evals.git
cd agent-evals
curl -fsSL https://decbench.ai/install.sh | sh

export ANTHROPIC_API_KEY=your-key-here

dec-bench build --scenario foo-bar-csv-ingest
dec-bench run --scenario foo-bar-csv-ingest
dec-bench results --latest --scenario foo-bar-csv-ingest
```

## What It Does

DEC Bench runs a coding agent inside a Docker container with real databases and a real task. The agent gets a prompt, works through the problem, and the framework evaluates the result through five gates:

1. **Functional** -- it runs
2. **Correct** -- it produces right answers
3. **Robust** -- it handles real-world conditions
4. **Performant** -- it's fast enough
5. **Production** -- you'd ship this

Each gate checks deterministic assertions against the actual database state. No LLM-as-judge. No vibes.

## Agents

Three agents supported out of the box:

| Agent | Provider | API Key |
|-------|----------|---------|
| Claude Code | Anthropic | `ANTHROPIC_API_KEY` |
| Codex | OpenAI | `OPENAI_API_KEY` |
| Cursor | Cursor | `CURSOR_API_KEY` |

```bash
dec-bench build --scenario foo-bar-csv-ingest --agent codex
dec-bench run --scenario foo-bar-csv-ingest --agent codex
```

## Harnesses

Harnesses define the tooling environment. The same scenario across different harnesses measures whether tooling helps agents perform better.

| Harness | Tools | Description |
|---------|-------|-------------|
| **Base RT** | None | Control group. Just the databases. |
| **Classic DE** | Airflow, Spark, dbt | Standard data engineering toolkit. |
| **OLAP for SWE** | MooseStack | Software-engineering-first framework. |

```bash
dec-bench build --scenario foo-bar-csv-ingest --harness classic-de
dec-bench run --scenario foo-bar-csv-ingest --harness classic-de
```

## Scenarios

37 scenarios across ingestion, schema design, query optimization, debugging, pipeline construction, and more. All run against the Foo Bar domain (a SaaS analytics platform).

```bash
dec-bench list
```

## Infrastructure

Real databases, not mocks:

- **Postgres** -- transactional source of truth
- **Redpanda** -- event streaming
- **ClickHouse** -- analytical queries

## Prerequisites

- Git
- Docker (running)
- An API key for your chosen agent

## CLI Commands

| Command | Purpose |
|---------|---------|
| `dec-bench list` | List available scenarios |
| `dec-bench build` | Build the eval image |
| `dec-bench run` | Run the eval |
| `dec-bench results` | View run results |
| `dec-bench audit export` | Create audit bundles |
| `dec-bench audit open` | Open the audit UI in your browser |
| `dec-bench create` | Scaffold a new scenario |
| `dec-bench validate` | Check scenario structure |

## Extend It

**Add an agent:** Create `docker/agents/<your-agent>/run.sh` with the invocation logic.

**Add a harness:** Create `apps/web/data/harnesses/<your-harness>.json` with tools and install script.

**Add a scenario:** Run `dec-bench create --name my-eval --domain ugc --tier tier-1`, then fill in the prompt and assertions.

See the [docs](https://decbench.ai/docs/supported-agents) for full extension guides.

## Agent Skills

Install the DEC Bench skill for your agent:

```bash
npx skills add 514-labs/agent-evals --skill dec-bench-evals -a cursor -a codex -a claude-code
```

## Testing

```bash
cargo test --manifest-path apps/cli/Cargo.toml
pnpm --filter @dec-bench/eval-core test
pnpm --filter web test:data
```

## Contributing

DEC Bench is open source. Contributions welcome: scenarios, harnesses, evaluation logic, docs, and tooling.

## Sponsors

DEC Bench is brought to you by [FiveOneFour](https://fiveonefour.com).

## License

Open source. See [LICENSE](./LICENSE) for details.
