---
name: dec-bench-quickstart
description: Get set up with DEC Bench from scratch — install the CLI, clone the repo, build and run your first scenario, and inspect results. Use when a user says "get started", "set up", "install dec-bench", "quickstart", or "first run".
---

# DEC Bench Quickstart

Walk the user through their first DEC Bench run from zero. This skill handles setup only — not scenario authoring or advanced usage.

## Before you start

Confirm the user has:
- Docker installed and running
- An API key for the agent they want to test (default: `ANTHROPIC_API_KEY` for Claude Code)

If Docker is not running, tell them to start Docker Desktop and retry. If they don't have an API key, point them to:
- Anthropic: https://console.anthropic.com/
- OpenAI: https://platform.openai.com/api-keys
- Cursor: https://cursor.com/settings

## Steps

### 1. Install the CLI

```bash
curl -fsSL https://decbench.ai/install.sh | sh
```

Verify it works:

```bash
dec-bench list
```

`dec-bench list` works without Docker or API keys. If this fails, the install didn't work.

### 2. Clone the repo

```bash
git clone https://github.com/514-labs/agent-evals.git
cd agent-evals
pnpm install
```

The CLI needs a local checkout for scenario definitions and build scripts.

### 3. Export the API key

```bash
export ANTHROPIC_API_KEY=<their-key>
```

Swap for `OPENAI_API_KEY` or `CURSOR_API_KEY` if using a different agent.

### 4. Build and run a scenario

Start with `foo-bar-csv-ingest` — it's a fast tier-1 scenario.

```bash
dec-bench build --scenario foo-bar-csv-ingest
dec-bench run --scenario foo-bar-csv-ingest
```

### 5. Inspect results

```bash
dec-bench results --latest --scenario foo-bar-csv-ingest
```

To open the visual audit UI:

```bash
dec-bench audit open --scenario foo-bar-csv-ingest --run-id <run-id>
```

The run ID is printed at the end of `dec-bench run`.

## Done

The user has a working DEC Bench setup. From here they can:
- Run more scenarios: use the `dec-bench-run` skill
- Create their own scenarios: use the `dec-bench-create-scenario` skill
