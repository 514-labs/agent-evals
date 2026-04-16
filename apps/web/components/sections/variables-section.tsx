import Link from "next/link";
import { SectionHeading } from "../marketing/section-heading";
import { CardStack } from "../marketing/card-stack";
import { FiveGates } from "../marketing/five-gates";
import { SideNote } from "../marketing/side-note";

const variables = [
  {
    number: "01",
    title: "Agent",
    body: "The AI coding tool being evaluated. The current evaluation includes Claude Code (Opus 4.6, Sonnet 4.6), Codex (GPT-5.4), and Cursor (Composer 2).",
  },
  {
    number: "02",
    title: "Tooling Harness",
    body: "The tooling environment the agent works in. Three configurations are tested. Base infrastructure provides Postgres, ClickHouse, and Redpanda without additional tooling, measuring the agent\u2019s first-principles reasoning. Classic DE adds dbt, Airflow, and Spark, representing traditional data engineering stacks. OLAP for SWE adds MooseStack with typed schemas and auto migrations, representing modern analytical tooling.",
  },
  {
    number: "03",
    title: "Prompt Variant",
    body: "How much domain knowledge the prompt provides. Each scenario has two conditions. The baseline prompt gives minimal context: no tool names, no implementation hints, and the agent figures out the approach on its own. The informed prompt provides domain-specific guidance: it names tools, specifies targets, and sets technical constraints.",
  },
];

const difficultyTiers = [
  {
    number: "T1",
    title: "Focused",
    body: "One narrowly scoped task with minimal moving parts. Typically a single service, 3\u20135 assertions per gate. Tests whether the agent can diagnose and fix a specific problem in isolation. Example: fix a broken Postgres connection, optimize a ClickHouse ORDER BY key.",
  },
  {
    number: "T2",
    title: "Moderate",
    body: "Requires design judgment or cross-service coordination. One or two services, 5\u201310 assertions per gate. The agent must make meaningful architectural decisions\u2014choosing schemas, wiring pipelines, or handling state across systems. Example: build an ingestion pipeline with schema validation and idempotent reruns.",
  },
  {
    number: "T3",
    title: "Complex",
    body: "End-to-end system reasoning under production-grade constraints. Two or more services, 10+ assertions per gate. Multiple interacting failure modes that demand the agent understand how systems compose. Example: debug a broken ELT pipeline spanning Postgres, Redpanda, and ClickHouse with latency targets.",
  },
];

const scenarios = [
  { id: 1, name: "Broken Connection", tier: "T1", services: "Postgres", category: "Debugging" },
  { id: 2, name: "CSV Ingest", tier: "T1", services: "ClickHouse", category: "Ingestion" },
  { id: 3, name: "Stream to OLAP", tier: "T2", services: "Redpanda, ClickHouse", category: "Ingestion" },
  { id: 4, name: "Cross-System Reconciliation", tier: "T3", services: "Postgres, Redpanda, ClickHouse", category: "Debugging" },
];

