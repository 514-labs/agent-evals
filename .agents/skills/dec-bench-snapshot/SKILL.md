---
name: dec-bench-snapshot
description: Capture a DEC Bench (AXP) comparison run set as a Linear snapshot — required GCS trace upload, parent index issue (with eval-validity / cheating / decbench-DX / Moose-feedback findings), Document, and labeled follow-up sub-issues. Halts if `gcloud` is not authenticated and asks the user to log in. Use when a user says "snapshot the results", "publish this comparison to Linear", "create a snapshot from these runs", "document the latest matrix", or after running a multi-cell harness comparison and asking "now what".
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

## Step 0: Verify gcloud auth (REQUIRED — halt if not authed)

Trace packaging + GCS upload is **mandatory** for every snapshot. Linear without GCS-hosted traces is a dead-end record — reviewers can't replay agent behavior, and follow-up issues become un-actionable. Do this check **before any other work**.

Run:

```bash
gcloud auth list --filter=status:ACTIVE --format="value(account)"
gcloud config get-value project 2>/dev/null
```

- If **no active account** is returned, **stop immediately**. Do not run trace aggregation, do not draft Linear content, do not create the parent issue. Print the following message to the user and end the turn:

  > GCS upload is required for this snapshot, and the gcloud CLI is not authenticated.
  > Please run `gcloud auth login` (and `gcloud config set project <project>` if needed) in your terminal, then ask me to continue.

  After the user reports they are logged in, re-run the auth check and only then proceed.

- If an account is returned but the user lacks write access to `gs://downloads.fiveonefour.com/research/`, the upload in Step 3 will fail with `403`. Surface that error verbatim and ask the user to fix permissions before retrying — do not silently fall back to "skip upload".

Do not skip this step "because traces already exist on GCS" without confirming the URL with the user — stale tarballs are a common cause of misleading snapshots.

## Step 1: Gather inputs from the user / environment

Before creating anything:

