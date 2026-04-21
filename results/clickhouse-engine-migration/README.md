# ClickHouse Engine Migration — 4-way comparison

Result artifacts for Linear [514-1249](https://linear.app/514/issue/514-1249), measuring the impact of MooseStack's delta-based migrations ("DR") work on AI coding agents.

## Scenario

`foo-bar-clickhouse-engine-migration` asks the agent to migrate a populated ClickHouse `analytics.events` table from `MergeTree ORDER BY (event_id)` to `ReplacingMergeTree(updated_at) ORDER BY (user_id, event_id)`, preserving all 50,000 historical rows so that `SELECT count() FINAL` returns the unique-key count (42,500) with the latest `updated_at` winning per key.

See `scenarios/foo-bar-clickhouse-engine-migration/` for the full scenario definition.

## Run matrix

Four configurations, one run each, agent: `claude-code` / `claude-sonnet-4-20250514`:

| # | Harness | Persona | What it measures |
|---|---|---|---|
| 1 | `moose-post-dr` | `moose-user` | Moose 0.6.520 with `migrate_with_deltas = true` (DR) |
| 2 | `moose-pre-dr` | `moose-user` | Moose 0.6.503 (legacy `plan.yaml` flow, pre-DR) |
| 3 | `base-rt` | `informed` | ClickHouse CLI with explicit task spec |
| 4 | `base-rt` | `baseline` | No tooling guidance (control) |

## Results

| Config | Highest gate | Normalized | Correct | Robust | Perf | Prod | Wall | Cost | Steps |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `base-rt` / baseline | 2 | 0.533 | 6/6 ✅ | sce 2/2, idempotent ✗ | — | — | 171s | $0.62 | 46 |
| `base-rt` / informed | **4** | **0.987** | 5/6 (lost rows) | ✅ | ✅ | 2/3 (no README) | 159s | $0.40 | 34 |
| `moose-pre-dr` / moose-user | **0** | **0.150** | — | — | — | — | **350s** | **$1.29** | **101** |
| `moose-post-dr` / moose-user | **4** | **0.987** | 5/6 (lost rows) | ✅ | ✅ | 2/3 (no README) | 185s | $0.57 | 50 |

## Headline findings

1. **`moose-pre-dr` catastrophically failed.** The agent's legacy-`plan.yaml` workflow ended with the `events` table empty — `target_table_has_rows` failed. It took the most steps (101), longest wall-clock (5.8 min), and most expensive ($1.29) path to arrive at the worst outcome.
2. **`moose-post-dr` succeeded** to gate 4 (normalized 0.987). The DR delta-file workflow produced a correct, idempotent, robust migration — though it lost some rows during recreate.
3. **`base-rt` / informed tied with `moose-post-dr`** on all gates and actually ran faster (159s vs 185s) and cheaper ($0.40 vs $0.57). The ClickHouse-CLI path is competitive when the agent has explicit task specification.
4. **`base-rt` / baseline** (vague, tool-agnostic prompt) got **6/6 correct** — the *only* run that preserved all 50,000 rows — but its migration wasn't idempotent, so it failed the robust gate's `idempotent_rerun` core assertion and didn't advance.
5. **Production gate:** every run passed all 12 core assertions (no secrets, no debug artifacts, zero compiler errors, type safety, etc.) and 2 of 3 scenario-specific production assertions; the universal miss was `has_readme_or_docs` — no agent wrote a README.

## Caveats

- **Single-run variance.** Agent behavior is stochastic; a single run per config is insufficient to characterize a harness. Earlier preliminary runs (before the `handles_new_duplicates` assertion fix in commit `8aa14a3`) showed moose-post-dr getting 6/6 correct where this rerun got 5/6. Multi-run averages would be needed for statistical claims.
- **`handles_new_duplicates` assertion had a bug** in the initial implementation — it used `ctx.clickhouse.query()` for INSERT which appends `FORMAT JSONEachRow` and breaks INSERT VALUES parsing. Fixed in commit `8aa14a3` (`.query()` → `.command()`) before these runs.
- **Ports/CLI flags.** The common init script originally used `clickhouse-client --url` (not supported in the base image's CH version); fixed in commit `7c42a2b` to use `--host` + `--port 9000` matching the entrypoint's own `.sql` handler.

## Artifact inventory

Per run, the standard DEC Bench artifact set:

- `*.json` — main result (gate pass/fail, scores, efficiency metrics, persona metadata)
- `*.run-meta.json` — run metadata
- `*.agent-raw.json` — agent-reported tokens/cost
- `*.assertion-log.json` — per-assertion pass/fail with messages and details
- `*.session.jsonl` — full agent conversation log
- `*.trace.json` — tool-call trace
- `*.stdout` / `*.stderr` — agent stdout/stderr
- `*.infra.stdout` — init script output (seed confirmation)
- `*.service-logs.json` — ClickHouse service logs