export function VariablesSection() {
  return (
    <section id="evaluation-design" className="pt-10">
      <div className="pt-10">
        <SectionHeading number={2} title="Evaluation Variables" />

        <p className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          Each benchmark run has three independent variables: the agent, the
          tooling harness, and the prompt variant. The full evaluation matrix
          captures every combination to isolate the effect of each. The dependent
          variables are quality and efficiency. Quality is captured as gate
          progression (which of the five gates the agent cleared) and normalized
          score. Efficiency is captured as token usage and LLM API cost, and time
          taken.
        </p>

        <div className="mt-8 relative">
          <CardStack items={variables} />
          <SideNote>
            0.1-preview includes only a basic tooling harness and
            baseline prompts. Integrated harnesses and informed prompt
            variants are planned for future releases.
          </SideNote>
        </div>
      </div>

      <div id="scenarios" className="pt-10">
        <SectionHeading number={3} title="Scenarios" />

        <div className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)] space-y-4">
          <p>
            A scenario is a self-contained data engineering task. Each scenario
            defines its own infrastructure, seed data, starting state, and
            deterministic assertions. Scenarios span the Foo Bar synthetic SaaS
            analytics domain, covering ingestion, transformation, query
            optimization, schema design, streaming pipelines, storage
            optimization, and cross-system reconciliation.
          </p>
          <p>
            Each scenario is assigned a difficulty tier based on the scope of
            infrastructure, number of tasks, and depth of reasoning required.
          </p>
        </div>

        <div className="mt-8 relative">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
            Difficulty Tiers
          </h3>
        </div>
        <div className="mt-3 relative">
          <CardStack items={difficultyTiers} />
          {/* TODO: Uncomment when /docs/evals/difficulty-tiers is added to PUBLISHED_SLUGS in lib/published-docs.ts
          <SideNote>
            <Link
              href="/docs/evals/difficulty-tiers"
              className="underline hover:text-[color:var(--foreground)] transition-colors"
            >
              Read more about tiers and gate interaction
            </Link>
          </SideNote>
          */}
        </div>

        <div className="mt-8">
          <FiveGates headerPrefix="Difficulty Tier" gates={[
            {
              number: "1",
              name: "FOCUSED",
              description: "The agent diagnoses and fixes a single, narrowly scoped problem.",
              bullets: [
                "One task, minimal moving parts",
                "3\u20135 assertions per gate",
                "e.g. fix a broken Postgres connection, optimize a ClickHouse ORDER BY key",
              ],
            },
            {
              number: "2",
              name: "MODERATE",
              description: "The agent must make meaningful architectural or design decisions.",
              bullets: [
                "Multiple tasks, or cross-service coordination",
                "5\u201310 assertions per gate",
                "e.g. build an ingestion pipeline with schema validation and idempotent reruns",
              ],
            },
            {
              number: "3",
              name: "COMPLEX",
              description: "Multiple interacting failure modes that demand the agent understand how systems compose.",
              bullets: [
                "Failures propagate across system boundaries",
                "10+ assertions per gate",
                "e.g. debug a broken ELT pipeline spanning Postgres, Redpanda, and ClickHouse",
              ],
            },
          ]} />
        </div>

        <div className="mt-10 relative">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[color:var(--foreground)]">
            Example Scenarios
          </h3>
          <SideNote>
            The full benchmark includes 38 scenarios: 14 Tier 1 (single-service,
            isolated tasks), 19 Tier 2 (multi-service or moderate design
            decisions), and 5 Tier 3 (cross-service orchestration with
            production-grade constraints).
          </SideNote>
        </div>
        <div className="mt-3 overflow-x-auto">
          <div className="flex items-center h-[37px] border-b border-[color:var(--border)] min-w-[540px]">
            <div className="px-3 shrink-0">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)] leading-none">#</span>
            </div>
            <div className="px-3 w-[200px] shrink-0">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)] leading-none">Scenario</span>
            </div>
            <div className="flex-1 px-3">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)] leading-none whitespace-nowrap">Difficulty Tier</span>
            </div>
            <div className="flex-1 px-3">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)] leading-none">Services</span>
            </div>
            <div className="flex-1 px-3">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)] leading-none">Category</span>
            </div>
          </div>
          {scenarios.map((s) => (
            <div key={s.id} className="flex items-center border-b border-[color:var(--border)] min-w-[540px]">
              <div className="px-3 py-[12px] shrink-0">
                <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)] leading-none">{s.id}</span>
              </div>
              <div className="px-3 py-[12px] w-[200px] shrink-0">
                <span className="font-[family-name:var(--font-display)] text-[14px] font-bold text-[color:var(--muted-foreground)] leading-normal">{s.name}</span>
              </div>
              <div className="flex-1 px-3 py-[12px]">
                <span className="font-[family-name:var(--font-display)] text-[12px] text-[color:var(--muted-foreground)] leading-normal">{s.tier}</span>
              </div>
              <div className="flex-1 px-3 py-[12px]">
                <span className="font-[family-name:var(--font-display)] text-[12px] text-[color:var(--muted-foreground)] leading-normal">{s.services}</span>
              </div>
              <div className="flex-1 px-3 py-[12px]">
                <span className="font-[family-name:var(--font-display)] text-[12px] text-[color:var(--muted-foreground)] leading-normal">{s.category}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Link
            href="/docs"
            className="paper-btn paper-btn-primary px-4 py-2 font-[family-name:var(--font-display)] text-[11px] font-bold"
          >
            View all Scenarios
          </Link>
        </div>
      </div>
    </section>
  );
}