1. **Snapshot date** (defaults to today, ISO `YYYY-MM-DD`)
2. **Run-set scope**: which scenarios × harnesses × personas. Get this from the latest `results/*.json` files for runs in scope.
3. **Latest-code cutoff** per scenario — the timestamp earlier than which assertion code differs (if you've been changing helpers). Filter runs accordingly so the matrix is apples-to-apples.
4. **GCS tarball URL** — produced by Step 3 below. Required, not optional. If a prior tarball already covers this run set, confirm with the user and reuse; otherwise package + upload fresh.

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

## Step 3: Package + upload traces (REQUIRED)

This step is mandatory — the GCS URL produced here is referenced by the parent issue and Document. Step 0 already verified gcloud auth; if you skipped Step 0, go back.

1. Stage all run artifacts under `/tmp/dec-bench-<topic>-<date>/runs/<run-id>/...`. Include for each run: result `.json`, `.session.jsonl`, `.assertion-log.json`, `.trace.json`, `.run-meta.json`, `.agent-raw.json`, `.service-logs.json`, `.stdout`.
2. **Redact ephemeral local tokens** (sweep before tarring):
   - Tinybird local admin tokens (`p.<base64>.<base64>`) → `[REDACTED_TB_LOCAL_TOKEN]`
   - Anthropic keys (`sk-ant-*`) → `[REDACTED_ANTHROPIC_KEY]`
   - OpenAI keys (`sk-proj-*`, `sk-*`) → `[REDACTED_OPENAI_KEY]`
   - Postgres password URLs (`postgres://user:pass@…`) → strip the `:pass`
   - Host filesystem paths that leak the user's home dir
3. Write a `README.md` at the tarball root with: matrix table, redaction notes, reproduce recipe (CLI commands), and a one-line answer to each of the four learning questions in Step 4.
4. Tar and upload:
   ```bash
   tar -czf /tmp/dec-bench-<topic>-<YYYY-MM-DD>.tar.gz -C /tmp dec-bench-<topic>-<date>
   gsutil cp /tmp/dec-bench-<topic>-<YYYY-MM-DD>.tar.gz \
     gs://downloads.fiveonefour.com/research/
   ```
5. Capture the public URL: `https://downloads.fiveonefour.com/research/dec-bench-<topic>-<YYYY-MM-DD>.tar.gz`. The bucket has `allUsers: storage.objectViewer` — confirm with the user before upload that nothing in the redacted tarball is sensitive.
6. **If `gsutil cp` fails** with `401`/`403`/`AccessDenied`: stop. Print the error verbatim and tell the user to run `gcloud auth login` (or fix their bucket-write permissions), then ask you to resume. Do not proceed to Step 4 without a working URL.

Check existing names for convention: `gsutil ls gs://downloads.fiveonefour.com/research/`.

## Step 4: Create the parent index issue

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
- **Linear Document**: <link to companion Document — fill in after Step 5>
- **Repo commit**: <git rev>
- **Branch**: <branch name>

## Matrix

<paste the rendered Unicode table here>

## Headlines

- 3-5 bullets. Lead with the most surprising finding.
- Include cost ranges. Include where Tinybird/Moose/base-rt actually beat each other.
- If a harness has a known capability gap (e.g. Postgres CDC), state it explicitly.

## Eval / test validity

What the traces tell us about whether the assertions are measuring the right thing.
- Did any assertion pass for a wrong reason (e.g. agent created the right *name* but wrong contents, and the assertion only checked names)?
- Did any assertion fail for a reason unrelated to agent capability (flaky helper, timing race, port conflict, helper script bug)?
- Are gates ordered correctly — does a higher gate require strictly more capability than a lower one?
- Cite specific run IDs + assertion names. If validity is fine, say so explicitly with the evidence you checked.

## Agent cheating / shortcuts

What in the trace looks like the agent gaming the eval rather than doing the task.
- Did the agent edit assertion code, scoring code, or helper scripts?
- Did the agent invoke tools outside its declared harness (e.g. `tinybird-forward` cell calling `moose dev`, or any cell shelling out to `clickhouse-client` to bypass the surface under test)?
- Did the agent hardcode expected outputs instead of computing them (e.g. echoing the assertion's expected JSON)?
- Did the agent disable services, mock data, or no-op a step then claim success?
- Cite session.jsonl line ranges. If no cheating observed, state that explicitly with the searches you ran.

## DEC Bench (decbench) usage improvements

What the run set surfaces about the benchmark itself — friction, gaps, footguns we should fix.
- CLI ergonomics: confusing flags, missing defaults, error messages that misled the agent.
- Scenario design: ambiguous prompts, under-specified acceptance criteria, missing seed data.
- Harness gaps: missing tools, broken installs, unhelpful error output from the harness.
- Scoring: bias, brittleness, missing dimensions (e.g. correctness without efficiency).
- Each item should produce a follow-up sub-issue in Step 6.

## Moose product usage by the agent

What the run set surfaces about how agents use Moose — only relevant for cells where the harness includes Moose (`olap-for-swe`, `moose-delta-migrations`, `moose-legacy-migrations`).
- Where agents tripped up: wrong commands, wrong import paths, wrong config shape, misread error messages.
- Docs gaps the agent visibly hit (looking for a flag that doesn't exist, calling an API the docs don't surface).
- DX wins: places where Moose's affordances obviously helped vs other harnesses.
- Concrete suggestions for Moose product/docs (these become follow-up issues in the **Moose** team, not Evals).
- If no Moose harness was in scope, write "N/A — no Moose harness in this run set" and skip.

## What changed in assertion code since the previous snapshot

- Bullet each landed fix that affects scoring (e.g. `describeTable` migration, port-flex helpers, envelope unwrap, idempotent_rerun heuristic).
- Link to commit hashes.

## Open follow-up issues

<filled in after Step 6 — list of created sub-issues>

## Caveats

- Single-sample noise notes — which cells are unstable
- Wall-clock counter bug if applicable
- Cells not run, with reason
```

Each of the four learning sections is **required**. If a section truly has nothing to report, write one sentence explaining what you checked and why nothing surfaced — do not omit the heading. Empty sections hide whether you looked.

## Step 5: Create the companion Document

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

## Eval validity — long form

Walk through the validity findings from the parent issue with full evidence: assertion names, run IDs, session.jsonl excerpts. Highlight assertions you would change and why. If validity holds across the run set, state which assertions you spot-checked.

## Agent cheating — long form

Walk through any shortcut behaviors observed. Quote the relevant `session.jsonl` lines. Distinguish between (a) creative-but-legitimate problem solving, (b) ambiguous behavior worth a follow-up, (c) clear cheating that should fail the run retroactively.

## DEC Bench usage improvements — long form

Each improvement should map to a sub-issue created in Step 6. For each: what the friction was, where in the trace it showed up, proposed fix, blast radius (one scenario vs cross-cutting).

## Moose product feedback — long form

Only if a Moose harness was in scope. Group findings as: docs gaps, CLI/API ergonomics, error-message clarity, missing primitives, DX wins worth amplifying. Each finding should map to a sub-issue filed against the **Moose** team (not Evals).

## Methodology

- Latest-code cutoff per scenario
- Single-sample vs multi-sample cells
- How "tools used" is detected (grep against session.jsonl)
- How harness identity was verified
- How cheating was detected (which greps, which file paths)

## Trace archive

- GCS path
- Redaction notes (Tinybird local tokens, etc.)
- File counts per artifact type
```

After creating the document, **update the parent issue** to link to it under "Linear Document".

## Step 6: Create follow-up sub-issues

For each finding from Step 4 that demands work — especially items in the eval-validity, cheating, decbench-improvements, and Moose-feedback sections — spawn a sub-issue with `parentId: <snapshot-issue-id>`. Apply the AGENTS.md delegation contract:

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
- One of `parity-gap` / `scoring-bias` / `variance-investigation` / `harness-port` / `eval-validity` / `agent-cheating` / `decbench-dx` / `moose-feedback`
- T-shirt size project label (`0-XS`, `1-S`, `3-M`, `2-L`, `4-XL`) per AGENTS.md

Set the `estimate` field to match (1=XS, 2=S, 3=M, 5=L, 8=XL).

Moose-feedback sub-issues file against the **Moose** Linear team, not Evals; everything else stays on Evals (with parent linkage preserved).

## Step 7: Status update

If the user has a project that hosts this work (e.g. on Fiveonefour: "AXP 0.1 Research Preview"), post a short status update there pointing at the snapshot issue. Three lines max: what landed, what's open, link to snapshot + GCS tarball URL.

## Common mistakes

- **Using "DEC Bench" or "DecBench" in Linear titles or labels.** Use AXP. Repo paths still say `dec-bench` — that's correct in code references.
- **Skipping the harness verification grep.** A run scored 1.000 might mean "harness worked" or "agent found a workaround that bypassed the harness." session.jsonl tells you which.
- **Apples-to-oranges comparison.** Mixing pre- and post-fix runs in the same matrix produces misleading numbers. Document the latest-code cutoff per scenario.
- **One sample per cell on noisy scenarios.** csv-ingest informed and ingest-to-api have known high variance. Take 3+ samples or note the limitation explicitly.
- **Creating a `bench-snapshot:*` label** instead of `axp-snapshot:*`. The convention is AXP-prefix for new labels.
- **Drafting Linear before checking gcloud auth.** If `gsutil cp` fails at the end, the parent issue links to a non-existent tarball. Run Step 0 first, every time.
- **Filing the snapshot without answering the four learning questions.** A snapshot that has only a matrix and headlines is just a leaderboard. The validity / cheating / decbench-DX / Moose-feedback sections are why the snapshot exists.
- **Letting agent cheating slide because the score was 1.000.** A perfect score from a cell that bypassed the harness is worse than a failed run — it's silently corrupting comparisons. Surface it explicitly and consider rerunning the cell.
- **Uploading un-redacted traces.** The bucket is world-readable. Run the redaction sweep before `gsutil cp`, and grep the staged tarball one more time for `sk-ant-`, `sk-proj-`, `p.ey`, `postgres://.*:.*@` before tarring.

## Reference: existing infrastructure

- **Repo**: `/Users/nicolas/code/514/agent-evals` on branch `nicolas/tinybird-standard-scenarios`
- **CLI binary**: `target/debug/dec-bench`
- **Result files**: `results/<run-id>.json` plus 8 sibling artifacts
- **Latest GCS upload**: `gs://downloads.fiveonefour.com/research/dec-bench-tinybird-vs-moose-2026-04-27.tar.gz`
- **First snapshot label**: `axp-snapshot:2026-04-27`
- **Linear team**: Evals (id `19a93931-9c0e-4767-ac84-fe5be118175c`)
- **AGENTS.md**: defines delegation contract format and T-shirt size convention used here
