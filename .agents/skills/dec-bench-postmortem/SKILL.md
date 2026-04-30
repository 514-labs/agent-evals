---
name: dec-bench-postmortem
description: Analyze a completed DEC Bench run from its `results/` artifacts. Answers the six recurring postmortem questions — outcome, trajectory, approach signals, assertion drill-down, stop-point analysis, run-vs-run delta — each with a fixed response format. Use when a user says "what happened in the run", "why did the agent stop / ask / fail", "walk me through the trajectory", "did the agent use X the whole time", "explain why <assertion> failed", "compare these two runs", "diff runs", "postmortem", or pastes a path to a `.assertion-log.json` / `.session.jsonl` / `.agent-raw.json` artifact.
---

# DEC Bench Postmortem

Forensic analysis of a single completed run, or a side-by-side diff of two runs. This skill is for **understanding** runs, not running them — for that, use `dec-bench-run`.

## Locating the run

Every run produces a fixed set of artifacts under `results/`, all sharing the same prefix:

```
<scenario>-<agent>-<model>-<harness>-<persona>-<mode>-<timestamp>
```

| Artifact | Use it for |
|---|---|
| `<prefix>.agent-raw.json` | final result text, num_turns, total_cost_usd, stop_reason, terminal_reason |
| `<prefix>.assertion-log.json` | per-gate pass/fail with `details` |
| `<prefix>.session.jsonl` | full turn-by-turn assistant + user transcript with tool uses, tool results, and `thinking` blocks |
| `<prefix>.trace.json` | OTLP-style trace |
| `<prefix>.run-meta.json` | config (agent, model, harness, persona, mode) |
| `<prefix>.stdout` / `.stderr` / `.infra.stdout` | process output |
| `<prefix>.service-logs.json` | bundled supervisord / clickhouse / redpanda logs |

### Resolving "the run" from user input

| User input | Resolution |
|---|---|
| Nothing / "the latest run" / "my last run" | `RUN_AGENT_RAW=$(ls -t results/*.agent-raw.json \| head -1); RUN=${RUN_AGENT_RAW%.agent-raw.json}` |
| "latest <scenario>" or "latest <harness>" or both | filter the `ls` glob by those tokens before `head -1` |
| A path to any artifact (`.assertion-log.json`, `.session.jsonl`, `.agent-raw.json`, ...) | strip the suffix to get `RUN` |
| A timestamp like `1777495715553` | grep the `results/` listing for the matching prefix |
| "compare X to Y" / "diff" | resolve each run independently; produce the delta format (§6) |

Throughout this skill, treat `$RUN` as the path-prefix shared across artifacts.

## Question taxonomy and response formats

Match the user's question to one of these six shapes. **Use the named format exactly** — the value of this skill is consistency across runs.

If the user's first message asks an open question ("what happened in this run"), default to **§1 Outcome**, then offer to follow up with §2 / §5 depending on the result. Do not produce all six unprompted — that's verbose noise.

---

### §1 — Outcome

**Triggers:** "what happened", "did it pass", "summary", "/postmortem" with no further qualifier, or default first response when a run is mentioned.

**Recipes:**

```bash
jq -r '{turns: .num_turns, duration_s: (.duration_ms/1000), cost_usd: .total_cost_usd, stop_reason, terminal_reason, result_tail: (.result|.[-180:])}' $RUN.agent-raw.json
jq -r '
  [.functional, .correct, .robust, .performant, .production] as $gates
  | $gates | map(.. | objects | select(has("passed")))
  | { total: length, passed: map(select(.passed == true)) | length }
' $RUN.assertion-log.json
jq -r '.. | objects | select(has("passed") and .passed == false)' $RUN.assertion-log.json
```

**Format (Markdown):**

```
**Outcome:** <pass>/<total> · <turns> turns · <duration_s>s · $<cost_usd> · <stop_reason>
**Failures:** <comma-separated assertion names>, or "none"
**Final text:** > <single-sentence quote from the result tail, ≤120 chars, prefix "…" if mid-sentence>
```

No prose around it — the format above is the entire response unless the user asked for more.

---

### §2 — Trajectory

**Triggers:** "what happened", "walk me through", "show the sequence", "trajectory", "what did the agent do".

**Recipes:**

```bash
jq -c 'select(.type == "assistant" and .message.content[0].type == "tool_use")' $RUN.session.jsonl \
  | jq -r '.message.content[0] | "\(.name)\t\(.input.file_path // .input.command // .input.skill // "")"' \
  | nl -ba
jq -c 'select(.type == "assistant" and (.message.content[0].name == "Write" or .message.content[0].name == "Edit"))' $RUN.session.jsonl \
  | jq -r '.message.content[0] | "\(.name) \(.input.file_path)"' | sort -u
```

**Format:**

A numbered Markdown table grouped by phase (collapse runs of the same tool against the same target):

```
| # | Tool | What |
|---|------|------|
| 1–5 | Bash | filesystem recon: `pwd`, `ls /data`, `find /data/s3`, peek at csv/jsonl headers |
| 6 | Bash | `moose init orders-analytics --language typescript` (failed: …) |
| 7 | Edit | `app/ingest/initial_load_orders.ts` — declare InitialLoadOrder + OlapTable |
| ... |
```

