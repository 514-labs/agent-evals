import Link from "next/link";
import { SectionHeading } from "../marketing/section-heading";

export function MethodologySection() {
  return (
    <section id="methodology" className="pt-10">
      <SectionHeading number={4} title="Methodology" />

      <p className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        Each benchmark run is a controlled experiment: one agent attempts one
        scenario under fixed conditions, and every action it takes is recorded.
      </p>

      <h3 className="mt-10 font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
        Scenario Definition
      </h3>
      <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        Each scenario is a self-contained data engineering task. The agent
        starts inside an isolated Docker container with live infrastructure
        already running: databases with tables, streams with topics, seed
        data loaded. It receives a single natural-language prompt describing
        what to build or fix, and a set of TypeScript assertion functions
        that define success.
      </p>

      <h3 className="mt-10 font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
        Execution Protocol
      </h3>
      <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        A run pairs one agent, one tooling harness, and one prompt variant
        against one scenario. The agent operates autonomously: it may invoke
        tools, write code, query databases, and iterate, but there is no
        conversational back-and-forth with a human. Every run produces a
        full structured trace: each reasoning step, tool call (shell
        commands, file edits, SQL queries), tool result, token count, and
        wall-clock timing is recorded and persisted alongside the scored
        result. These traces are the primary artifact for comparing how
        different agents approach the same task.
      </p>

      <h3 className="mt-10 font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
        Evaluation Procedure
      </h3>
      <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        Gates are evaluated sequentially. Each gate contains two kinds of
        assertions: core checks shared across all scenarios (e.g. clean
        process exit, no credentials in committed code) that must all pass,
        and scenario-specific checks (e.g. query returns correct aggregates,
        data flows end-to-end across systems) graded as a group with a pass
        threshold of 80%. A gate clears only when both conditions are met.
      </p>

      <h3 className="mt-10 font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
        Scoring Function
      </h3>
      <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        The normalized score is a step function with partial credit at the
        failure boundary. Fully cleared gates contribute equally; the first
        failed gate contributes its scenario-check pass rate as a fraction
        of one gate. The result is scaled to 0{"\u2013"}1, so an agent that
        clears three of five gates and passes 60% of the fourth scores
        0.72.
      </p>

      <div className="mt-4">
        <Link
          href="https://github.com/514-labs/dec-bench"
          target="_blank"
          rel="noopener noreferrer"
          className="paper-btn paper-btn-primary px-4 py-2 font-[family-name:var(--font-display)] text-[11px] font-bold"
        >
          View Repository
        </Link>
      </div>
    </section>
  );
}
