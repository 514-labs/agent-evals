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
        4.1 Scenario Definition
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
        4.2 Execution Protocol and Infrastructure
      </h3>
      <p className="mt-2 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        A run pairs one agent, one tooling harness, and one prompt variant
        against one scenario. The agent operates autonomously: it may invoke
        tools, write code, query databases, and iterate, but there is no
        conversational back-and-forth with a human. All scenarios run against
        real, fully containerized infrastructure:
      </p>

      {/* Infrastructure table (desktop) */}
      <div className="mt-4 border-b border-[color:var(--sidebar)] hidden sm:block">
        <div className="flex border-b border-[color:var(--sidebar)]">
          {[
            { name: "POSTGRES", logo: "/logos/postgres.svg", description: "Transactional source of truth. Schema migrations, foreign keys, constraints." },
            { name: "CLICKHOUSE", logo: "/logos/clickhouse.svg", description: "Columnar analytics engine. Materialized views, partition keys, ORDER BY optimization." },
            { name: "REDPANDA", logo: "/logos/redpanda.svg", description: "Kafka-compatible event streaming. Topics, consumers, partitions." },
          ].map((item) => (
            <div key={item.name} className="flex-1 flex items-center gap-2.5 px-4 py-3">
              <div className="size-6 flex items-center justify-center bg-white/95 border border-white rounded-sm overflow-hidden">
                <img src={item.logo} alt={item.name} width={18} height={18} className="object-contain" />
              </div>
              <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)]">
                {item.name}
              </span>
            </div>
          ))}
        </div>
        <div className="flex">
          {[
            "Transactional source of truth. Schema migrations, foreign keys, constraints.",
            "Columnar analytics engine. Materialized views, partition keys, ORDER BY optimization.",
            "Kafka-compatible event streaming. Topics, consumers, partitions.",
          ].map((desc) => (
            <div key={desc} className="flex-1 px-4 py-3">
              <p className="font-[family-name:var(--font-display)] text-xs leading-normal text-[color:var(--muted-foreground)]">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Infrastructure table (mobile) */}
      <div className="mt-4 sm:hidden">
        {[
          { name: "POSTGRES", logo: "/logos/postgres.svg", description: "Transactional source of truth. Schema migrations, foreign keys, constraints." },
          { name: "CLICKHOUSE", logo: "/logos/clickhouse.svg", description: "Columnar analytics engine. Materialized views, partition keys, ORDER BY optimization." },
          { name: "REDPANDA", logo: "/logos/redpanda.svg", description: "Kafka-compatible event streaming. Topics, consumers, partitions." },
        ].map((item) => (
          <div key={item.name} className="border-b border-[color:var(--sidebar)] py-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="size-6 flex items-center justify-center bg-white/95 border border-white rounded-sm overflow-hidden">
                <img src={item.logo} alt={item.name} width={18} height={18} className="object-contain" />
              </div>
              <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)]">
                {item.name}
              </span>
            </div>
            <p className="font-[family-name:var(--font-display)] text-xs leading-normal text-[color:var(--muted-foreground)]">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        Every run produces a full structured trace: each reasoning step, tool
        call (shell commands, file edits, SQL queries), tool result, token
        count, and wall-clock timing is recorded and persisted alongside the
        scored result. These traces are the primary artifact for comparing how
        different agents approach the same task.
      </p>

      <h3 className="mt-10 font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
        4.3 Evaluation Procedure
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
        4.4 Scoring Function
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
