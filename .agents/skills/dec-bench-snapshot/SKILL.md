---
name: dec-bench-snapshot
description: Capture a DEC Bench (AXP) comparison run set as a Linear snapshot — parent index issue + Document + labeled follow-up sub-issues. Use when a user says "snapshot the results", "publish this comparison to Linear", "create a snapshot from these runs", "document the latest matrix", or after running a multi-cell harness comparison and asking "now what".
---

# DEC Bench Snapshot

Turn a completed DEC Bench (externally branded **AXP**) comparison run set into durable Linear context: one parent index issue, one Linear Document with the matrix + narrative, plus labeled sub-issues for follow-up work.

**Why this exists**: results that live only as JSONL files in `results/` or as one-off Slack pastes vanish from team memory. A Linear snapshot is the queryable layer — future agents and humans search for `axp-snapshot:<date>` or `harness:tinybird-forward AND parity-gap` and find both the narrative and the work that follows.

## Naming note

- The repo uses **DEC Bench / `dec-bench`** in code, CLI, paths, README.
- Linear surfaces, GCS research uploads (going forward), and external comms use **AXP**.
- This skill writes Linear with AXP names. Keep `dec-bench` references when pointing at code (`docker/build.sh`, the CLI, scenario directory paths).

## When to use

Trigger phrases:
- "snapshot the results"
- "publish this comparison to Linear"
- "create a snapshot for [date / topic]"
- "document the latest matrix"
- After completing 2+ cells (scenario × harness × persona) the user wants to share

Do NOT use this skill for:
- A single ad-hoc run — too noisy for Linear
- In-progress experiments — wait until the run set is complete
- Surfacing per-assertion debugging — use the audit UI

## Linear workspace context

**Team**: Evals (id `19a93931-9c0e-4767-ac84-fe5be118175c`).
**Related projects on Fiveonefour team**:
- "AXP 0.1 Research Preview" — productizing dec-bench → AXP
- "Prove AXP can improve a product: 10x Moose & Boreal in 2 Weeks" — AXP feedback loop work

The snapshot Document and parent issue go in **Evals** unless the user redirects.

## Pre-built label taxonomy

All labels are scoped to the Evals team. Apply them generously — they are the search surface.

### Parent groups (apply children, not parents)

| Group | Children pattern | Example |
|---|---|---|
| `harness` | `harness:<id>` | `harness:tinybird-forward` |
| `scenario` | `scenario:<short-id>` | `scenario:ingest-to-api` (drop the `foo-bar-` prefix) |
| `axp-snapshot` | `axp-snapshot:<YYYY-MM-DD>` | `axp-snapshot:2026-04-27` |

### Available children

**Harness**: `harness:base-rt`, `harness:olap-for-swe`, `harness:tinybird-forward`, `harness:moose-delta-migrations`, `harness:moose-legacy-migrations`, `harness:atlas-clickhouse`, `harness:classic-de`. Add new children when adding a harness.

**Scenario**: `scenario:mv-access-patterns`, `scenario:create-analytics-table`, `scenario:csv-ingest`, `scenario:ingest-to-api`, `scenario:full-olap-pipeline`, `scenario:clickhouse-destructive-migration`. Add new children when porting harnesses to additional scenarios. Drop the `foo-bar-` prefix in the label name.

**Snapshot dates**: create one new `axp-snapshot:<YYYY-MM-DD>` per new snapshot before creating the parent issue.

### Standalone type labels (apply to issues, not the parent)

- `axp-snapshot-index` — exactly one parent index issue per snapshot wears this. Helps `list_issues` find all snapshots.
- `parity-gap` — a real capability difference (e.g. Tinybird has no Postgres CDC). Not a code bug.
- `scoring-bias` — assertion or scoring code unfairly favors/penalizes a harness. Code bug.
- `variance-investigation` — run-to-run agent variance is suspected; needs more samples or RCA.
- `harness-port` — work to add an existing harness to a scenario it doesn't yet support.

## Step 1: Gather inputs from the user / environment

Before creating anything:

