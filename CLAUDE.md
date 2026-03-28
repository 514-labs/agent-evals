# DEC Bench

DEC Bench (Data Engineering Coding Benchmark) is 514 Labs' open-source benchmark for evaluating AI coding agents on data engineering tasks -- the first benchmark focused specifically on data engineering, validating agent output against real infrastructure (Postgres, ClickHouse, Redpanda) with realistic scenarios rather than mocks or toy datasets.

## Repo Structure

Monorepo: Rust CLI + TypeScript eval core + Next.js web app.

```
apps/cli/            Rust CLI (dec-bench) -- orchestrates Docker builds, runs, results
apps/web/            Next.js 16 -- marketing site, leaderboard, audit UI
packages/eval-core/  TypeScript assertion runner and gate scoring logic
packages/scenarios/  Scenario registry types
packages/ui/         Shared React components
scenarios/           Scenario directories (prompts, init SQL, assertions)
docker/              Base image, harness configs, agent entry scripts
results/             Run output and audit bundles
```

Build tools: pnpm 10.4.1 (JS), Cargo (Rust), turbo (orchestration).

## Evaluation Design

Four independent variables, two dependent variables.

**Independent (what you vary):**

1. **Agent** -- the AI coding agent runner (Claude Code, Codex, Cursor). Each runner can use different underlying models (e.g. Claude Sonnet 4.6, Claude Opus 4.6, GPT-5.4).
2. **Harness** -- the tooling environment:
   - **Base RT** (control): Postgres + Redpanda + ClickHouse + Python/Node/CLIs
   - **Classic DE**: + dbt, Airflow, Spark
   - **OLAP for SWE**: + MooseStack (typed schemas, auto migrations, MCP)
3. **Scenario** -- data engineering tasks in the "Foo Bar" synthetic SaaS domain (37 in v0.1, growing). Foo Bar is synthetic by design -- isolates data engineering competency from business-domain knowledge and data contamination risk.
4. **Persona** -- each scenario has two prompts:
   - **Naive** (`prompts/naive.md`): minimal context, first-principles problem statement
   - **Savvy** (`prompts/savvy.md`): expert-level prompt with domain knowledge

**Dependent (what you measure):**

1. **Quality** -- gate scores (G1-G5) and gate attrition curves
2. **Efficiency** -- wall time, token usage, cost

Agent x Harness x Scenario x Persona evaluation matrix. The harness variable directly measures whether specialized tooling helps agents perform better vs bare infrastructure or traditional DE stacks. The persona variable measures whether domain expertise in the prompt changes where agents fall off.

**Mode B (Plan vs Execute)** is a planned orthogonal evaluation mode where the agent plans first, then implements. Under development.

## Five-Gate Scoring

Sequential, strictly ordered gates. Failure blocks higher gates. All assertions are deterministic (database queries + code inspection, no LLM-as-judge).

1. **G1 Functional** -- it runs without errors
2. **G2 Correct** -- produces expected output
3. **G3 Robust** -- handles edge cases and errors
4. **G4 Performant** -- meets latency/throughput targets
5. **G5 Production** -- code quality fit for release

Each gate has two layers of assertions: **core** assertions (defined by the eval framework, apply to all scenarios) and **scenario-specific** assertions (written by the scenario author).

## Competitive Context

DEC Bench is complementary to, not competing with, adjacent benchmarks:
- **SWE-bench** -- resolving real GitHub issues in software repos
- **DS-1000** -- library-centric data science code generation
- **BigCodeBench** -- harder function-level code generation

DEC Bench answers a narrower question: can an agent do end-to-end data engineering work on real infrastructure?

## Scenario Anatomy

Each scenario in `scenarios/<id>/` contains:

```
scenario.json            Metadata (title, description, harness, tags)
prompts/naive.md         Minimal prompt
prompts/savvy.md         Advanced prompt
init/                    SQL/setup scripts
assertions/              Gate functions (functional.ts, correct.ts, robust.ts, etc.)
supervisord.conf         Process management
```

## How a Run Works

1. `dec-bench build --scenario X --harness Y` -- layered Dockerfile, builds image
2. `dec-bench run --scenario X` -- launches container, starts infra, runs agent
3. eval-core runs assertions inside container, produces `EvalOutput` JSON
4. `dec-bench results --latest` -- parses and displays results

Each run gets its own Docker container with fresh Postgres/ClickHouse/Redpanda. Zero state pollution, fully reproducible.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `dec-bench list` | Show all scenarios |
| `dec-bench build` | Build eval Docker image |
| `dec-bench run` | Start eval container |
| `dec-bench results` | Display run results |
| `dec-bench create` | Scaffold new scenario |
| `dec-bench validate` | Check scenario structure |
| `dec-bench audit` | Export/open audit bundles |
| `dec-bench registry` | Manage scenario/harness registry |

## Project Status

- **Linear project**: [Harness Evaluations 0.1](https://linear.app/514/project/harness-evaluations-01-4a512e73e943/overview)
- **Lead**: Tim Delisle
- **Status**: In Progress -- Research Preview launch (v0.1)
- **Current milestone**: Research Preview Launch (68% as of 2026-03-24)

## Linear Project Links

- [Bench Architecture](https://linear.app/514/document/dec-bench-architecture-696ed121eb3c)
- [Initial Benchmark Results](https://linear.app/514/document/initial-benchmark-results-cd25acaa9cd1)
- [HN Post Draft](https://linear.app/514/document/hn-post-draft-97751979d289)
- [Competitive Positioning](https://linear.app/514/document/competitive-positioning-65e59746d0f5)
- [Launch Checklist](https://linear.app/514/document/launch-checklist-and-post-launch-plan-e894406c1511)
- [Channel Distribution Copy](https://linear.app/514/document/channel-distribution-copy-bf58edac59f9)
- [FAQ and Talking Points](https://linear.app/514/document/faq-and-talking-points-c8eb820edb4b)
- [Pre-Launch Seeding Plan](https://linear.app/514/document/pre-launch-seeding-plan-b5fbbce40443)
- [Launch Success Metrics](https://linear.app/514/document/launch-success-metrics-2034e3865442)
