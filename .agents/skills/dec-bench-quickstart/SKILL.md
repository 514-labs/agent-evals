---
name: dec-bench-quickstart
description: Validate your DEC Bench setup and run your first scenario. Use when a user says "get started", "first run", "test my setup", or "run a quick benchmark".
---

# DEC Bench Quickstart

Validate the user's setup and run their first benchmark scenario.

## Step 1: Validate setup

Check that everything is in place before running:

1. **Docker**: run `docker info` — if it fails, tell the user to start Docker Desktop
2. **CLI**: run `dec-bench list` — if it fails, tell the user to install with `curl -fsSL https://decbench.ai/install.sh | sh`
3. **Repo**: check that `scenarios/foo-bar-csv-ingest/scenario.json` exists — if not, the user isn't in the repo root
4. **API key**: check that `ANTHROPIC_API_KEY` is set (or `OPENAI_API_KEY` / `CURSOR_API_KEY` depending on which agent they want to use) — if not, ask them to export it

If anything is missing, tell the user exactly what to fix and stop. Don't proceed with a broken setup.

## Step 2: Build and run

Once setup is validated, run the first scenario:

```bash
dec-bench build --scenario foo-bar-csv-ingest
dec-bench run --scenario foo-bar-csv-ingest
```

## Step 3: Show results

```bash
dec-bench results --latest --scenario foo-bar-csv-ingest
```

Explain the output: which gate the agent reached, the normalized score, and where the artifacts are.

## Done

The user has a working setup and their first result. Point them to:
- `dec-bench list` to see all available scenarios
- The `dec-bench-run` skill to run more scenarios
- The `dec-bench-create-scenario` skill to create their own