1. **Snapshot date** (defaults to today, ISO `YYYY-MM-DD`)
2. **Run-set scope**: which scenarios × harnesses × personas. Get this from the latest `results/*.json` files for runs in scope.
3. **Latest-code cutoff** per scenario — the timestamp earlier than which assertion code differs (if you've been changing helpers). Filter runs accordingly so the matrix is apples-to-apples.
4. **GCS tarball URL** — if traces are packaged + uploaded, capture the URL. If not, offer to package + upload via the existing `gsutil cp` pattern (see Step 5).

Verify each run actually exercised its declared harness (defense against false-positive scoring): grep `*.session.jsonl` for harness-specific tool calls (`tb --local`, `moose dev`, `clickhouse-client`) and confirm the harness label aligns with what the agent actually invoked.

## Step 2: Aggregate the matrix

For each (scenario, harness, persona) cell, take the most recent run within the latest-code window. Capture per cell:

- score, gate, wall-clock, cost, tokens
- tools used (from session.jsonl grep)
- date

Render as a Unicode-bordered table. The canonical format:

```
┌────────────────────────┬──────────────────┬──────────┬───────┬──────┬───────┬─────────┬────────┬──────────────┬───────┐
│        scenario        │     harness      │  person  │ scor  │ gat  │ wall  │  cost   │ token  │    tools     │ date  │
│                        │                  │    a     │   e   │  e   │       │         │   s    │     used     │       │
├────────────────────────┼──────────────────┼──────────┼───────┼──────┼───────┼─────────┼────────┼──────────────┼───────┤
```

Column widths: 24, 18, 10, 7, 6, 7, 9, 8, 14, 7. Header text wrapped per the example. Numeric columns right-aligned.

A reference renderer script (Node, no deps) lives in this skill at `references/render-matrix.js`.

## Step 3: Create the parent index issue

In the **Evals** team. Title: `[AXP Snapshot] <YYYY-MM-DD> — <topic>` (e.g. `Tinybird vs Moose vs base-rt across 5 scenarios`).

Labels: `axp-snapshot-index`, `axp-snapshot:<date>`, plus every `harness:*` and `scenario:*` covered by the snapshot.

Description body — markdown, mirror this scaffold:

```markdown
## Snapshot at a glance

- **Date**: <YYYY-MM-DD>
- **Agent**: claude-code / claude-sonnet-4-6 (or whatever was actually used)
- **Scenarios**: <N> — list them
- **Harnesses**: <N> — list them
- **Cells filled**: <X / Y>
- **GCS traces**: https://downloads.fiveonefour.com/research/<file>.tar.gz
- **Linear Document**: <link to companion Document — fill in after Step 4>
- **Repo commit**: <git rev>
- **Branch**: <branch name>

## Matrix

<paste the rendered Unicode table here>

## Headlines

- 3-5 bullets. Lead with the most surprising finding.
- Include cost ranges. Include where Tinybird/Moose/base-rt actually beat each other.
- If a harness has a known capability gap (e.g. Postgres CDC), state it explicitly.

## What changed in assertion code since the previous snapshot

- Bullet each landed fix that affects scoring (e.g. `describeTable` migration, port-flex helpers, envelope unwrap, idempotent_rerun heuristic).
- Link to commit hashes.

## Open follow-up issues

<filled in after Step 5 — list of created sub-issues>

## Caveats

- Single-sample noise notes — which cells are unstable
- Wall-clock counter bug if applicable
- Cells not run, with reason
```

## Step 4: Create the companion Document

Linear Documents are flat (no labels). They live on the parent issue (preferred for snapshots) so they inherit context.

Use `save_document` with `issue: <parent-issue-id>` and `title: AXP Snapshot — <YYYY-MM-DD> — <topic>`.

Document body — long-form narrative. Mirror this scaffold:

```markdown
# AXP comparison snapshot — <YYYY-MM-DD>

[Two-paragraph summary: what we ran, what changed, what we learned. Link to GCS tarball.]

## Matrix

[Full Unicode table — re-render same as parent issue]

## Per-scenario notes

### <scenario-name>
- Score progression / contrasts across harnesses
- Notable agent behaviors observed in session.jsonl
- Whether this scenario surfaced any parity-gap or scoring-bias

[Repeat per scenario]

## Per-harness notes

### <harness-name>
- Where it succeeded
- Where it failed and why (parity-gap vs scoring-bias vs variance)
- Cost vs other harnesses

[Repeat per harness]

## Methodology

- Latest-code cutoff per scenario
- Single-sample vs multi-sample cells
- How "tools used" is detected (grep against session.jsonl)
- How harness identity was verified

## Trace archive

- GCS path
- Redaction notes (Tinybird local tokens, etc.)
- File counts per artifact type
```

After creating the document, **update the parent issue** to link to it under "Linear Document".

## Step 5: Create follow-up sub-issues

For each finding from Step 3 that demands work, spawn a sub-issue with `parentId: <snapshot-issue-id>`. Apply the AGENTS.md delegation contract:

```markdown
## Context
[1-3 sentences. What we observed in the snapshot. Link to specific run IDs.]

## Goal
[The outcome that closes this issue.]

## Scope
[What changes, what doesn't.]

## Acceptance Criteria
- [ ] <verifiable check 1>
- [ ] <verifiable check 2>

## Key Files
- path/to/file:line — why
- path/to/dir/ — what

## Out of Scope
- [Explicit non-goals]

## Relevant Skills
- dec-bench-local-test (or whichever)
```

Apply labels:
- The `axp-snapshot:<date>` for the snapshot it came from
- One `harness:<id>` if the issue is harness-specific
- One `scenario:<id>` if the issue is scenario-specific
- One of `parity-gap` / `scoring-bias` / `variance-investigation` / `harness-port`
- T-shirt size project label (`0-XS`, `1-S`, `3-M`, `2-L`, `4-XL`) per AGENTS.md

Set the `estimate` field to match (1=XS, 2=S, 3=M, 5=L, 8=XL).

## Step 6: Status update

If the user has a project that hosts this work (e.g. on Fiveonefour: "AXP 0.1 Research Preview"), post a short status update there pointing at the snapshot issue. Three lines max: what landed, what's open, link to snapshot.

## Step 7 (optional): Package + upload traces

If traces aren't already on GCS:

1. Stage all run artifacts under `/tmp/dec-bench-<topic>-<date>/runs/<run-id>/...`
2. **Redact ephemeral local tokens**: Tinybird local admin tokens (`p.<base64>.<base64>`) → `[REDACTED_TB_LOCAL_TOKEN]`. Sweep also for Anthropic keys (`sk-ant-*`), Postgres password URLs, host paths.
3. Write a README with the matrix table, redaction notes, reproduce recipe.
4. `tar -czf` and `gsutil cp` to `gs://downloads.fiveonefour.com/research/dec-bench-<topic>-<YYYY-MM-DD>.tar.gz`.
5. Confirm with the user before uploading — bucket is public (`allUsers: storage.objectViewer`).

The bucket is shared. Check existing files for naming conventions: `gsutil ls gs://downloads.fiveonefour.com/research/`.

## Common mistakes

- **Using "DEC Bench" or "DecBench" in Linear titles or labels.** Use AXP. Repo paths still say `dec-bench` — that's correct in code references.
- **Skipping the harness verification grep.** A run scored 1.000 might mean "harness worked" or "agent found a workaround that bypassed the harness." session.jsonl tells you which.
- **Apples-to-oranges comparison.** Mixing pre- and post-fix runs in the same matrix produces misleading numbers. Document the latest-code cutoff per scenario.
- **One sample per cell on noisy scenarios.** csv-ingest informed and ingest-to-api have known high variance. Take 3+ samples or note the limitation explicitly.
- **Creating a `bench-snapshot:*` label** instead of `axp-snapshot:*`. The convention is AXP-prefix for new labels.

## Reference: existing infrastructure

- **Repo**: `/Users/nicolas/code/514/agent-evals` on branch `nicolas/tinybird-standard-scenarios`
- **CLI binary**: `target/debug/dec-bench`
- **Result files**: `results/<run-id>.json` plus 8 sibling artifacts
- **Latest GCS upload**: `gs://downloads.fiveonefour.com/research/dec-bench-tinybird-vs-moose-2026-04-27.tar.gz`
- **First snapshot label**: `axp-snapshot:2026-04-27`
- **Linear team**: Evals (id `19a93931-9c0e-4767-ac84-fe5be118175c`)
- **AGENTS.md**: defines delegation contract format and T-shirt size convention used here
