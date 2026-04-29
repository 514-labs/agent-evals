# Examples

Worked scenarios you can read or run. Each link points into [`scenarios/`](../scenarios), which is the canonical location for evaluation tasks.

If you have not installed the CLI yet, see [`AGENTS.md`](../AGENTS.md) for the first-run guide.

## How a scenario works

A scenario is a single data engineering task. Each scenario declares the harnesses it runs against in `scenario.json`. The whole point of the harness dimension is to compare: same task, same assertions, different tooling. The output tells you whether a given toolchain helps the agent reach a higher gate or finish faster.

```
1 scenario × N harnesses × 2 personas = 2N evaluations.
```

See [`AGENTS.md`](../AGENTS.md) for the full object model.

## Start here

[`scenarios/foo-bar-csv-ingest/`](../scenarios/foo-bar-csv-ingest) loads five messy CSVs into clean ClickHouse tables. It runs on four harnesses (`base-rt`, `olap-for-swe`, `moose-initialized`, `tinybird-forward`) so you can see the same task scored across each.

```bash
dec-bench build --scenario foo-bar-csv-ingest
dec-bench run --scenario foo-bar-csv-ingest                              # default harness
dec-bench run --scenario foo-bar-csv-ingest --harness olap-for-swe        # same task, different toolchain
dec-bench results --latest --scenario foo-bar-csv-ingest
```

Compare the scores across harness runs to see how much tooling moved the agent.

## Run the full matrix

To evaluate every scenario against every supported harness, agent, and persona in one go:

```bash
dec-bench run --matrix --parallel auto
```

This is the canonical way to produce the leaderboard data.

## Worked scenarios with rich harness coverage

| Scenario | Harnesses | What it covers |
|----------|-----------|----------------|
| [`foo-bar-csv-ingest`](../scenarios/foo-bar-csv-ingest) | `base-rt`, `olap-for-swe`, `moose-initialized`, `tinybird-forward` | Messy CSV ingestion across four toolchains. |
| [`foo-bar-full-olap-pipeline`](../scenarios/foo-bar-full-olap-pipeline) | same four | End-to-end OLAP pipeline with all gates exercised. |
| [`foo-bar-stream-to-olap`](../scenarios/foo-bar-stream-to-olap) | `classic-de`, `olap-for-swe` | Streaming ingestion: dbt/Airflow/Spark vs MooseStack. |
| [`ecommerce-pipeline-recovery`](../scenarios/ecommerce-pipeline-recovery) | `classic-de`, `olap-for-swe` | Recovering a broken e-commerce pipeline under both toolchains. |

Run `dec-bench list` for the full catalog. `scenario.json` in each folder declares the supported harnesses.

## Build your own

The [`dec-bench-create-scenario`](../.agents/skills/dec-bench-create-scenario/SKILL.md) skill walks an agent through scaffolding a new scenario end to end, including how prompts and init files differ per harness. Open the repo with Claude Code, Cursor, or Codex and ask "create a scenario for X".
