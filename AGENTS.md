# DEC Bench

DEC Bench is an open-source benchmark for evaluating AI agents on real-world data engineering tasks. Monorepo containing a Rust CLI, Next.js marketing site with leaderboard and audit tools, and a TypeScript scoring framework.

## First run (read this if you just cloned the repo)

If the user wants to "get started", "run a scenario", or "test their setup", walk them through this:

1. **Install Docker** if not already installed, and make sure it is running. `docker info` should succeed.
2. **Install the DEC Bench CLI**:
   ```bash
   curl -fsSL https://decbench.ai/install.sh | sh
   ```
   Then `dec-bench list` should print the scenario catalog. If not, the install failed.
3. **Export an API key** for whichever agent the user wants to evaluate:
   - `ANTHROPIC_API_KEY` for Claude Code
   - `OPENAI_API_KEY` for Codex
   - `CURSOR_API_KEY` for Cursor
4. **Build and run the canonical first scenario**:
   ```bash
   dec-bench build --scenario foo-bar-csv-ingest
   dec-bench run --scenario foo-bar-csv-ingest
   dec-bench results --latest --scenario foo-bar-csv-ingest
   ```

If anything in steps 1-3 is missing, tell the user exactly what to fix and stop. Do not continue with a broken setup.

For the full quickstart skill, see `.claude/skills/dec-bench-quickstart/SKILL.md` (or `.agents/skills/dec-bench-quickstart/SKILL.md`).

## Scenario object model (read this before touching scenarios)

A scenario is a matrix, not a single run.

  1 scenario × N harnesses × 2 personas = 2N evaluations.

- A scenario declares `harnesses[]` in `scenario.json`.
- For every entry there, the (scenario, harness) pair is its own unit of ownership: it has its own `prompts/baseline.md` and `prompts/informed.md`, and may have its own `init/` (seed data) and `install.sh` (build-time tools).
- `init/`, `assertions/`, `supervisord.conf`, and `scenario.json` at the scenario root are shared across all harnesses.

```
scenarios/<id>/
  scenario.json                     # declares harnesses[]
  supervisord.conf                  # services (shared)
  init/                             # shared seed data
  assertions/                       # shared gates
  harnesses/<harness-id>/
    prompts/{baseline,informed}.md  # required per pair
    init/                           # optional; only this pair
    install.sh                      # optional; only this pair
```

When the user describes a task, decide first: is this one harness or a comparison across harnesses? That choice determines how many prompt sets you write.

Why prompts and init can differ per harness:

- Prompts diverge to control whether the agent reaches for a specific tool. The baseline tests whether the agent picks the tool unprompted; an informed prompt that names the tool tests how well the agent uses the tool when told to. Different harnesses ship different tools, so informed prompts usually name different tools per harness.
- Init diverges when harnesses need different starting infrastructure (e.g. a scaffolded Moose project for `olap-for-swe` vs a scaffolded dbt project for `classic-de`) so each harness boots into the state its tools expect.

The `dec-bench-create-scenario` skill expands on this and is the right next read for any scenario authoring task.

## Embedded skills

Skills are checked into this repo. They auto-load when a user opens the repo with their agent. No `npx skills add` step is required.

| User intent | Skill | Path |
|-------------|-------|------|
| "Get started", "install", "set up", "first run" | `dec-bench-quickstart` | `.agents/skills/dec-bench-quickstart/SKILL.md` |
| "Run scenario", "run eval", "benchmark", "compare agents" | `dec-bench-run` | `.agents/skills/dec-bench-run/SKILL.md` |
| "Create scenario", "new scenario", "add eval", "write a benchmark for" | `dec-bench-create-scenario` | `.agents/skills/dec-bench-create-scenario/SKILL.md` |
| "Test a local moose-cli / ClickHouse / skill build before release" | `dec-bench-local-override` | `.agents/skills/dec-bench-local-override/SKILL.md` |

**Claude Code** auto-loads from `.claude/skills/` (mirrors of the same content kept in sync via `tools/sync-skills.sh`).

**Codex and Cursor** read this `AGENTS.md` natively. When the user's intent matches a row above, read the linked `SKILL.md` and follow it.

If you edit any file under `.agents/skills/dec-bench-*`, run `tools/sync-skills.sh` to refresh `.claude/skills/`. The script is idempotent.

## Linear Defaults

- **Team:** Fiveonefour
- **Project:** DecBench 0.2: enable 514 comparisons

## Conventions

- Before starting substantive work on a tracked issue, move it to `In Progress` in Linear.
- Issues follow the delegation contract format: Context, Goal, Scope, Acceptance Criteria, Key Files, Out of Scope, Relevant Skills.
- Estimates use T-shirt sizes (XS=1, S=2, M=3, L=5, XL=8) set on the Linear `estimate` field, not in the description body.
- The Out of Scope section is required on every issue. Do not skip it.

## Global Skills

These are available via the `ai-dev-skills` plugin:

- **ai-process** -- Issue creation, feedback triage, phase identification (Explore/Scope/Build-Feedback Loop)
- **project-audit** -- Audit Linear projects for convention compliance
- **linear-projects** -- Create and manage Linear projects, specs, milestones, status updates
- **zinsser-writing** -- Clear, concise nonfiction prose (Zinsser method)
- **schwartz-copy** -- High-converting digital copy (Schwartz framework)
- **frontend-design** -- Distinctive, production-grade frontend interfaces