End with one summary line:

```
**Mutations:** <unique file paths comma-separated>. **Stop:** turn <N> via <stop_reason>.
```

Do not paste raw command output. The reader cares about the shape, not the bytes.

---

### §3 — Approach signals

**Triggers:** "did the agent use X the whole time", "did it stay on the recommended path", "what was the agent's approach", "did it use Moose / MCP / OlapTable.insert".

**Recipes:**

```bash
# Tool-use frequency
jq -r 'select(.type == "assistant" and .message.content[0].type == "tool_use") | .message.content[0].name' $RUN.session.jsonl | sort | uniq -c | sort -rn

# Bash command corpus
jq -r 'select(.type == "assistant" and .message.content[0].name == "Bash") | .message.content[0].input.command' $RUN.session.jsonl > /tmp/run-bash.txt

# Bash by namespace prefix (adjust regexes to the scenario domain)
echo "moose: $(grep -cE '(^| )moose( |$)' /tmp/run-bash.txt)"
echo "moose query: $(grep -cE 'moose query' /tmp/run-bash.txt)"
echo "npm: $(grep -cE '(^| )npm( |$)' /tmp/run-bash.txt)"
echo "ts-node: $(grep -cE 'ts-node' /tmp/run-bash.txt)"
echo "clickhouse-client: $(grep -cE 'clickhouse-client' /tmp/run-bash.txt)"
echo "curl: $(grep -cE '(^| )curl( |$)' /tmp/run-bash.txt)"

# Recommended-path APIs in source files (Moose example — adapt per scenario)
jq -r 'select(.type == "assistant" and (.message.content[0].name == "Write" or .message.content[0].name == "Edit")) | .message.content[0].input.content // .message.content[0].input.new_string // empty' $RUN.session.jsonl > /tmp/run-source.txt
echo "OlapTable.insert: $(grep -cE 'OlapTable[^.]*\.insert\b' /tmp/run-source.txt)"
echo "Workflow/Task: $(grep -cE 'new (Workflow|Task)\b' /tmp/run-source.txt)"
echo "moose ls calls: $(grep -cE 'moose ls' /tmp/run-bash.txt)"
echo "MCP calls: $(jq -r 'select(.type == "assistant" and .message.content[0].type == "tool_use") | .message.content[0].name' $RUN.session.jsonl | grep -c '^mcp__')"
```

**Format:**

```
**Tool tally:** Bash <n> · Edit <n> · Write <n> · Read <n> · Skill <n> · MCP <n>
**Bash by namespace (top ~6):** <namespace> <n> · ... (sorted desc)
**Recommended-path APIs:** <api> <n> · <api> <n> · ...
**Verdict:** <one sentence>. Pattern: "<used | mostly used | partially | bypassed> <thing> for <X>; <bypassed | used> for <Y>."
```

The "recommended-path APIs" list is **scenario-specific**. For Moose scenarios use the list above. For other domains, ask the user once what counts as the recommended path — don't guess.

---

### §4 — Assertion drill-down

**Triggers:** "why did <X> fail", "explain the <Y> assertion", "what is the <Z> issue".

**Recipes:**

```bash
# Pull the failing assertion's details
jq -r --arg name "<assertion-name>" '
  .. | objects | select(has("passed") and .passed == false) | select((. | tostring | test($name)))
' $RUN.assertion-log.json

# Locate the assertion implementation
grep -rn "<assertion-name>" scenarios/<scenario-id>/assertions/ scenarios/_shared/

# Pull the offending source content from session writes
jq -r 'select(.type == "assistant" and (.message.content[0].name == "Write" or .message.content[0].name == "Edit") and .message.content[0].input.file_path == "<workspace-path>") | .message.content[0].input.content // .message.content[0].input.new_string' $RUN.session.jsonl
```

**Format:**

```
**Assertion:** `<gate>/<scope>/<name>`
**Finding(s):**
- `<file:line>` —
  ```ts
  // 3-5 surrounding lines, fenced for the right language
  ```
**What the assertion checks:** one sentence, citing the helper file (e.g. `scenarios/_shared/assertion-helpers.ts:124`).
**Real or noise?:** call out duplicates (e.g. compiled mirrors). Distinguish "one violation, two findings" from "N independent violations".
**Fix:** one sentence. If multiple options, list them with cost ordering (cheap → opinionated).
```

If the assertion's `details` lists multiple findings that all trace back to the same source file via build artifacts, **say that explicitly** — don't let the reader count duplicates as separate problems.

---

### §5 — Stop-point analysis

**Triggers:** "why did the agent stop", "why did it ask to confirm", "why didn't it finish", "what made it bail".

**Recipes:**

