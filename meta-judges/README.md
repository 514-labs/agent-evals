# Meta-judges

Cross-scenario LLM-as-judge assertions that run on **every** scenario as advisory signals. They do **not** affect `highest_gate` or `normalized_score`. They surface in `meta` of `output/assertion-log.json`.

Today this directory ships two judges:

| Judge | What it watches for |
|-------|---------------------|
| `agent-did-not-cheat` | Hardcoded outputs, stubbed APIs, deleted/weakened tests, edits to `assertions/` files, selective input handling. |
| `eval-or-product-concerns` | Ambiguous prompt, wrong assertion, broken fixture, product footgun, cryptic error, missing feature. |

## Reviewing the verdicts

Every run writes meta-judge verdicts into `output/assertion-log.json` under `meta`. The shape is:

```jsonc
{
  "meta": {
    "agent_did_not_cheat": {
      "passed": true,
      "durationMs": 4123,
      "message": "No cheating signals.",
      "details": {
        "judge": {
          "model": "claude-sonnet-4-6",
          "samples": 1,
          "verdicts": [
            { "passed": true, "categories": [], "reasoning": "..." }
          ],
          "tokens": { "input": 1234, "output": 567 },
          "toolCalls": []
        }
      }
    },
    "eval_or_product_concerns": { "...": "..." }
  }
}
```

Quick inspection:

```bash
# All meta verdicts at a glance
jq '.meta | to_entries | map({ judge: .key, passed: .value.passed, message: .value.message })' \
  output/assertion-log.json

# Full reasoning for the cheat detector
jq '.meta.agent_did_not_cheat.details.judge' output/assertion-log.json

# Surface only failing meta-judges across many runs
for log in runs/*/assertion-log.json; do
  jq --arg run "$log" '.meta | to_entries[] | select(.value.passed == false) | { run: $run, judge: .key, reasoning: .value.message }' "$log"
done
```

`categories` on each verdict is the most useful field for triage. The rubrics emit a fixed taxonomy (e.g. `hardcoded-output`, `ambiguous-prompt`, `wrong-assertion`, `cryptic-error`, ...) so you can group failures across runs without parsing prose.

## Opting out

Per scenario, set in `scenarios/<id>/scenario.json`:

```json
{
  "metaJudges": { "agent-did-not-cheat": false }
}
```

Globally for a single run, set `EVAL_DISABLE_META_JUDGES=1` before invoking the eval.

## Adding a new meta-judge

A meta-judge is a folder; the runtime discovers it automatically. No code change to `eval-core`.

```
meta-judges/<your-judge-id>/
  meta-judge.json     # manifest
  rubric.md           # the system prompt; reviewable as text in the PR
  fixtures/
    <case-id>/
      sessionLog.txt           # optional, only the inputs your judge needs
      prompt.md                # optional
      workspaceFiles.txt       # optional
      assertionOutcomes.json   # optional
      expected.json            # required: { "passed": bool, "categories"?: string[] }
```

`meta-judge.json` schema:

```jsonc
{
  "id": "your-judge-id",                    // required, kebab-case; underscore form lands in the meta slot
  "title": "Human-readable title",
  "description": "What this judge watches for and why.",
  "inputs": ["sessionLog", "prompt", "workspaceFiles", "assertionOutcomes"],
  "tools": [],                              // optional; ["clickhouse-readonly", "pg-readonly", "http-get"]
  "model": "claude-sonnet-4-6",             // optional, default claude-sonnet-4-6
  "samples": 1,                             // optional; >1 for N-sample majority vote
  "maxTurns": 4,                            // optional, default 6
  "advisory": true                          // meta-judges are always advisory in v0
}
```

`rubric.md` becomes the system prompt for the judge. Treat it like a doc: explain the pass condition, the fail conditions, the categories the judge should tag, and how strict to be. Bias toward "pass unless evidence is concrete." See [agent-did-not-cheat/rubric.md](agent-did-not-cheat/rubric.md) for a working example.

### Authoring loop

1. Write the manifest and rubric.
2. Create at least one passing fixture and one failing fixture per category you tag.
3. Run the regression suite:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-... pnpm -F @dec-bench/eval-core test:meta-judges
   ```

   The harness walks every fixture, runs the judge live, and asserts each verdict matches `expected.json`. Categories are matched as "at least one of the expected tags appears" (taxonomy is subjective).

4. If a fixture mis-classifies, tighten the rubric or adjust the fixture. Keep iterating until all fixtures classify correctly.
5. Open a PR. Reviewers can read `rubric.md` directly without diving into TS.

### Tips

- Inputs are pre-baked into the prompt at runtime. You do not need tools for cheat-detection or eval-quality use cases. Tools are useful when the judge needs to inspect live state (e.g. confirm a row count). Tools are server-side read-only.
- `samples: 3` is the cheapest way to dampen noise on a flaky rubric, at 3x cost. Reach for it only after the rubric is otherwise stable.
- Keep rubrics decisive. "Pass unless concrete evidence" is more useful than "fail on any suspicion": the meta slot is a triage signal, not a jury verdict.
- Every fail finding must be actionable. If a category cannot drive an action (a fix to the prompt, an issue to the product team, a follow-up on the agent), drop it from the rubric.
