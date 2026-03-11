---
name: dec-bench-evals
description: Author, validate, run, and publish DEC Bench evaluation scenarios. Use when creating new DEC Bench scenarios, writing gate assertions, designing naive and savvy prompts, choosing harnesses, extending existing evals, or publishing scenarios to the DEC Bench registry.
license: Complete terms in LICENSE.txt
compatibility: Requires Docker, dec-bench CLI, Node.js 20+, and pnpm 10.4+
---

# DEC Bench Evals

Use this skill when the user wants to create or extend a DEC Bench scenario. The goal is a deterministic, runnable evaluation, not a vague benchmark idea.

## Quick Start

Default authoring loop:

```bash
dec-bench create --name <id> --domain <domain> --tier <tier>
dec-bench validate --scenario <id>
dec-bench build --scenario <id> --harness <harness> --agent <agent> --model <model> --version <version>
dec-bench run --scenario <id> --harness <harness> --persona naive --mode no-plan
dec-bench results --latest --scenario <id>
dec-bench audit open --scenario <id> --run-id <run-id>
dec-bench registry add --scenario scenarios/<id>
dec-bench registry publish --id <id>
```

Rules:

- Run `dec-bench validate` before `build` or `run`.
- Treat `build` and `run` as separate checks: build verifies the image path, run verifies scoring behavior.
- Use `results` to inspect the latest run before opening the audit UI.
- Use `audit open` for the browser view, or `audit export` if you only need the bundle.
- If the workspace is not a DEC Bench repo, stop and ask whether the user wants a DEC Bench scenario scaffold or only a scenario design proposal.

## Before You Scaffold

Decide these first:

- Scenario ID: lowercase, hyphenated, specific to the task.
- Domain: one of `foo-bar`, `b2b-saas`, `b2c-saas`, `ugc`, `e-commerce`, `advertising`, `consumption-based-infra`.
- Tier: `tier-1`, `tier-2`, or `tier-3`.
- Starting state: broken/incomplete or clean/greenfield.
- Primary competency: the main reasoning skill the eval is testing.
- Harness: `base-rt`, `classic-de`, `olap-for-swe`, or a justified custom harness.
- Success criteria: concrete pass/fail checks, not subjective judgments.

Prefer the smallest tier that still exercises the intended competency. Keep the starting state deterministic and easy to reset.

## What Good Evals Look Like

Good DEC Bench scenarios:

- test one clear workflow or failure mode
- use realistic but compact seed data
- make the agent resolve observable constraints
- score behavior with deterministic assertions
- keep setup reproducible across repeat runs

Avoid:

- LLM-as-judge scoring
- vague tasks like "improve the pipeline"
- hidden state that changes between runs
- prompts that move the goalposts between personas
- assertions with side effects unless the gate explicitly needs rerun behavior

## Scaffold Output

`dec-bench create` generates a scenario directory with:

- `prompts/naive.md`
- `prompts/savvy.md`
- `init/`
- `assertions/functional.ts`
- `assertions/correct.ts`
- `assertions/robust.ts`
- `assertions/performant.ts`
- `assertions/production.ts`
- `scenario.json`
- `supervisord.conf`

Work through those files in that order.

## Prompt Rules

Both prompts must target the same acceptance criteria.

- `naive.md`: plain language, minimal implementation hints, no named tools unless the task would naturally mention them.
- `savvy.md`: explicit tools, schemas, paths, constraints, and operational details.
- Do not make the savvy prompt easier by changing the required outcome.
- Keep prompts specific enough that assertions feel inevitable rather than surprising.

## Infrastructure Rules

Use `init/` and `supervisord.conf` to create the starting state.

- Broken/incomplete start: seed healthy-enough infrastructure plus one or more diagnosable defects.
- Clean/greenfield start: seed healthy infrastructure and realistic source data, then let the agent build the missing solution.
- Keep data deterministic.
- Expose connection settings through environment variables that both the agent and assertions can consume.
- Start only the services the scenario needs.

In `supervisord.conf`:

- use explicit programs and startup order
- keep `autorestart=false`
- avoid incidental background services

## Assertion Rules

Assertions are the core of the eval. Write scenario assertions only; the framework provides universal core assertions.

- Each exported async function should test one thing.
- Function names become assertion keys in the scoring output.
- Return `AssertionResult` with `passed` plus actionable `message` and useful `details`.
- Keep assertions deterministic, fast, and side-effect free unless rerun behavior is the point.
- Put helper functions like `queryRows<T>()` inside the same gate file.
- Prefer database and artifact checks over log-text heuristics.

Use the framework context:

- `ctx.clickhouse` for ClickHouse queries
- `ctx.postgres` for Postgres queries
- `ctx.env()` for connection settings and other environment variables

Gate model:

1. Functional: it runs
2. Correct: it is right
3. Robust: it handles messy or repeated execution
4. Performant: it meets runtime or query thresholds
5. Production: you would ship it

A gate only counts if earlier gates pass. Scenario assertions must clear the 80% gate threshold together with the framework's core assertions.

## `scenario.json` Rules

Populate at least these fields:

- `id`
- `title`
- `description`
- `tier`
- `domain`
- `harness`
- `tasks`
- `personaPrompts`
- `infrastructure`
- `tags`
- `baselineMetrics`
- `referenceMetrics`

Important details:

- `personaPrompts` should point to `prompts/naive.md` and `prompts/savvy.md`.
- `tasks[]` should be concrete and categorized.
- `infrastructure.services` and `infrastructure.description` should describe the actual starting state.
- Baseline and reference metrics should be plausible, not aspirational.

For the full contract, enum values, and worked examples, see [guide.md](references/guide.md).

## Harness Guidance

Use the built-in harnesses unless the toolchain requirements are truly new.

- `base-rt`: base infrastructure plus common runtime tools
- `classic-de`: dbt and heavier data engineering tooling
- `olap-for-swe`: MooseStack-focused workflows

Create a custom harness only when the scenario genuinely needs additional packages or outbound policy changes.

## Publishing Flow

To contribute an authored scenario upstream:

1. `dec-bench registry add --scenario scenarios/<id>`
2. `dec-bench registry publish --id <id>`

Use registry publish only after the scenario validates and runs locally.

## Expected Output

When this skill activates, produce one of these:

- a concrete scenario proposal with domain, tier, starting state, competency, harness, and assertion plan
- direct edits to scaffolded scenario files
- a targeted extension plan for an existing scenario

Do not stop at a list of ideas. Convert the user request into runnable scenario files or a file-by-file implementation plan.

## Additional Resource

Read [guide.md](references/guide.md) for:

- full `scenario.json` schema and enum values
- complete assertion examples for all five gates
- naive vs. savvy prompt examples
- harness selection details
- registry publish flags and review checklist
- skills.sh-compatible installation notes for this skill
