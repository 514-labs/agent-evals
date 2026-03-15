# Research Preview Feedback Triage

Feedback collected from CTO review, internal runs, and early testing.

## Research Preview Blockers (resolved)

All CTO feedback blockers have been fixed and shipped.

| Item | Issue | Status | Resolution |
|------|-------|--------|------------|
| Leaderboard shows 1.00 for failed runs | 514-758 | Done | Gate-aware banded `calcNormalizedScore` in eval-core. PR #20 merged. |
| First-run docs miss clone/Docker/API key prereqs | 514-761 | Done | Docs updated with prerequisites, real `run-id` flow. PR #20 merged. |
| Empty audit page looks broken | 514-756 | In Review | Actionable empty state with CLI examples and docs link. PR #22. |
| CLI fails cryptically outside repo or without Docker | 514-760 | In Review | Shared preflight module with recovery-oriented errors. PR #22. |
| Cost/time rendering crashes on null values | 514-759 | In Review | Null-safe formatting with "—" placeholder. Agent/harness filter chips. PR #22. |
| Agent/harness extensibility not discoverable | 514-757 | In Review | Harnesses table and extension guides in supported-agents docs. PR #22. |

## Must-Fix (in progress)

| Item | Issue | Status | Owner |
|------|-------|--------|-------|
| Leaderboard has no real multi-agent comparison data | 514-762 | Backlog | Evals plan (blocked on 514-737) |
| Full scenario matrix not yet run | 514-737 | In Progress | Evals plan |

## Deferred (post-preview)

| Item | Reason | Follow-up |
|------|--------|-----------|
| Orchestration competency scenarios | No implemented scenarios yet; registry-only | v0.2 target |
| Security/governance competency scenarios | No implemented scenarios yet; registry-only | v0.2 target |
| `olap-for-swe` harness has never been tested in bulk | Requires eval runs to land first | After 514-737 |
| Network policy enforcement in harnesses | All harnesses currently "open" | v0.2 |
| Long-context pricing multiplier in leaderboard display | Only affects gpt-5.4 runs over 272k tokens | Post-preview polish |
| Interactive comparison in audit view (drag-to-compare) | Nice to have, not blocking | v0.2 |
| Per-scenario cost breakdown charts | Needs more data variety first | v0.2 |
