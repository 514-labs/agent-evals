import Link from "next/link";
import { AnimatedLogo } from "../components/animated-logo";

export const dynamic = "force-static";

const gates = [
  { label: "FUNCTIONAL", number: "01", detail: "IT RUNS" },
  { label: "CORRECT", number: "02", detail: "IT PRODUCES RIGHT ANSWERS" },
  { label: "ROBUST", number: "03", detail: "IT HANDLES REAL-WORLD CONDITIONS" },
  { label: "PERFORMANT", number: "04", detail: "IT'S FAST ENOUGH" },
  { label: "PRODUCTION", number: "05", detail: "YOU'D SHIP THIS" },
];

const internalScenarios = [
  {
    domain: "B2B SAAS",
    data: "Product usage events, subscription lifecycle, feature adoption",
    challenge: "High-cardinality user/account dimensions, event versioning",
  },
  {
    domain: "B2C SAAS",
    data: "User activity streams, content interactions, session data",
    challenge: "Massive event volumes, time-series heavy, retention queries",
  },
  {
    domain: "UGC",
    data: "Posts, comments, reactions, moderation signals",
    challenge: "Variable schema (JSON-heavy), content search + analytics",
  },
  {
    domain: "E-COMMERCE",
    data: "Orders, inventory, catalog, customer behavior",
    challenge: "Transactional correctness critical, complex JOINs",
  },
  {
    domain: "ADVERTISING",
    data: "Impressions, clicks, conversions, bid data",
    challenge: "Extreme write throughput, real-time aggregation",
  },
  {
    domain: "CONSUMPTION INFRA",
    data: "API calls, compute usage, storage metering",
    challenge: "Billing accuracy critical, high-cardinality metering keys",
  },
];

const userFacingScenarios = [
  {
    scenario: "DASHBOARDS",
    task: "Pre-aggregated models, sub-second query latency, concurrent access",
  },
  {
    scenario: "EXPORTED REPORTS",
    task: "Batch query optimization, large result sets, scheduling",
  },
  {
    scenario: "FEEDS",
    task: "Real-time materialized views, incremental updates, personalization queries",
  },
  {
    scenario: "ANALYTICAL CHAT",
    task: "Ad-hoc query generation, EXPLAIN-based optimization, natural language → SQL",
  },
];

