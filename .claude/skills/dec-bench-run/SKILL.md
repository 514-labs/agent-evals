---
name: dec-bench-run
description: Build and run DEC Bench scenarios, inspect results, and open the audit UI. Use when a user says "run scenario", "run eval", "benchmark", "run foo-bar-*", "run matrix", "compare agents", or asks about specific scenario results.
---

# DEC Bench Run

Build and run existing DEC Bench scenarios. This skill covers running scenarios, not creating them — for that, use `dec-bench-create-scenario`.

## Before you start

Confirm the user has:
- DEC Bench CLI installed (`dec-bench list` to verify)
- A local clone of the repo
- Docker running
- The right API key exported for their agent

If any of these are missing, point them to the `dec-bench-quickstart` skill.

## List available scenarios

```bash
dec-bench list
```

This shows all scenarios with their tier, domain, and description.

## Key values

**Agents and models:**
- `claude-code`: `claude-sonnet-4-20250514`, `claude-sonnet-4-6`, `claude-opus-4-6`
- `codex`: `gpt-5.4`
- `cursor`: `composer-2`

**Personas:** `baseline` (plain language, no hints) or `informed` (specific tools, schemas, constraints)

**Harnesses:** `base-rt`, `classic-de`, `olap-for-swe`

## Run a single scenario

```bash
dec-bench build --scenario <scenario-id>
dec-bench run --scenario <scenario-id>
```

The CLI validates the agent, model, and API key before building. If validation fails, it tells the user what to fix.

### Specify agent and model

```bash
dec-bench build --scenario <scenario-id> --agent codex --model gpt-5.4
dec-bench run --scenario <scenario-id> --agent codex --model gpt-5.4
```

Defaults: `--agent claude-code --model claude-sonnet-4-20250514`

### Specify harness

```bash
dec-bench build --scenario <scenario-id> --harness classic-de
dec-bench run --scenario <scenario-id> --harness classic-de
```

Default: `--harness base-rt`

## Inspect results

```bash
dec-bench results --latest --scenario <scenario-id>
dec-bench results --run-id <run-id>
```

This prints gate scores, normalized score, and paths to all artifacts (stdout, trace, assertion log, session JSONL).

## Open the audit UI

```bash
dec-bench audit open --scenario <scenario-id> --run-id <run-id>
```

Opens a local web UI with agent traces, assertion results, and run metadata.

## Run the full matrix

Run all agent/harness/persona combinations:

```bash
dec-bench run --matrix --parallel auto
```

This validates all agent/model/key combos upfront before any Docker work.

For `--parallel > 1`, supply multiple provider keys via the plural env vars
so each container gets its own key:

```bash
export ANTHROPIC_API_KEYS=sk-ant-key1,sk-ant-key2
dec-bench run --matrix --parallel 2
```

With only the singular `*_API_KEY` set, the CLI warns and proceeds — expect
rate-limit errors from the provider.

## Common issues

- **Build fails with Docker error**: start Docker Desktop and retry
- **API key invalid**: the CLI checks keys against provider APIs — verify the key is correct and not expired
- **Wrong agent/model combo**: the CLI rejects incompatible pairs (e.g. `--agent codex --model claude-sonnet-4-6`)
- **Anthropic/OpenAI rate limits during a parallel matrix run**: set the plural env var (e.g. `ANTHROPIC_API_KEYS=key1,key2`) so the CLI rotates keys across containers