```bash
# Last 2 assistant turns: thinking + text
jq -c 'select(.type == "assistant")' $RUN.session.jsonl | tail -2 \
  | jq -r '.message.content[]? | select(.type == "thinking" or .type == "text") | "[\(.type)]\n\(.thinking // .text)\n"'

# Last 3 user-side context entries (tool results, system reminders, attachments)
jq -c 'select(.type == "user")' $RUN.session.jsonl | tail -3 \
  | jq -r '.message.content[]? | select(.type == "tool_result") | .content | tostring | .[0:400]'

# What landed via Skill / attachment in the last 5 turns
jq -c 'select(.type == "assistant" and .message.content[0].name == "Skill")' $RUN.session.jsonl | tail -3
jq -c 'select(.type == "attachment")' $RUN.session.jsonl | tail -5
```

**Format (this is the only format with significant prose — the analysis is interpretive):**

```
**Stop type:** `<stop_reason>` — <one-line characterization of how it ended>
**Last thinking (paraphrased, ≤200 words):**
> <excerpt>

**Last text (verbatim closing sentence):**
> "<quote>"

**Upstream context (last 1–3 turns before the stop):**
- <e.g. "Skill `moose--basics` loaded at turn N-1, returning ~6KB of teaching content">
- <e.g. "tool_result for Read of manifest.csv contained an injected system-reminder about malware analysis">

**Hypothesis:** <≤3 sentences, name the most likely mechanism>. Mark speculative claims with "probably" / "consistent with" / "n=1". If the trace doesn't support a tidy mechanism, say "no obvious cause; ordinary end-of-task completion."
```

Never invent a cause. If the agent ended cleanly with a verification report and `end_turn`, that's fine — say so.

---

### §6 — Run-vs-run delta

**Triggers:** "diff", "compare", "how did this run change", "compare A to B", "before / after".

**Recipes:**

Run §1 + §2 + §3 against both runs. Then explicitly state which axes differ between them (`prompt | harness | persona | agent | model | mode | scenario`).

**Format:**

```
**Variables held constant:** <list>
**Variables that differ:** <list>

| Metric | Run A (`<short id>`) | Run B (`<short id>`) |
|---|---|---|
| Pass / total | x/y | x/y |
| Turns | n | n |
| Duration | s | s |
| Cost | $ | $ |
| Stop reason | | |
| Final stop quote | "..." | "..." |
| Mutations (count / paths) | | |
| Tool tally | | |

**Assertion deltas:** which gates flipped pass↔fail (named, not just counts).
**Approach deltas (one paragraph):** call out the substantive behavioral differences — e.g. "Run B added a `Workflow` definition Run A skipped; Run B's MCP usage went from 0 to 4; Run A bailed at turn 16 with a clarifying question, Run B ran to 82 turns."
**Trajectory fork point:** identify the first turn at which the bash command sequences materially diverge. State what was the same up to that turn, and what changed after.
```

If the runs differ in more than one variable (e.g. different prompt **and** different harness), call that out at the top — the diff is conditional on the confound.

---

## Conventions for every response

- **Cite file:line with backticks**: `` `apps/cli/src/commands/run.rs:42` ``.
- **Use raw values for numbers** — never round costs, durations, or row counts. Truncate quoted prose with `…`.
- **Prefer Markdown tables** for any comparison with ≥2 columns.
- **Quote agent text and thinking with blockquotes** (`>`). Mark elision with `…`.
- **Don't synthesize** what isn't in the artifacts. If the user asks something the trace can't answer, say so explicitly.
- **Don't dump raw tool output**. The skill's value is the shape — use the recipes to get the data, then summarize.
- **One question, one format**. If the user asks something hybrid, name which formats you're combining ("§1 Outcome + §4 drill-down on the failed assertion").

## Cheat-sheet recipes

```bash
# Resolve latest run
RUN=$(ls -t results/*.agent-raw.json | head -1); RUN=${RUN%.agent-raw.json}

# Tool-use frequency
jq -r 'select(.type=="assistant" and .message.content[0].type=="tool_use") | .message.content[0].name' $RUN.session.jsonl | sort | uniq -c | sort -rn

# Mutations (Write/Edit only, unique paths)
jq -r 'select(.type=="assistant" and (.message.content[0].name=="Write" or .message.content[0].name=="Edit")) | .message.content[0].input.file_path' $RUN.session.jsonl | sort -u

# Bash corpus
jq -r 'select(.type=="assistant" and .message.content[0].name=="Bash") | .message.content[0].input.command' $RUN.session.jsonl

# Last assistant text (final message body)
jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' $RUN.session.jsonl | tail -1

# Last assistant thinking
jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="thinking") | .thinking' $RUN.session.jsonl | tail -1

# All failing assertions
jq -r '.. | objects | select(has("passed") and .passed==false)' $RUN.assertion-log.json

# Headline metrics
jq '{turns: .num_turns, duration_s: (.duration_ms/1000), cost_usd: .total_cost_usd, stop_reason}' $RUN.agent-raw.json
```

## What this skill is not

- It does not start, build, or kill containers — that's `dec-bench-run`.
- It does not modify scenarios or prompts — that's the user's call after reading the postmortem.
- It does not generate AI-call summaries or LLM-powered narratives. The recipes are pure jq/grep against deterministic artifacts. The interpretive judgement (§5, §6) is yours, not a model call.
