import { TocGrid } from "../marketing/toc-grid";

const tocEntries = [
  { id: "introduction", number: 1, label: "Five-Gate Evaluation Model" },
  { id: "evaluation-design", number: 2, label: "Evaluation Variables" },
  { id: "scenarios", number: 3, label: "Scenarios" },
  { id: "comparative-results", number: 4, label: "Comparative Results" },
  { id: "infrastructure", number: 5, label: "Infrastructure" },
  { id: "limitations", number: 6, label: "Limitations" },
  { id: "open-benchmark", number: 7, label: "Open Benchmark" },
  { id: "evaluation-access", number: 8, label: "Evaluation Access" },
];

export function AbstractSection() {
  return (
    <section id="abstract" className="py-8 border-t border-[color:var(--secondary)] flex flex-col gap-10">
      <div>
        <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] block mb-4">
          Abstract
        </span>
        <div className="border-l-4 border-[color:var(--accent)] pl-6 flex flex-col gap-3">
          <div className="font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)] space-y-4">
            <p>
              Existing benchmarks for AI coding agents evaluate predominantly on
              software engineering tasks: patch generation, bug resolution, and UI
              implementation. Data engineering requires a different set of
              competencies. Building and maintaining data pipelines involves schema
              design, pipeline orchestration, streaming integration, query
              optimization, and data quality validation, often across multiple
              database systems within a single workflow.
            </p>
            <p>
              DEC Bench is an open evaluation framework that scores AI coding
              agents on realistic data engineering scenarios. Each scenario runs
              against real infrastructure (Postgres, ClickHouse, Redpanda) inside
              isolated Docker containers, and agent output is validated against
              five sequential quality gates. The gates are ordered by increasing
              rigor: from &ldquo;the code runs&rdquo; to &ldquo;you would ship
              this.&rdquo; This sequential structure produces gate attrition curves
              that expose not just whether an agent succeeds, but where and how it
              falls off.
            </p>
            <p>
              The benchmark is designed as an experiment with three independent
              variables (the agent, the tooling harness, and the prompt variant)
              and two dependent variables (quality and efficiency). This structure
              allows direct comparison: does a better harness improve outcomes?
              Does domain knowledge in the prompt matter? What does quality cost?
            </p>
          </div>
          <div className="h-1" />
        </div>
      </div>

      <div>
        <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] block mb-4">
          Contents
        </span>
        <TocGrid entries={tocEntries} />
      </div>
    </section>
  );
}
