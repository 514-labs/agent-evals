# DEC Bench

An open benchmark for evaluating AI coding agents on data engineering tasks across five sequential quality gates.

DEC Bench extends evaluation beyond functional correctness — a pipeline that runs is necessary but insufficient. The benchmark measures correctness, robustness, performance, and production readiness as distinct, ordered dimensions. Gates are sequential: a correct-but-fragile implementation does not score as robust.

Version 0.1 includes 37 scenarios evaluated against Postgres, Redpanda, and ClickHouse. All evaluation runs execute in identical containerized environments.

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

Open the repo in Claude Code, Cursor, or Codex and the DEC Bench agent skills auto-load. Ask "get me started" and your agent will walk you through the steps above. See [`AGENTS.md`](./AGENTS.md) for the full first-run guide and [`examples/`](./examples) for a tour of the worked scenarios.

## The Five-Gate Model

Each evaluation run is scored against five sequential quality gates:

1. **Functional** — output executes without errors
2. **Correct** — produces expected results on all test cases
3. **Robust** — handles errors and boundary conditions
4. **Performant** — meets latency and throughput targets
5. **Production** — code quality and safety fit for release

Each gate must pass before the next is evaluated. Assertions are deterministic — no LLM-as-judge.

## Agents

Three agents supported in v0.1:

| Agent | Provider | API Key Variable |
|-------|----------|-----------------|
| Claude Code | Anthropic | `ANTHROPIC_API_KEY` |
| Codex | OpenAI | `OPENAI_API_KEY` |
| Cursor | Cursor | `CURSOR_API_KEY` |

```bash
dec-bench build --scenario foo-bar-csv-ingest --agent codex
dec-bench run --scenario foo-bar-csv-ingest --agent codex
```

## Evaluation Harnesses

The harness determines the tooling environment available to the agent during evaluation. The same scenario across different harnesses measures whether tooling improves agent performance.

| Harness | Scaffolding | Measures |
|---------|-------------|----------|
| `bare` | None — databases and CLIs only | First-principles reasoning |
| `classic-de` | dbt, Airflow, Spark | Applied competency with standard tooling |
| `olap-for-swe` | MooseStack | Code-first OLAP framework leverage |

```bash
dec-bench build --scenario foo-bar-csv-ingest --harness classic-de
dec-bench run --scenario foo-bar-csv-ingest --harness classic-de
```

## Scenarios

48 scenarios in the preview today, including 36 Foo Bar scenarios plus additional domain coverage across advertising, B2B SaaS, B2C SaaS, e-commerce, infra, and UGC.

```bash
dec-bench list
```

A scenario is a matrix, not a single run: `1 scenario × N harnesses × 2 personas = 2N evaluations`. Each (scenario, harness) pair owns its own prompts and may carry its own seed data; `scenario.json`, root `init/`, `assertions/`, and `supervisord.conf` are shared across harnesses.

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

See [`AGENTS.md`](./AGENTS.md#scenario-object-model-read-this-before-touching-scenarios) for why prompts and init can differ per harness.

## Infrastructure

Every scenario runs against real databases, not mocks:

| Component | Role |
|-----------|------|
| **Postgres** | Transactional source of truth — schema migrations, referential integrity |
| **Redpanda** | High-throughput event streaming — topic management, consumer groups |
| **ClickHouse** | Columnar analytics — materialized views, real-time aggregation |

## Prerequisites

- Git
- Docker (running)
- An API key for your chosen agent

`dec-bench list` is the fastest install smoke test and does not require Docker or an API key. `build` and `run` do.

## CLI Reference

| Command | Purpose |
|---------|---------|
| `dec-bench list` | List available scenarios |
| `dec-bench build` | Build the evaluation image |
| `dec-bench run` | Run the evaluation |
| `dec-bench results` | View run results |
| `dec-bench audit export` | Create audit bundles |
| `dec-bench audit open` | Open the audit interface |
| `dec-bench create` | Scaffold a new scenario |
| `dec-bench validate` | Validate scenario structure |

## Extending the Benchmark

**Add an agent:** Create `docker/agents/<agent>/run.sh` with the invocation logic.

**Add a harness:** Create `apps/web/data/harnesses/<harness>.json` with tools and install script.

**Add a scenario:** `dec-bench create --name my-eval --domain ugc --tier tier-1`, then define the prompt and assertions. Open the repo in Claude Code, Cursor, or Codex and the `dec-bench-create-scenario` skill walks through the rest. Worked scenarios live in [`examples/`](./examples).

## Agent Skills

Skills are checked into the repo at [`.claude/skills/`](./.claude/skills) and [`.agents/skills/`](./.agents/skills) and auto-load when you open the repo with Claude Code, Cursor, or Codex. No install step.

| Skill | When it fires |
|-------|---------------|
| `dec-bench-quickstart` | "get started", "install", "first run" |
| `dec-bench-run` | "run scenario", "benchmark", "compare agents" |
| `dec-bench-create-scenario` | "create scenario", "add eval", "write a benchmark for" |
| `dec-bench-local-override` | "test a local moose-cli / ClickHouse / skill build before release" |

`dec-bench-local-override` guides contributors through substituting a locally-built artifact (moose-cli, moose-lib, ClickHouse, a Claude skill, etc.) into a scenario image to test changes before a release.

The canonical source for skill content is [`.claude/skills/`](./.claude/skills) (Claude Code's docs-sanctioned discovery path). The `.agents/skills/dec-bench-*` entries are symlinks back into it, so the `npx skills add 514-labs/agent-evals` external install path keeps working without a separate copy.

## Testing

```bash
cargo test --manifest-path apps/cli/Cargo.toml
pnpm --filter @dec-bench/eval-core test
pnpm --filter web test:data
```

## Contributing

We welcome contributions across scenarios, harnesses, evaluation logic, documentation, and tooling. Contributions should meet the quality criteria described in the [contributor guidelines](https://decbench.ai/docs).

## License

Open source under MIT. See [LICENSE](./LICENSE).

---

DEC Bench is an open research effort by [514 Labs](https://fiveonefour.com).
