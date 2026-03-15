# Channel Distribution Copy

Update the placeholder results with real numbers once eval runs complete.

---

## X / Twitter Thread

**Tweet 1:**
We built an open-source benchmark that tests AI coding agents on real data engineering work.

Not toy problems. Real Postgres, Redpanda, and ClickHouse. Real schema design, query optimization, pipeline debugging.

DEC Bench 0.1 is live as a research preview.

https://github.com/514-labs/agent-evals

**Tweet 2:**
How it works:

1. Pick a scenario (37 available)
2. Choose an agent (Claude Code, Codex, or Cursor)
3. Run it against real databases in Docker
4. Five gates score the result: Functional → Correct → Robust → Performant → Production

No LLM-as-judge. Deterministic assertions against actual database state.

**Tweet 3:**
What we've seen so far:

Agents clear the first two gates (it runs, answers are correct) on most scenarios. Gates 3-5 (fault tolerance, performance, production readiness) are where they struggle.

The same scenario across different tool harnesses shows measurable differences.

**Tweet 4:**
It's open source and extensible:

- Add a custom agent with one shell script
- Add a harness by defining tools in JSON
- Scaffold a new scenario with `dec-bench create`

Install in one line:
```
curl -fsSL https://decbench.ai/install.sh | sh
```

---

## Reddit: r/dataengineering

**Title:** We built an open-source benchmark for AI agents doing data engineering (DEC Bench)

**Body:**

We've been working on DEC Bench -- an open-source benchmark that tests how well AI coding agents handle real data engineering tasks.

The setup: Postgres, Redpanda, ClickHouse running in Docker. Real schemas, real data, real queries. The agent gets a prompt describing a problem (fix this broken connection, ingest these CSVs, optimize these slow queries) and works against live infrastructure.

Scoring uses five sequential gates: Functional, Correct, Robust, Performant, Production. Each gate checks deterministic assertions against the actual database state. A run must clear each gate before advancing to the next.

v0.1 has 37 scenarios in the "Foo Bar" domain (a fictional SaaS analytics platform). Three agents supported: Claude Code, Codex, Cursor. Three harness configurations: bare infrastructure, classic DE stack (Airflow/Spark/dbt), and a SWE-first framework (MooseStack).

It's a research preview. We shipped it to get feedback on whether the methodology is sound and where the scenarios need work.

Install: `curl -fsSL https://decbench.ai/install.sh | sh`
Repo: https://github.com/514-labs/agent-evals
Docs: https://decbench.ai/docs

Would love feedback from anyone who works in data engineering -- especially on whether the scenarios feel realistic and whether the scoring captures what matters.

---

## Reddit: r/programming

**Title:** DEC Bench: open-source benchmark testing AI agents on data engineering tasks against real databases

**Body:**

We released DEC Bench 0.1 as a research preview. It benchmarks AI coding agents on data engineering work using real infrastructure (Postgres, Redpanda, ClickHouse) instead of mocks.

Each scenario gives the agent a concrete task: fix a misconfigured connection, ingest messy CSVs, optimize slow analytical queries, build an end-to-end pipeline. Scoring is deterministic -- five sequential gates with assertions checked against actual database state.

Three agents supported out of the box (Claude Code, Codex, Cursor), with a one-script path for adding your own. Three harness configurations let you compare how agents perform with different tooling (bare infra vs. Airflow/Spark/dbt vs. a unified framework).

CLI-first workflow. Everything runs locally in Docker.

Repo: https://github.com/514-labs/agent-evals

---

## Reddit: r/MachineLearning

**Title:** [P] DEC Bench -- benchmarking coding agents on real data engineering tasks

**Body:**

We built DEC Bench to fill a gap in agent evaluation: data engineering competency.

Existing benchmarks (SWE-bench, DS-1000) test general coding or data science. DEC Bench tests whether agents can handle the operational side: schema design, distributed systems debugging, query optimization, streaming pipelines, and cross-database operations.

The evaluation uses five sequential gates (Functional → Correct → Robust → Performant → Production) with deterministic assertions against live databases (Postgres, Redpanda, ClickHouse). Each gate must be cleared before the next is evaluated.

v0.1 includes 37 scenarios, three agent runners (Claude Code, Codex, Cursor), and three harness configurations that let you control what tools the agent has access to.

Research preview. We're sharing early to get feedback on methodology and scoring.

Paper/docs: https://decbench.ai/docs
Code: https://github.com/514-labs/agent-evals

---

## Newsletter Pitch (Data Engineering Weekly, TLDR)

**Subject:** DEC Bench: open-source data engineering benchmark for AI agents

**Body:**

DEC Bench is a new open-source benchmark that evaluates AI coding agents on real data engineering tasks. Instead of testing general coding ability, it focuses on schema design, query optimization, pipeline construction, and infrastructure debugging against live Postgres, Redpanda, and ClickHouse.

Key details:
- 37 scenarios covering ingestion, transformation, debugging, and end-to-end pipeline construction
- Five-gate scoring model: Functional, Correct, Robust, Performant, Production
- Deterministic assertions against actual database state (no LLM-as-judge)
- Supports Claude Code, Codex, and Cursor out of the box
- Three harness configurations for comparing how tooling affects agent performance
- CLI-first workflow, runs locally in Docker

It's a research preview (v0.1). The team is looking for feedback on methodology and scenario design from the data engineering community.

Link: https://github.com/514-labs/agent-evals
Docs: https://decbench.ai

---

## Slack / Discord Communities

```
DEC Bench 0.1 is live as a research preview.

It's an open-source benchmark that tests AI coding agents on real data engineering tasks -- schema design, query optimization, pipeline debugging -- against live Postgres, Redpanda, and ClickHouse.

37 scenarios, 3 agents (Claude Code / Codex / Cursor), 5-gate scoring.

Install: curl -fsSL https://decbench.ai/install.sh | sh
Repo: https://github.com/514-labs/agent-evals

Would appreciate feedback from anyone working with coding agents or data engineering.
```
