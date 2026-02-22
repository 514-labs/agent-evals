import Link from "next/link"

export const dynamic = "force-static"

const scores = [
  { label: "COMPLETION", weight: "40%", detail: "DID IT FINISH?" },
  { label: "LATENCY", weight: "30%", detail: "HOW FAST?" },
  { label: "COST", weight: "20%", detail: "HOW CHEAP?" },
  { label: "STORAGE", weight: "10%", detail: "HOW SMALL?" },
]

const scenarios = [
  "SCHEMA DESIGN", "QUERY OPTIMIZATION", "DATA INGESTION",
  "MIGRATIONS", "DEBUGGING", "MATERIALIZED VIEWS",
  "PARTITIONING", "COMPRESSION", "MONITORING",
]

const marqueeText = "REALTIME · ANALYTICAL · DATA ENGINEERING · AGENT EVALS · CLICKHOUSE · OPEN SOURCE · "

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-white text-black overflow-hidden font-[family-name:var(--font-body)]">

      {/* Navigation */}
      <nav className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-4 border-b-[3px] border-black">
        <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight">RAD</span>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#EAFF00] px-3 py-1.5 transition-colors">DOCS</Link>
          <Link href="/leaderboard" className="text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-[#EAFF00] px-3 py-1.5 transition-colors">BOARD</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold uppercase tracking-[0.15em] border-[2px] border-black px-3 py-1 hover:bg-black hover:text-white transition-all">GH ↗</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 lg:px-12 pt-8 lg:pt-16 pb-4">
        <div className="relative">
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(6rem,25vw,20rem)] leading-[0.85] tracking-[-0.02em] uppercase brutal-slide-in">
            RAD
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
                The open-source benchmark for evaluating AI agents on real-world ClickHouse data engineering.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-8 brutal-fade-in">
          <Link href="/leaderboard" className="brutal-btn bg-[#EAFF00] text-black border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]">
            LEADERBOARD →
          </Link>
          <Link href="/docs" className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]">
            READ DOCS →
          </Link>
        </div>
      </section>

      {/* Marquee */}
      <div className="relative z-10 mt-10 py-3 bg-black text-[#EAFF00] overflow-hidden border-y-[3px] border-black">
        <div className="brutal-marquee flex whitespace-nowrap">
          <span className="text-[11px] font-bold uppercase tracking-[0.3em]">
            {marqueeText.repeat(10)}
          </span>
        </div>
      </div>

      {/* Scoring */}
      <section className="relative z-10 px-6 lg:px-12 py-16">
        <div className="border-[3px] border-black">
          <div className="px-6 py-3 bg-black text-white flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">SCORING DIMENSIONS</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">4 AXES</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-x-0 lg:divide-x-[2px] divide-y-[2px] lg:divide-y-0 divide-black/15">
            {scores.map((s) => (
              <div
                key={s.label}
                className="p-6 group hover:bg-[#EAFF00] transition-colors duration-200"
              >
                <div className="font-[family-name:var(--font-display)] text-5xl lg:text-6xl tracking-tight">{s.weight}</div>
                <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em]">{s.label}</div>
                <div className="mt-1 text-[10px] text-black/40 group-hover:text-black/70 transition-colors">{s.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scenarios */}
      <section className="relative z-10 px-6 lg:px-12 py-16">
        <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-7xl tracking-tight uppercase mb-8">
          SCENARIOS
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((s, i) => (
            <div
              key={s}
              className="brutal-grid-cell border-[2px] border-black p-5 text-[12px] font-bold uppercase tracking-[0.15em] hover:bg-black hover:text-[#EAFF00] transition-all cursor-default"
            >
              <span className="text-[9px] text-black/30 block mb-1">#{String(i + 1).padStart(2, "0")}</span>
              {s}
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.2em] text-black/25 font-bold">
          {["E-COMMERCE", "FINTECH", "IOT", "ANALYTICS", "SAAS", "MEDIA", "HEALTHCARE", "LOGISTICS"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </section>

      {/* Agent Modes */}
      <section className="relative z-10 px-6 lg:px-12 py-16">
        <div className="grid md:grid-cols-2">
          <div className="border-[3px] border-black p-8 bg-[#EAFF00]">
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] block mb-4">PERSONA</span>
            <h3 className="font-[family-name:var(--font-display)] text-3xl lg:text-5xl uppercase tracking-tight leading-[0.9]">NAIVE<br />VS SAVVY</h3>
            <p className="mt-4 text-[12px] leading-relaxed text-black/60">
              Test agents with varying ClickHouse expertise. Measure adaptability across knowledge levels.
            </p>
          </div>
          <div className="border-[3px] border-black border-t-0 md:border-t-[3px] md:border-l-0 p-8 bg-black text-white">
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] block mb-4 text-[#EAFF00]">STRATEGY</span>
            <h3 className="font-[family-name:var(--font-display)] text-3xl lg:text-5xl uppercase tracking-tight leading-[0.9]">PLAN<br />VS EXECUTE</h3>
            <p className="mt-4 text-[12px] leading-relaxed text-white/50">
              Does your agent think before acting? Compare strategic planners against direct executors.
            </p>
          </div>
        </div>
      </section>

      {/* Marquee 2 */}
      <div className="relative z-10 py-3 bg-[#EAFF00] overflow-hidden border-y-[3px] border-black">
        <div className="brutal-marquee-reverse flex whitespace-nowrap">
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-black">
            {"BENCHMARK YOUR AGENTS · CLIMB THE LEADERBOARD · OPEN SOURCE · CLICKHOUSE NATIVE · ".repeat(10)}
          </span>
        </div>
      </div>

      {/* Final CTA */}
      <section className="relative z-10 px-6 lg:px-12 py-24 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-5xl md:text-[8rem] tracking-tight uppercase leading-[0.85]">
          GET<br />RAD
        </h2>
        <p className="mt-6 text-[12px] text-black/40 max-w-md mx-auto">
          Run your agents against real ClickHouse challenges. See how they stack up on the leaderboard.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/leaderboard" className="brutal-btn bg-[#EAFF00] text-black border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]">
            LEADERBOARD →
          </Link>
          <Link href="/docs" className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]">
            GET STARTED →
          </Link>
        </div>
      </section>

      <footer className="border-t-[3px] border-black px-6 py-6 text-center text-[9px] font-bold uppercase tracking-[0.3em] text-black/20">
        RAD BENCH — OPEN SOURCE AGENT EVALS
      </footer>
    </div>
  )
}
