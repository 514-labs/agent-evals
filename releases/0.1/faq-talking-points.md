# FAQ and Talking Points

Reusable answers for HN, Reddit, X, and direct outreach during the research preview.

## What is DEC Bench?

An open-source benchmark that tests how well AI coding agents handle real data engineering work. It runs real infrastructure (Postgres, Redpanda, ClickHouse), gives agents actual tasks (ingest CSV files, fix broken connections, optimize queries), and scores results through five sequential gates.

## Why data engineering?

Existing benchmarks test coding agents on general SWE tasks. Nobody tests whether they can build a pipeline, tune a query, or debug a broken connection string against real databases. Data engineering is where agents hit real-world complexity: schema design, distributed systems, fault tolerance, performance tuning.

## How does scoring work?

Five gates, evaluated in order: Functional, Correct, Robust, Performant, Production. A run must clear each gate before advancing. The score reflects how far the agent got and how many assertions it passed within its highest gate. Failed runs cannot look like perfect runs.

## What agents does it support?

Claude Code, Codex, and Cursor out of the box. Adding a custom agent takes one shell script. The benchmark is agent-agnostic by design.

## What are harnesses?

Harnesses define the tooling environment. Base RT is the control group (just the databases). Classic DE adds Airflow, Spark, and dbt. OLAP for SWE adds MooseStack. Running the same scenario across different harnesses measures whether tooling helps agents perform better.

## Is this production-ready?

No. This is a research preview (v0.1). We shipped it to get feedback on methodology, scenarios, and scoring. Use it to evaluate agents and share what feels rough.

## How is this different from SWE-bench?

SWE-bench tests general software engineering (bug fixes, feature additions in Python repos). DEC Bench tests data engineering specifically: schema design, query optimization, streaming pipelines, cross-database operations, real infrastructure. The two are complementary, not competing.

## How is cost calculated?

Claude Code reports dollar cost directly from its CLI. For Codex and Cursor, we derive cost from token usage and published per-token rates. Every run stores `llmApiCostSource` so you know exactly where the number came from.

## Can I add my own scenarios?

Yes. `dec-bench create` scaffolds a new scenario. Write the prompt, assertions, and init scripts. `dec-bench validate` checks the structure before you build. See the authoring guide in the docs.

## What infrastructure does it run?

Postgres (OLTP), Redpanda (streaming), ClickHouse (OLAP). All real, running in Docker. No mocks.

## Do I need Docker?

Yes. The CLI orchestrates Docker containers. The eval runs inside the container with full access to the infrastructure stack.

## What's next?

More domains beyond Foo Bar (e-commerce, B2B SaaS, advertising). More harnesses. Tighter scoring for edge cases. Community-contributed scenarios. The roadmap is shaped by what we learn from this preview.

---

## Response Templates

### "Is this just a Docker wrapper?"

No. The Docker container is the runtime, but the product is the evaluation framework: five-gate scoring, deterministic assertions against real databases, side-by-side agent comparison, and a full audit trail for every run.

### "Why not just use SWE-bench?"

SWE-bench is great for general coding. DEC Bench fills a different gap: data engineering tasks that require schema design, distributed systems thinking, and working against real database infrastructure. They measure different competencies.

### "The scores seem low / high / wrong"

Scores are gate-banded. A score of 0.35 means the agent cleared the first gate and passed some assertions in the second. A score of 0.95 means it cleared four of five gates and nearly passed the fifth. The audit view shows exactly which assertions passed and failed.

### "Why only three agents?"

We started with the three most accessible coding agent CLIs. Adding an agent takes one shell script. We welcome contributions for other agents.