const marqueeText =
  "POSTGRES · REDPANDA · CLICKHOUSE · B2B SAAS · E-COMMERCE · FINTECH · ADVERTISING · OPEN SOURCE · DASHBOARDS · FEEDS · ANALYTICAL CHAT · SCHEMA DESIGN · QUERY OPTIMIZATION · DATA INGESTION · ";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-white text-black overflow-hidden font-[family-name:var(--font-body)]">
      {/* Navigation */}
      <nav className="relative z-20 border-b-[3px] border-black">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
          <AnimatedLogo />
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#FF10F0] px-3 py-1.5 transition-colors"
            >
              DOCS
            </Link>
            <Link
              href="/leaderboard"
              className="text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#FF10F0] px-3 py-1.5 transition-colors"
            >
              LEADERBOARD
            </Link>
            <a
              href="https://github.com/514-labs/agent-evals"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold uppercase tracking-[0.15em] border-[2px] border-black px-3 py-1 hover:bg-black hover:text-white transition-all"
            >
              GH ↗
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 pt-8 lg:pt-16 pb-4">
          <div className="relative">
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(6rem,25vw,20rem)] leading-[0.85] tracking-[-0.02em] uppercase brutal-slide-in">
              DEC
            </h1>
            <div className="flex items-end gap-4 lg:gap-8 mt-[-0.5rem] lg:mt-[-1rem]">
              <h1
                className="font-[family-name:var(--font-display)] text-[clamp(3rem,12vw,10rem)] leading-[0.85] tracking-[-0.02em] text-transparent uppercase brutal-slide-in-delayed"
                style={{ WebkitTextStroke: "3px black" }}
              >
                BENCH
              </h1>
              <div className="pb-2 lg:pb-4 max-w-xs brutal-fade-in">
                <p className="text-[11px] uppercase leading-snug tracking-wider">
                  An open-source{" "}
                  <span className="underline decoration-[#FF10F0] decoration-2 underline-offset-2">
                    d
                  </span>
                  ata{" "}
                  <span className="underline decoration-[#FF10F0] decoration-2 underline-offset-2">
                    e
                  </span>
                  ngineering{" "}
                  <span className="underline decoration-[#FF10F0] decoration-2 underline-offset-2">
                    c
                  </span>
                  ompetency benchmark for evaluating an AI agent&#39;s ability
                  to tackle real-world data problems.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-8 brutal-fade-in">
            <Link
              href="/leaderboard"
              className="brutal-btn bg-[#FF10F0] text-black border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]"
            >
              LEADERBOARD →
            </Link>
            <Link
              href="/docs"
              className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]"
            >
              READ DOCS →
            </Link>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="relative z-10 mt-10 py-3 bg-black text-[#FF10F0] overflow-hidden border-y-[3px] border-black">
        <div className="brutal-marquee flex whitespace-nowrap">
          <span className="text-[11px] font-bold uppercase tracking-[0.3em]">
            {marqueeText.repeat(10)}
          </span>
        </div>
      </div>

      {/* Scoring */}
      <section className="relative z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-16">
          <div className="border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
            <div className="px-6 py-3 bg-black text-white flex items-center justify-between border-b-[3px] border-black">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
                EVALUATION RUN SCORING METHODOLOGY
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#FF10F0]">
                5 SEQUENTIAL GATES
              </span>
            </div>

            {/* Scoring Intro */}
            <div className="px-6 py-6 border-b-[3px] border-black bg-[#FF10F0] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="font-[family-name:var(--font-display)] text-3xl lg:text-4xl tracking-tight uppercase">
                  Pass each gate in order
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-[0.2em] border-[2px] border-black px-2 py-0.5 bg-black text-white">
                  DETERMINISTIC
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-wider text-black md:text-right max-w-sm font-medium">
                Each gate is passed if all core and scenario assertions pass.
                Quantitative metrics then rank evals within each gate.
              </p>
            </div>

            {/* Sequential Gates */}
            <div className="flex flex-col divide-y-[3px] divide-black">
              {gates.map((g) => (
                <div
                  key={g.label}
                  className="grid grid-cols-[100px_1fr] md:grid-cols-[150px_300px_1fr] items-stretch group hover:bg-black hover:text-white transition-colors duration-200"
                >
                  <div className="p-6 md:p-8 border-r-[3px] border-black flex items-center justify-center bg-black text-[#FF10F0] group-hover:bg-[#FF10F0] group-hover:text-black transition-colors duration-200">
                    <div className="font-[family-name:var(--font-display)] text-5xl lg:text-7xl tracking-tight">
                      {g.number}
                    </div>
                  </div>
                  <div className="p-6 md:p-8 flex flex-col justify-center">
                    <div className="text-[16px] md:text-[24px] font-[family-name:var(--font-display)] uppercase tracking-wide">
                      {g.label}
                    </div>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 group-hover:text-white/50">
                      GATE
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-1 border-t-[3px] md:border-t-0 md:border-l-[3px] border-black p-6 md:p-8 flex items-center group-hover:border-white">
                    <div className="text-[12px] md:text-[14px] uppercase tracking-widest text-black/70 group-hover:text-white/90 font-medium">
                      → {g.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Internal Analytics Scenarios */}
      <section className="relative z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-16">
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-7xl tracking-tight uppercase">
            SCENARIOS
          </h2>
          <p className="mt-3 mb-12 text-[12px] uppercase tracking-wider text-black/50 max-w-lg">
            Evaluate agents across realistic data engineering domains and
            features.
          </p>

          <div className="border-[3px] border-black">
            <div className="px-6 py-3 bg-black text-white flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
                INTERNAL ANALYTICS & DATA WAREHOUSING
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                {internalScenarios.length} DOMAINS
              </span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1.5fr_1.5fr] gap-x-6 border-b-[2px] border-black/15 px-6 py-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                DOMAIN
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                EXAMPLE DATA
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                CHARACTERISTIC CHALLENGES
              </span>
            </div>

            {internalScenarios.map((s) => (
              <div
                key={s.domain}
                className="grid grid-cols-[1fr_1.5fr_1.5fr] gap-x-6 border-b-[1px] last:border-b-0 border-black/10 px-6 py-4 hover:bg-[#FF10F0] transition-colors group"
              >
                <span className="text-[12px] font-bold uppercase tracking-[0.1em]">
                  {s.domain}
                </span>
                <span className="text-[11px] text-black/60 group-hover:text-black/80 transition-colors">
                  {s.data}
                </span>
                <span className="text-[11px] text-black/60 group-hover:text-black/80 transition-colors">
                  {s.challenge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User-Facing Analytics Scenarios */}
      <section className="relative z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 pb-16">
          <div className="border-[3px] border-black">
            <div className="px-6 py-3 bg-black text-white flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
                USER-FACING ANALYTICS
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                {userFacingScenarios.length} FEATURES
              </span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_3fr] gap-x-6 border-b-[2px] border-black/15 px-6 py-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                SCENARIO
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                WHAT THE AGENT NEEDS TO BUILD / OPTIMIZE
              </span>
            </div>

            {userFacingScenarios.map((s) => (
              <div
                key={s.scenario}
                className="grid grid-cols-[1fr_3fr] gap-x-6 border-b-[1px] last:border-b-0 border-black/10 px-6 py-4 hover:bg-[#FF10F0] transition-colors group"
              >
                <span className="text-[12px] font-bold uppercase tracking-[0.1em]">
                  {s.scenario}
                </span>
                <span className="text-[11px] text-black/60 group-hover:text-black/80 transition-colors">
                  {s.task}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Modes */}
      <section className="relative z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-16">
          <div className="grid md:grid-cols-2">
            <div className="border-[3px] border-black p-8 bg-[#FF10F0]">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] block mb-4">
                PERSONA
              </span>
              <h3 className="font-[family-name:var(--font-display)] text-3xl lg:text-5xl uppercase tracking-tight leading-[0.9]">
                NAIVE
                <br />
                VS SAVVY
              </h3>
              <p className="mt-4 text-[12px] leading-relaxed text-black/60">
                Test agents with varying levels of data engineering expertise.
                Measure adaptability across knowledge levels.
              </p>
            </div>
            <div className="border-[3px] border-black border-t-0 md:border-t-[3px] md:border-l-0 p-8 bg-black text-white">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] block mb-4 text-[#FF10F0]">
                STRATEGY
              </span>
              <h3 className="font-[family-name:var(--font-display)] text-3xl lg:text-5xl uppercase tracking-tight leading-[0.9]">
                PLAN
                <br />
                VS EXECUTE
              </h3>
              <p className="mt-4 text-[12px] leading-relaxed text-white/70">
                Does your agent think before acting? Compare strategic planners
                against direct executors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Stack */}
      <section className="relative z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-16">
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-7xl tracking-tight uppercase">
            DATA STACK
          </h2>
          <p className="mt-3 mb-12 text-[12px] uppercase tracking-wider text-black/50 max-w-lg">
            Real infrastructure, not mocks. Every scenario runs against a
            production-grade stack.
          </p>

          <div className="grid md:grid-cols-3 gap-0">
            <div className="border-[3px] border-black p-8 hover:bg-[#FF10F0] transition-colors group">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-black/50 group-hover:text-black/70 block mb-3">
                OLTP
              </span>
              <h3 className="font-[family-name:var(--font-display)] text-4xl lg:text-5xl uppercase tracking-tight leading-[0.9]">
                POSTGRES
              </h3>
              <p className="mt-3 text-[11px] text-black/60 group-hover:text-black/80 transition-colors">
                Transactional source of truth. Schema migrations, referential
                integrity, row-level operations.
              </p>
            </div>
            <div className="border-[3px] border-black border-t-0 md:border-t-[3px] md:border-l-0 p-8 hover:bg-[#FF10F0] transition-colors group">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-black/50 group-hover:text-black/70 block mb-3">
                STREAMING
              </span>
              <h3 className="font-[family-name:var(--font-display)] text-4xl lg:text-5xl uppercase tracking-tight leading-[0.9]">
                REDPANDA
              </h3>
              <p className="mt-3 text-[11px] text-black/60 group-hover:text-black/80 transition-colors">
                High-throughput event streaming. Topic management, consumer
                groups, exactly-once delivery.
              </p>
            </div>
            <div className="border-[3px] border-black border-t-0 md:border-t-[3px] md:border-l-0 p-8 hover:bg-[#FF10F0] transition-colors group">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-black/50 group-hover:text-black/70 block mb-3">
                OLAP
              </span>
              <h3 className="font-[family-name:var(--font-display)] text-4xl lg:text-5xl uppercase tracking-tight leading-[0.9]">
                CLICKHOUSE
              </h3>
              <p className="mt-3 text-[11px] text-black/60 group-hover:text-black/80 transition-colors">
                Columnar analytics engine. Materialized views, real-time
                aggregation, petabyte-scale queries.
              </p>
            </div>
          </div>

          <div className="mt-6 border-[2px] border-dashed border-black/20 px-6 py-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50">
                COMING SOON
              </span>
              <span className="text-[11px] text-black/40">
                MySQL · DuckDB · Kafka · Snowflake · BigQuery · more
              </span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/30">
              OPEN TO CONTRIBUTIONS
            </span>
          </div>
        </div>
      </section>

      {/* Marquee 2 */}
      <div className="relative z-10 py-3 bg-[#FF10F0] overflow-hidden border-y-[3px] border-black">
        <div className="brutal-marquee-reverse flex whitespace-nowrap">
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-black">
            {"BENCHMARK YOUR AGENTS · CLIMB THE LEADERBOARD · OPEN SOURCE · CLICKHOUSE NATIVE · ".repeat(
              10,
            )}
          </span>
        </div>
      </div>

      {/* Final CTA */}
      <section className="relative z-10">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 py-24 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-5xl md:text-[8rem] tracking-tight uppercase leading-[0.85]">
            START
            <br />
            YOUR EVAL
          </h2>
          <p className="mt-6 text-[12px] text-black/50 max-w-md mx-auto">
            Run your agents against real-world data engineering challenges. See
            how they stack up on the leaderboard.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/leaderboard"
              className="brutal-btn bg-[#FF10F0] text-black border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]"
            >
              LEADERBOARD →
            </Link>
            <Link
              href="/docs"
              className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]"
            >
              GET STARTED →
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t-[3px] border-black">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-[9px] font-bold uppercase tracking-[0.3em] text-black/40">
          BROUGHT TO YOU BY{" "}
          <a
            href="https://fiveonefour.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-black/70 transition-colors"
          >
            FIVEONEFOUR
          </a>{" "}
          ·{" "}
          <a
            href="https://fiveonefour.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-black/70 transition-colors"
          >
            BECOME A SPONSOR
          </a>
        </div>
      </footer>
    </div>
  );
}
