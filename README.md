# DEC Bench

**Data Engineering Competency Bench** is an open-source research preview for evaluating AI agents on real data engineering work.

DEC Bench `0.1` is a research preview. The fastest way to help is to install `dec-bench`, run one Foo Bar scenario locally, and note anything confusing, broken, or missing. If you want to collaborate directly, scaffold a new eval or extend an existing harness.

In this research preview, the `0.1` workflow is CLI-first:

- clone the repo
- install `dec-bench`
- build and run evals
- inspect results from the terminal
- open the localhost audit UI for a specific run
- scaffold and validate a scenario once you are ready to author one

Docker is still the runtime, but the CLI is the product surface.

## Prerequisites

Before your first run, make sure you have:

- Git installed so you can clone the DEC Bench repository
- Docker installed and running locally
- an API key for the agent you plan to use

The default first-run examples use `claude-code`, so export:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

Use `OPENAI_API_KEY` or `CODEX_API_KEY` for Codex, and `CURSOR_API_KEY` for Cursor.

## Install

Clone the repo and change into it before your first build or run:

```bash
git clone https://github.com/514-labs/agent-evals.git
cd agent-evals
```

Then install `dec-bench`:

```bash
curl -fsSL https://decbench.ai/install.sh | sh
```

`https://decbench.ai/install.sh` is the stable public entrypoint served by the Vercel-hosted app. The installer detects OS and architecture, resolves release or preview assets from GitHub releases in `514-labs/agent-evals`, verifies checksums when available, installs `dec-bench`, and prints the next PATH step if needed.

Stay in the repo root for the commands below. The first-run flow uses repo-local scenarios, harness metadata, and Docker build scripts from this checkout.

For local contributor builds:

```bash
cd apps/cli
cargo build
```

## Quick Start

Build the default first-run scenario:

```bash
dec-bench build --scenario foo-bar-csv-ingest
```

Run it:

```bash
dec-bench run --scenario foo-bar-csv-ingest
```

Inspect the latest run:

```bash
dec-bench results --latest --scenario foo-bar-csv-ingest
```

Those commands use the default harness, agent, model, and version: `base-rt`, `claude-code`, `claude-sonnet-4-20250514`, and `v0.1.0`.

`dec-bench run` prints the exact `run_id` at the end of the run, and `dec-bench results --latest` prints `Run ID: ...` at the top of the detailed view.

Open the localhost audit UI for that real run:

```bash
dec-bench audit open \
  --scenario foo-bar-csv-ingest \
  --run-id <run-id-from-results>
```

List scenarios:

```bash
dec-bench list
```

Scaffold a new scenario:

```bash
dec-bench create \
  --name my-first-eval \
  --domain ugc \
  --tier tier-1
```

Validate it before you build:

```bash
dec-bench validate --scenario my-first-eval
```

## What The CLI Does

`dec-bench` now covers the full author loop for `0.1`:

- `dec-bench create` scaffolds a new scenario
- `dec-bench validate` catches missing files and metadata before a Docker build
- `dec-bench build` wraps the layered image build
- `dec-bench run` launches the eval and prints a stable `run_id`
- `dec-bench results` shows run summaries or a single run with artifact paths
- `dec-bench audit export` creates audit bundles for the web UI
- `dec-bench audit open` exports a run, starts or reuses the local web app, and opens the exact audit URL

Built-in agent runner IDs:

- `claude-code`
- `codex`
- `cursor`

## Scoring

DEC Bench uses a gated assertion model with five sequential gates:

1. Functional
2. Correct
3. Robust
4. Performant
5. Production

A run only reaches the next gate after it clears the previous one. Efficiency metrics such as wall-clock time, agent steps, tokens, and API cost act as tiebreakers. They do not inflate the gate score.

## Data Stack

Scenarios run against real infrastructure, not mocks:

| Layer | Technology | Role |
|---|---|---|
| OLTP | Postgres | Transactional source of truth |
| Streaming | Redpanda | Event transport and consumers |
| OLAP | ClickHouse | Analytical storage and query execution |

## Version Policy

`0.1` now uses one version story:

- the CLI crate version is `0.1.0`
- release tags and installable binaries use `v0.1.0`
- the default image suffix for `dec-bench build` and `dec-bench run` is `v0.1.0`
- preview builds use preview tags and install through the same installer with `DEC_BENCH_INSTALL_VERSION=<preview-tag>`

## Advanced Docker Usage

If you need to run an image directly, the tag format is still:

```text
{scenario}.{harness}.{agent}.{model}.{version}
```

Example:

```bash
docker run \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  ghcr.io/514-labs/dec-bench:foo-bar-csv-ingest.base-rt.claude-code.claude-sonnet-4-20250514.v0.1.0
```

Direct Docker usage is supported, but it is now the advanced path.

## Testing

The `0.1` regression path is layered and explicit:

```bash
cargo test --manifest-path apps/cli/Cargo.toml
pnpm --filter @dec-bench/eval-core test
pnpm --filter web test:data
```

CI also smoke-tests the installer against a freshly built Linux archive before preview or release artifacts are treated as ready.

## Contributing

DEC Bench is open source. Contributions are welcome across scenarios, harnesses, evaluation logic, docs, and distribution tooling.

## Agent Skills

Install the `dec-bench-evals` skill from this repository with the `skills` CLI:

```bash
# Discover available skills in this repo
npx skills add 514-labs/agent-evals --list

# Cursor
npx skills add 514-labs/agent-evals --skill dec-bench-evals -a cursor

# Codex
npx skills add 514-labs/agent-evals --skill dec-bench-evals -a codex

# Claude Code
npx skills add 514-labs/agent-evals --skill dec-bench-evals -a claude-code

# Install for all three
npx skills add 514-labs/agent-evals --skill dec-bench-evals -a cursor -a codex -a claude-code

# Install globally instead of at project scope
npx skills add 514-labs/agent-evals --skill dec-bench-evals -a cursor -g
```

For Claude Code, `npx skills add` is the recommended install path because Claude's standalone skill loader does not natively discover `.agents/skills/`. If you are working directly in this repository, the Claude plugin wrapper can also expose the same canonical skill directory.

`skills.sh` is the discovery surface for the broader ecosystem, and this GitHub repository is the canonical source for the skill.

## Sponsors

DEC Bench is brought to you by [FiveOneFour](https://fiveonefour.com). Interested in sponsoring? [Get in touch](https://fiveonefour.com).

## License

Open source. See [LICENSE](./LICENSE) for details.
