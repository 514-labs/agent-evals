import Link from "next/link";
import { Nav } from "../components/nav";
import { Footer } from "../components/footer";
import { getLeaderboardEntries, type LeaderboardEntry } from "@/data/results";

const gates = [
  { number: "01", name: "FUNCTIONAL", short: "it runs", description: "Output executes without errors" },
  { number: "02", name: "CORRECT", short: "right answers", description: "Produces expected output on all test cases" },
  { number: "03", name: "ROBUST", short: "edge cases", description: "Handles errors and boundary conditions" },
  { number: "04", name: "PERFORMANT", short: "fast enough", description: "Meets latency and throughput targets" },
  { number: "05", name: "PRODUCTION", short: "you'd ship it", description: "Code quality and safety fit for release" },
];

const gateHeaderColors = [
  "bg-[#B91C1C] text-white",
  "bg-[#78716C] text-white",
  "bg-[#A8A29E] text-white",
  "bg-[#D6D3D1] text-[#1C1917]",
  "bg-[#E8E5E0] text-[#57534E]",
];

const scenarios = [
  { id: "01", title: "CSV Ingest", competency: "Ingestion", services: ["ClickHouse"], state: "build" },
  { id: "02", title: "Table Layout", competency: "Schema Design", services: ["ClickHouse"], state: "build" },
  { id: "03", title: "Slow Queries", competency: "Query Optimization", services: ["ClickHouse"], state: "fix" },
  { id: "04", title: "Broken Connection", competency: "Debugging", services: ["Postgres"], state: "fix" },
  { id: "05", title: "Transform Chain", competency: "Transformation", services: ["Postgres", "ClickHouse"], state: "build" },
  { id: "06", title: "Schema Evolution", competency: "Schema Design", services: ["Postgres", "ClickHouse"], state: "build" },
  { id: "07", title: "Idempotent Pipeline", competency: "Reliability", services: ["Postgres", "ClickHouse"], state: "build" },
  { id: "08", title: "Quality Gate", competency: "Data Quality", services: ["Postgres", "ClickHouse"], state: "fix" },
  { id: "09", title: "Ingest-to-API", competency: "End-to-End", services: ["Postgres", "ClickHouse"], state: "build" },
];

const harnesses = [
  {
    id: "bare",
    name: "Bare",
    label: "CONTROL",
    scaffolding: "Postgres, Redpanda, ClickHouse with Python, Node.js, and database CLIs. No additional frameworks.",
    measures: "First-principles reasoning isolated from tooling advantage",
  },
  {
    id: "classic-de",
    name: "Classic DE",
    label: "CLASSIC",
    scaffolding: "Base infrastructure plus dbt, Airflow, and Spark.",
    measures: "Applied competency with standard data engineering toolkit",
  },
  {
    id: "olap-for-swe",
    name: "OLAP for SWE",
    label: "ANALYTICAL",
    scaffolding: "Base infrastructure plus MooseStack — typed schemas, automated migrations, built-in MCP.",
    measures: "Code-first OLAP framework leverage for performance-sensitive tasks",
  },
];

const infrastructure = [
  { name: "Postgres", role: "Transactional source of truth", detail: "Schema migrations, referential integrity, row-level operations" },
  { name: "Redpanda", role: "High-throughput event streaming", detail: "Topic management, consumer groups, exactly-once delivery" },
  { name: "ClickHouse", role: "Columnar analytics engine", detail: "Materialized views, real-time aggregation, sub-second query latency" },
];

const tocSections = [
  { id: "introduction", label: "Introduction" },
  { id: "evaluation-design", label: "Evaluation Design" },
  { id: "scenarios", label: "Benchmark Scenarios" },
  { id: "harnesses", label: "Evaluation Harnesses" },
  { id: "results", label: "Comparative Results" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "limitations", label: "Limitations" },
  { id: "evaluation-access", label: "Evaluation Access" },
];

const AGENTS = ["codex", "claude-code", "cursor"] as const;
const GATE_LABELS = ["—", "Functional", "Correct", "Robust", "Performant", "Production"];

