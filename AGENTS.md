# DEC Bench

DEC Bench is an open-source benchmark for evaluating AI agents on real-world data engineering tasks. Monorepo containing a Rust CLI, Next.js marketing site with leaderboard and audit tools, and a TypeScript scoring framework.

## When to use which skill

| User intent | Skill | Install |
|-------------|-------|---------|
| "Get started", "install", "set up", "first run" | `dec-bench-quickstart` | `npx skills add 514-labs/agent-evals --skill dec-bench-quickstart` |
| "Run scenario", "run eval", "benchmark", "compare agents" | `dec-bench-run` | `npx skills add 514-labs/agent-evals --skill dec-bench-run` |
| "Create scenario", "new scenario", "add eval", "write a benchmark for" | `dec-bench-create-scenario` | `npx skills add 514-labs/agent-evals --skill dec-bench-create-scenario` |

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
