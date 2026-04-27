import Link from "next/link";
import { TocGrid } from "../marketing/toc-grid";
import { computeAbstractStats } from "../charts/aggregate";
import { getLeaderboardEntries } from "@/data/results";

function Cite({ n }: { n: number }) {
  return (
    <Link
      href={`#ref-${n}`}
      className="text-[color:var(--accent)] hover:text-[color:var(--foreground)] transition-colors no-underline"
      title={`See reference ${n}`}
    >
      <sup className="font-[family-name:var(--font-mono)] text-[9px] font-bold">[{n}]</sup>
    </Link>
  );
}

function formatP(p: number): string {
  if (p < 0.001) return "0.001";
  return p.toFixed(2);
}

function formatCost(v: number): string {
  return v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(2)}`;
}

const tocEntries = [
  { id: "introduction", number: 1, label: "Five-Gate Evaluation Model" },
  { id: "evaluation-design", number: 2, label: "Evaluation Variables" },
  { id: "scenarios", number: 3, label: "Scenarios" },
  { id: "methodology", number: 4, label: "Methodology" },
  { id: "comparative-results", number: 5, label: "Comparative Results" },
  { id: "limitations", number: 6, label: "Limitations" },
  { id: "evaluation-access", number: 7, label: "Evaluation Access" },
];

export function AbstractSection() {
  const stats = computeAbstractStats(getLeaderboardEntries());

  return (
    <section id="abstract" className="py-8 border-t border-[color:var(--sidebar)] flex flex-col gap-10">
      <div>
        <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] block mb-4">
          Abstract
        </span>
        <div className="border-l-4 border-[color:var(--accent)] pl-6 flex flex-col gap-3">
          <div className="font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)] space-y-4">
            <p>
              Benchmarks like SWE-bench<Cite n={1} /> have set the standard for
              evaluating AI coding agents on software engineering tasks: patch
              generation, bug resolution, and repository-level reasoning. Early
              work on data engineering evaluation, including
              DE-Bench<Cite n={2} /> and dbt Labs&rsquo;
              skill-eval<Cite n={3} />, has begun to extend this coverage to
              schema design and transformation tasks. But data engineering
              requires a broader set of competencies: pipeline orchestration,
              streaming integration, query optimization, and data quality
              validation, often across multiple database systems within a single
              workflow.
            </p>
            <p>
              DEC Bench is an open evaluation framework that scores AI coding
              agents on <Link href="#scenarios" className="text-[color:var(--accent)] hover:text-[color:var(--foreground)] transition-colors underline underline-offset-2">realistic data engineering scenarios</Link>. Each scenario runs
              against real infrastructure: OLTP (Postgres), OLAP
              (ClickHouse), and streaming (Redpanda), all inside
              isolated Docker containers, and agent output is validated against{" "}
              <Link href="#introduction" className="text-[color:var(--accent)] hover:text-[color:var(--foreground)] transition-colors underline underline-offset-2">five sequential quality gates</Link>. The gates are ordered by increasing
              rigor: from &ldquo;the code runs&rdquo; to &ldquo;you would ship
              this.&rdquo; This sequential structure produces gate attrition curves
              that expose not just whether an agent succeeds, but where and how it
              falls off.
            </p>
            <p>
              The benchmark is designed as an experiment with three independent
              variables (the agent, the tooling harness, and the prompt variant)
              and two dependent variables (quality and efficiency).
            </p>
            <p>
              Across {stats.totalRuns} preliminary runs, three findings stand
              out. First, agent choice only becomes statistically significant
              on hard scenarios, where the highest- and lowest-scoring agents
              differ by {stats.hardSpreadPp} percentage points
              (p&thinsp;&lt;&thinsp;{formatP(stats.agentHardP)})
              <Cite n={4} />. Second, the basic tooling harness tested so
              far does not show a statistically significant effect
              (p&thinsp;=&thinsp;{formatP(stats.harnessLiftP)})
              <Cite n={4} />. Third, while {stats.g1PassRate}% of runs
              clear the first quality gate, the highest-scoring agent still
              only clears the hardest gate {stats.g5BestRate}% of the time.
            </p>
            <p>
              These results are preliminary: sample sizes are small, only one harness
              configuration has been tested, prompt personas beyond the
              baseline have not yet been evaluated, and agent capabilities
              shift with each model update.
              See <Link href="#limitations" className="text-[color:var(--accent)] hover:text-[color:var(--foreground)] transition-colors underline underline-offset-2">Limitations</Link> for
              details.
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