function formatScore(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(2);
}

function formatTime(s: number | null | undefined): string {
  if (s == null || s === 0) return "—";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatCost(usd: number | null | undefined): string {
  if (usd == null || usd === 0) return "—";
  return `$${usd.toFixed(2)}`;
}

export default function HomePage() {
  const entries = getLeaderboardEntries();
  const bestByAgent = new Map<string, LeaderboardEntry>();
  for (const entry of entries) {
    const existing = bestByAgent.get(entry.agent);
    if (!existing || entry.highest_gate > existing.highest_gate) {
      bestByAgent.set(entry.agent, entry);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F7F3] text-[#1C1917] font-[family-name:var(--font-display)]">

      {/* ── Proceedings Band ── */}
      <div className="border-b border-[#D6D3D1]">
        <div className="max-w-[52rem] mx-auto px-6 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A8A29E]">
            Proceedings of AI Coding Evaluation · March 2026
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A8A29E]">
            Open Access
          </span>
        </div>
      </div>

      <Nav variant="paper" />

      {/* ── Hero ── */}
      <header className="max-w-[52rem] mx-auto px-6 pt-12 pb-8 paper-fade-in">
        <div className="flex gap-2 mb-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B91C1C] border border-[#B91C1C] px-2 py-0.5">
            Research Preview
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#57534E] border border-[#D6D3D1] px-2 py-0.5">
            Benchmark
          </span>
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-[2rem] md:text-[2.75rem] leading-[1.15] tracking-tight">
          DEC Bench: A Multi-Gate Evaluation Framework for AI Coding Agents Tackling{" "}
          <em>Specialized Data Engineering Tasks</em>
        </h1>

        <p className="mt-4 font-[family-name:var(--font-display)] text-base md:text-lg italic text-[#57534E]">
          Deterministic, reproducible evaluation of coding agents across five ordered quality gates
        </p>

        <p className="mt-6 text-xs text-[#57534E]">
          T. Delisle · 514 Labs
        </p>

        {/* Metadata Row */}
        <div className="mt-6 grid grid-cols-3 md:grid-cols-6 border border-[#D6D3D1]">
          {[
            { label: "Published", value: "March 2026" },
            { label: "Version", value: "0.1-preview" },
            { label: "License", value: "MIT" },
            { label: "Scenarios", value: "37" },
            { label: "Harnesses", value: "3" },
            { label: "Agents", value: "3" },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`px-3 py-2 ${i < 3 ? "border-b md:border-b-0" : ""} ${i % 3 !== 2 ? "border-r" : "md:border-r"} last:border-r-0 border-[#D6D3D1]`}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#A8A29E]">{item.label}</p>
              <p className="text-xs mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 paper-fade-in-delayed">
          <Link
            href="/docs/running-evals"
            className="paper-btn paper-btn-primary px-5 py-2 text-[11px] font-bold uppercase tracking-[0.12em]"
          >
            Run the Evaluation
          </Link>
          <Link
            href="/docs"
            className="paper-btn paper-btn-ghost px-5 py-2 text-[11px] font-bold uppercase tracking-[0.12em]"
          >
            Read Methodology
          </Link>
          <a
            href="https://github.com/514-labs/agent-evals"
            target="_blank"
            rel="noopener noreferrer"
            className="paper-btn paper-btn-ghost px-5 py-2 text-[11px] font-bold uppercase tracking-[0.12em]"
          >
            View on GitHub
          </a>
        </div>
      </header>

      <main className="max-w-[52rem] mx-auto px-6">

        {/* ── Abstract ── */}
        <section id="abstract" className="py-8 border-t border-[#D6D3D1]">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A8A29E] block mb-4">
            Abstract
          </span>
          <div className="border-l-4 border-[#B91C1C] pl-6">
            <div className="font-[family-name:var(--font-display)] text-sm italic leading-[1.85] text-[#57534E] space-y-3">
              <p>
                Existing benchmarks for AI coding agents evaluate predominantly on software engineering tasks — patch generation, bug resolution, UI implementation.
              </p>
              <p>
                Data engineering presents a substantially different evaluation challenge. Schema migrations must preserve backward compatibility across versions. Pipelines must orchestrate ingestion, transformation, and delivery across heterogeneous sources. Data quality constraints must be enforced at scale under evolving business logic.
              </p>
              <p>
                These competencies are underrepresented in current evaluation suites, and the benchmarks that do address them [1, 2] measure only functional correctness: does the pipeline run? Does the query return expected results?
              </p>
              <p>
                We introduce DEC Bench, an open benchmark that extends evaluation beyond functional correctness into the quality dimensions that distinguish prototype code from production-grade data engineering. Evaluation follows a deterministic, five-gate quality progression: an agent must first produce functional output, then demonstrate correctness, robustness, performance, and production readiness — in that order. Gates are sequential and strictly ordered; a correct-but-fragile implementation does not score as robust.
              </p>
              <p>
                The benchmark is open source and fully containerized. Each scenario, harness configuration, and evaluation run is distributed as an immutable container image, enabling any researcher to reproduce and compare results across agents, models, and evaluation harnesses.
              </p>
              <p>
                We present initial results for Codex, Claude Code, and Cursor across 37 data engineering scenarios.
              </p>
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-[0.15em] text-[#A8A29E]">
              <span className="font-bold">Keywords:</span>{" "}
              AI agent evaluation · data engineering · multi-gate scoring · benchmark · reproducibility
            </div>
          </div>
        </section>

        {/* ── Table of Contents ── */}
        <nav className="py-8 border-t border-[#D6D3D1]">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A8A29E] block mb-4">
            Contents
          </span>
          <div className="grid md:grid-cols-2 gap-y-2 gap-x-12">
            {tocSections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-baseline text-sm group hover:text-[#B91C1C] transition-colors"
              >
                <span className="text-[#A8A29E] mr-3 shrink-0 tabular-nums">§{i + 1}</span>
                <span className="transition-colors">{s.label}</span>
                <span className="flex-1 mx-2 border-b border-dotted border-[#D6D3D1] translate-y-[-3px]" />
              </a>
            ))}
          </div>
        </nav>


        {/* ════════════════════════════════════════════
            §1 — INTRODUCTION
           ════════════════════════════════════════════ */}
        <section id="introduction" className="pt-12">
          <div className="border-t border-[#D6D3D1] pt-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl md:text-2xl tracking-tight mb-6">
              §1 — Introduction
            </h2>
            <div className="text-sm leading-[1.85] text-[#57534E] space-y-4">
              <p>
                Data engineering has emerged as a critical domain where AI coding agents are deployed with increasing frequency, yet evaluation methodology has not kept pace with adoption. Current benchmarks measure software engineering competencies — patch generation, bug triage, UI implementation — and assume these capabilities transfer to specialized domains. This assumption is untested.
              </p>
              <p>
                The gap is structural, not incremental. Data engineering tasks require reasoning across database boundaries, enforcement of constraints that span multiple systems, and optimization decisions that trade off between correctness, performance, and maintainability. A pipeline that produces the correct output is not necessarily one that handles schema drift, survives duplicate delivery, or meets latency targets under load. These are the quality dimensions that distinguish prototype code from production-grade data engineering — and they are absent from current evaluation frameworks [1, 2].
              </p>
            </div>

            <blockquote className="my-8 border-l-4 border-[#B91C1C] pl-6 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B91C1C] block mb-2">
                Hypothesis 1.1
              </span>
              <p className="font-[family-name:var(--font-display)] text-sm italic leading-[1.85] text-[#57534E]">
                If evaluation is extended beyond functional correctness into robustness, performance, and production readiness — and if these dimensions are measured sequentially rather than aggregated — then meaningful quality differences between agents will emerge that aggregate pass/fail scoring obscures.
              </p>
            </blockquote>
          </div>
        </section>


        {/* ════════════════════════════════════════════
            §2 — EVALUATION DESIGN
           ════════════════════════════════════════════ */}
        <section id="evaluation-design" className="pt-12">
          <div className="border-t border-[#D6D3D1] pt-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl md:text-2xl tracking-tight mb-6">
              §2 — Evaluation design
            </h2>

            {/* 2.1 Five-Gate Model */}
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#A8A29E] mb-4">
              2.1 The Five-Gate Model
            </h3>
            <p className="text-sm leading-[1.85] text-[#57534E] mb-6">
              The evaluation proceeds sequentially through five gates. An agent may not be credited for a higher gate unless all prior gates pass — a correct-but-fragile result does not earn Gate 03.
            </p>

            {/* Figure 1 — Gate Pipeline */}
            <div className="my-8 overflow-x-auto">
              <div className="grid grid-cols-5 border border-[#D6D3D1] min-w-[540px]">
                {gates.map((g, i) => (
                  <div key={g.number} className={i > 0 ? "border-l border-[#D6D3D1]" : ""}>
                    <div className={`${gateHeaderColors[i]} px-2 py-2 text-center`}>
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em]">Gate {g.number}</div>
                    </div>
                    <div className="px-3 py-4 text-center">
                      <div className="text-xs font-bold uppercase tracking-[0.05em]">{g.name}</div>
                      <div className="text-[10px] text-[#A8A29E] mt-2 italic font-[family-name:var(--font-display)]">— {g.short}</div>
                      <div className="text-[10px] text-[#A8A29E] mt-2 leading-tight">{g.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E] text-center">
                FIG. 1 — FIVE-GATE EVALUATION MODEL. Each gate must be satisfied before the next is evaluated.
              </p>
            </div>

            <p className="text-sm leading-[1.85] text-[#57534E] mb-8">
              This ordering produces a monotonically decreasing pass rate across gates — a pattern we term <em>gate attrition</em>. Attrition curves vary meaningfully across agents and harness configurations, revealing quality characteristics that aggregate pass/fail scoring would obscure.
            </p>

            {/* 2.2 Evaluation Modes */}
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#A8A29E] mb-4 mt-10">
              2.2 Evaluation Modes
            </h3>

            <div className="grid md:grid-cols-2 gap-0 my-6">
              <div className="border border-[#D6D3D1] p-6">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#B91C1C] block mb-2">Mode A</span>
                <h4 className="font-[family-name:var(--font-display)] text-lg mb-2">Naïve vs Savvy</h4>
                <p className="text-xs leading-[1.85] text-[#57534E]">
                  The agent receives the scenario description and nothing else — no system prompt augmentation, no scaffolding, no worked examples. It must infer the implementation approach from the problem statement alone. Mode A measures baseline capability: the quality of output an agent produces when operating from first principles.
                </p>
              </div>
              <div className="border border-[#D6D3D1] border-t-0 md:border-t md:border-l-0 p-6 bg-[#F5F3EE]">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#A8A29E] block mb-2">Mode B · Planned</span>
                <h4 className="font-[family-name:var(--font-display)] text-lg mb-2">Plan vs Execute</h4>
                <p className="text-xs leading-[1.85] text-[#57534E]">
                  The evaluation proceeds in two phases. The agent produces a structured implementation plan, then implements it. Scoring evaluates both: the plan for technical coherence, and the implementation for consistency with the plan. Initial support is under active development.
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════
            §3 — BENCHMARK SCENARIOS
           ════════════════════════════════════════════ */}
        <section id="scenarios" className="pt-12">
          <div className="border-t border-[#D6D3D1] pt-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl md:text-2xl tracking-tight mb-6">
              §3 — Benchmark scenarios
            </h2>
            <p className="text-sm leading-[1.85] text-[#57534E] mb-6">
              DEC Bench v0.1 includes 37 scenarios, each designed to isolate a distinct competency required in production data engineering. Difficulty labels are not editorial — they reflect observed agent failure rates across initial evaluation runs (§5). The scenario library is designed to grow through community contribution.
            </p>

            <div className="overflow-x-auto my-8">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b-2 border-[#1C1917]">
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4 w-8">#</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Scenario</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Competency</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Services</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.id} className="border-b border-[#E8E5E0] hover:bg-[#F5F3EE] transition-colors">
                      <td className="py-2.5 pr-4 text-[#A8A29E] tabular-nums">{s.id}</td>
                      <td className="py-2.5 pr-4 text-xs font-bold">{s.title}</td>
                      <td className="py-2.5 pr-4 text-xs text-[#57534E]">{s.competency}</td>
                      <td className="py-2.5 pr-4 text-xs text-[#A8A29E]">{s.services.join(", ")}</td>
                      <td className="py-2.5">
                        <span className={`text-[9px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 border ${
                          s.state === "fix"
                            ? "border-[#B91C1C] text-[#B91C1C]"
                            : "border-[#D6D3D1] text-[#A8A29E]"
                        }`}>
                          {s.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E] text-center">
                TABLE 1 — FOO BAR DOMAIN SCENARIOS (9 OF 37). Full scenario registry available in the{" "}
                <Link href="/docs" className="underline hover:text-[#57534E] transition-colors">documentation</Link>.
              </p>
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════
            §4 — EVALUATION HARNESSES
           ════════════════════════════════════════════ */}
        <section id="harnesses" className="pt-12">
          <div className="border-t border-[#D6D3D1] pt-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl md:text-2xl tracking-tight mb-6">
              §4 — Evaluation harnesses
            </h2>
            <p className="text-sm leading-[1.85] text-[#57534E] mb-4">
              When a coding agent is evaluated on a scenario, it operates within a <em>harness</em> — the set of tools, libraries, test suites, and scaffolding made available during evaluation. The harness is a meaningful evaluation variable because it changes the competency being measured.
            </p>

            <div className="my-6 px-6 py-4 border border-[#D6D3D1] bg-[#F5F3EE] text-center space-y-1">
              <p className="font-[family-name:var(--font-display)] text-sm italic text-[#57534E]">
                agent + bare harness → measures first-principles reasoning
              </p>
              <p className="font-[family-name:var(--font-display)] text-sm italic text-[#57534E]">
                agent + specialized harness → measures applied competency
              </p>
            </div>

            <div className="overflow-x-auto my-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#1C1917]">
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Harness</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Scaffolding</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2">Measures</th>
                  </tr>
                </thead>
                <tbody>
                  {harnesses.map((h) => (
                    <tr key={h.id} className="border-b border-[#E8E5E0] hover:bg-[#F5F3EE] transition-colors align-top">
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span className="text-xs font-bold">{h.name}</span>
                        <span className="block text-[9px] uppercase tracking-[0.15em] text-[#A8A29E] mt-0.5">{h.label}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-[#57534E]">{h.scaffolding}</td>
                      <td className="py-2.5 text-xs text-[#57534E]">{h.measures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E] text-center">
                TABLE 2 — EVALUATION HARNESS CONFIGURATIONS. The same scenario across different harnesses directly measures whether tooling helps agents perform better.
              </p>
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════
            §5 — COMPARATIVE RESULTS
           ════════════════════════════════════════════ */}
        <section id="results" className="pt-12">
          <div className="border-t border-[#D6D3D1] pt-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl md:text-2xl tracking-tight mb-6">
              §5 — Comparative results
            </h2>
            <p className="text-sm leading-[1.85] text-[#57534E] mb-6">
              We report initial results from the v0.1 evaluation for Codex, Claude Code, and Cursor across 37 data engineering scenarios. All evaluation runs were executed in identical containerized environments; complete run data is available in the{" "}
              <Link href="/leaderboard" className="underline decoration-[#B91C1C] underline-offset-2 hover:text-[#1C1917] transition-colors">public leaderboard</Link>.
            </p>

            <div className="overflow-x-auto my-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#1C1917]">
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Agent</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Scenario</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Highest Gate</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-right py-2 pr-4">Score</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-right py-2 pr-4">Time</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-right py-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENTS.map((agent) => {
                    const entry = bestByAgent.get(agent);
                    const label = agent.replace("-", " ");
                    return (
                      <tr key={agent} className="border-b border-[#E8E5E0] hover:bg-[#F5F3EE] transition-colors">
                        <td className="py-2.5 pr-4 text-xs font-bold capitalize">{label}</td>
                        <td className="py-2.5 pr-4 text-xs text-[#57534E]">
                          {entry ? entry.scenario.replace(/^foo-bar-/, "").replace(/-/g, " ") : "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          {entry ? (
                            <span className="text-xs">
                              G{entry.highest_gate}{" "}
                              <span className="text-[#A8A29E]">{GATE_LABELS[entry.highest_gate]}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-[#A8A29E]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-right tabular-nums">{formatScore(entry?.normalized_score)}</td>
                        <td className="py-2.5 pr-4 text-xs text-right tabular-nums text-[#57534E]">{formatTime(entry?.efficiency?.wallClockSeconds)}</td>
                        <td className="py-2.5 text-xs text-right tabular-nums text-[#57534E]">{formatCost(entry?.efficiency?.llmApiCostUsd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E] text-center">
                TABLE 3 — BEST RUN PER AGENT. Per-scenario breakdowns and raw assertion results available on the{" "}
                <Link href="/leaderboard" className="underline hover:text-[#57534E] transition-colors">leaderboard</Link>.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 my-8">
              <div className="border border-[#D6D3D1] bg-[#F5F3EE] p-6 flex items-center justify-center min-h-[120px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E] text-center">
                  FIG. 2 — GATE SCORE BY AGENT (RADAR)<br />
                  <span className="font-normal normal-case tracking-normal italic text-[#D6D3D1] font-[family-name:var(--font-display)]">
                    Visualization available with sufficient evaluation data
                  </span>
                </p>
              </div>
              <div className="border border-[#D6D3D1] bg-[#F5F3EE] p-6 flex items-center justify-center min-h-[120px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E] text-center">
                  FIG. 3 — GATE ATTRITION PER AGENT<br />
                  <span className="font-normal normal-case tracking-normal italic text-[#D6D3D1] font-[family-name:var(--font-display)]">
                    Visualization available with sufficient evaluation data
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════
            §6 — INFRASTRUCTURE
           ════════════════════════════════════════════ */}
        <section id="infrastructure" className="pt-12">
          <div className="border-t border-[#D6D3D1] pt-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl md:text-2xl tracking-tight mb-6">
              §6 — Infrastructure
            </h2>
            <p className="text-sm leading-[1.85] text-[#57534E] mb-6">
              Every DEC Bench scenario runs against real databases, not mocks. Each component was selected for auditability and reproducibility; every evaluation run produces a complete, replayable record.
            </p>

            <div className="overflow-x-auto my-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#1C1917]">
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Component</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2 pr-4">Role</th>
                    <th className="text-[10px] font-bold uppercase tracking-[0.12em] text-left py-2">Capabilities</th>
                  </tr>
                </thead>
                <tbody>
                  {infrastructure.map((item) => (
                    <tr key={item.name} className="border-b border-[#E8E5E0] hover:bg-[#F5F3EE] transition-colors align-top">
                      <td className="py-2.5 pr-4 text-xs font-bold">{item.name}</td>
                      <td className="py-2.5 pr-4 text-xs text-[#57534E]">{item.role}</td>
                      <td className="py-2.5 text-xs text-[#A8A29E]">{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E] text-center">
                TABLE 4 — SCENARIO INFRASTRUCTURE COMPONENTS
              </p>
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════
            §7 — LIMITATIONS
           ════════════════════════════════════════════ */}
        <section id="limitations" className="pt-12">
          <div className="border-t border-[#D6D3D1] pt-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl md:text-2xl tracking-tight mb-6">
              §7 — Limitations
            </h2>
            <div className="text-sm leading-[1.85] text-[#57534E] space-y-6">
              <div className="border-b border-[#E8E5E0] pb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E]">7.1 Sample Size</span>
                <p className="mt-2">
                  v0.1 includes 37 scenarios, providing initial signal but limiting generalizability claims across the full breadth of data engineering work. The scenario library is designed to grow through community contribution.
                </p>
              </div>
              <div className="border-b border-[#E8E5E0] pb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E]">7.2 Gate Boundary Subjectivity</span>
                <p className="mt-2">
                  While individual assertions are deterministic, the assignment of assertions to specific gates involves editorial judgment. Different researchers might classify edge-case checks as Gate 02 (correctness) or Gate 03 (robustness).
                </p>
              </div>
              <div className="border-b border-[#E8E5E0] pb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E]">7.3 Version Sensitivity</span>
                <p className="mt-2">
                  Agent capabilities change with each model release. Results reported here reflect model versions available at evaluation time and may not generalize to future releases.
                </p>
              </div>
              <div className="border-b border-[#E8E5E0] pb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E]">7.4 Domain Coverage</span>
                <p className="mt-2">
                  All v0.1 scenarios operate within the Foo Bar domain — a synthetic SaaS analytics platform. Cross-domain generalization to B2B, e-commerce, advertising, and other data engineering contexts remains untested.
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A8A29E]">7.5 Harness Interaction Effects</span>
                <p className="mt-2">
                  We report per-harness results independently but have not yet isolated interaction effects between specific harness configurations and scenario types.
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* ════════════════════════════════════════════
            §8 — EVALUATION ACCESS
           ════════════════════════════════════════════ */}
        <section id="evaluation-access" className="pt-12">
          <div className="border-t border-[#D6D3D1] pt-8">
            <h2 className="font-[family-name:var(--font-display)] text-xl md:text-2xl tracking-tight mb-6">
              §8 — Evaluation access
            </h2>

            <div className="grid md:grid-cols-2 gap-0 my-8">
              <div className="border border-[#D6D3D1] p-6 md:p-8 bg-[#F5F3EE]">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#A8A29E] block mb-3">Open Benchmark</span>
                <h3 className="font-[family-name:var(--font-display)] text-xl mb-3">Reproduce Our Results</h3>
                <p className="text-xs leading-[1.85] text-[#57534E]">
                  DEC Bench is open source and fully containerized. Clone the repository, run the evaluation suite against your preferred agent, and reproduce every result reported here. All evaluation artifacts are available under the MIT license.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/docs/running-evals" className="paper-btn paper-btn-primary px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                    Run the Evaluation
                  </Link>
                  <a href="https://github.com/514-labs/agent-evals" target="_blank" rel="noopener noreferrer" className="paper-btn paper-btn-ghost px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                    View on GitHub
                  </a>
                </div>
              </div>
              <div className="border border-[#D6D3D1] border-t-0 md:border-t md:border-l-0 p-6 md:p-8 bg-[#1C1917] text-[#F5F3EE]">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#A8A29E] block mb-3">Research Preview</span>
                <h3 className="font-[family-name:var(--font-display)] text-xl mb-3">Contribute to the Benchmark</h3>
                <p className="text-xs leading-[1.85] text-[#A8A29E]">
                  We invite contributions across three dimensions: running the evaluation against additional agents, developing new scenarios for underrepresented competencies, and extending the methodology to adjacent domains. All results contribute to the public leaderboard.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/docs/add-eval/getting-started" className="paper-btn px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] bg-[#B91C1C] text-white border-[1.5px] border-[#B91C1C] hover:bg-[#991B1B] hover:border-[#991B1B]">
                    Contribute a Scenario
                  </Link>
                  <Link href="/docs" className="paper-btn px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] bg-transparent text-[#A8A29E] border-[1.5px] border-[#57534E] hover:border-[#A8A29E] hover:text-[#F5F3EE]">
                    Read the Docs
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ── References ── */}
        <section className="pt-12 pb-8">
          <div className="border-t border-[#D6D3D1] pt-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A8A29E] block mb-4">
              References
            </span>
            <div className="text-xs leading-[1.85] text-[#57534E] space-y-2">
              <p>[1] Ardent AI Labs. DE-Bench: A Benchmark for Data Engineering Tasks. 2025.</p>
              <p>[2] dbt Labs. skill-eval: Evaluating LLM competency on dbt tasks. 2025.</p>
              <p>[3] Jimenez, C.E., et al. SWE-bench: Can Language Models Resolve Real-World GitHub Issues? 2024.</p>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
