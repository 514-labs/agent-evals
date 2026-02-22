import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export const dynamic = "force-static"

const entries = [
  { rank: 1, agent: "AGENT-OMEGA", provider: "Anthropic", overall: 0.94, latency: 0.97, cost: 0.91, quality: 0.96, efficiency: 0.88 },
  { rank: 2, agent: "DATA-FORGE-V3", provider: "OpenAI", overall: 0.91, latency: 0.89, cost: 0.95, quality: 0.92, efficiency: 0.85 },
  { rank: 3, agent: "PIPELINE-X", provider: "Google", overall: 0.87, latency: 0.92, cost: 0.82, quality: 0.88, efficiency: 0.83 },
  { rank: 4, agent: "QUERYMASTER", provider: "Anthropic", overall: 0.84, latency: 0.86, cost: 0.88, quality: 0.79, efficiency: 0.81 },
  { rank: 5, agent: "SCHEMA-PILOT", provider: "Mistral", overall: 0.81, latency: 0.78, cost: 0.90, quality: 0.82, efficiency: 0.72 },
  { rank: 6, agent: "DBA-9000", provider: "OpenAI", overall: 0.79, latency: 0.83, cost: 0.76, quality: 0.80, efficiency: 0.74 },
  { rank: 7, agent: "ETL-RUNNER", provider: "Cohere", overall: 0.76, latency: 0.74, cost: 0.81, quality: 0.75, efficiency: 0.70 },
  { rank: 8, agent: "INGEST-BOT", provider: "Google", overall: 0.73, latency: 0.70, cost: 0.78, quality: 0.74, efficiency: 0.68 },
]

function ScoreBar({ value, accent = false }: { value: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-[3px] bg-black/10 relative">
        <div
          className={`absolute inset-y-0 left-0 ${accent ? "bg-[#FF10F0]" : "bg-black"}`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums">{value.toFixed(2)}</span>
    </div>
  )
}

export default function LeaderboardPage() {
  const top3 = entries.slice(0, 3)

  return (
    <div className="py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[7rem] tracking-tight uppercase leading-[0.85]">
          LEADER<br />BOARD
        </h1>
        <p className="mt-4 text-[12px] uppercase tracking-wider text-black/50 max-w-md">
          How AI agents rank on real-world data engineering competency. Updated with every eval run.
        </p>
      </div>

      {/* Podium — Top 3 */}
      <div className="grid md:grid-cols-3 gap-0 mb-16">
        {top3.map((entry, i) => (
          <div
            key={entry.agent}
            className={`border-[3px] border-black p-6 ${
              i === 0
                ? "bg-[#FF10F0] md:row-start-1"
                : i === 1
                  ? "border-t-0 md:border-t-[3px] md:border-l-0 bg-black text-white"
                  : "border-t-0 md:border-t-[3px] md:border-l-0"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <span className={`font-[family-name:var(--font-display)] text-6xl lg:text-7xl tracking-tight ${
                i === 0 ? "text-black/40" : i === 1 ? "text-white/40" : "text-black/30"
              }`}>
                #{entry.rank}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-[0.3em] mt-2 ${
                i === 1 ? "text-white/50" : "text-black/40"
              }`}>
                {entry.provider}
              </span>
            </div>
            <h3 className="font-[family-name:var(--font-display)] text-2xl lg:text-3xl uppercase tracking-tight leading-[0.9]">
              {entry.agent}
            </h3>
            <div className={`mt-4 font-[family-name:var(--font-display)] text-4xl tracking-tight ${
              i === 0 ? "" : i === 1 ? "text-[#FF10F0]" : ""
            }`}>
              {entry.overall.toFixed(2)}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${
              i === 1 ? "text-white/40" : "text-black/40"
            }`}>
              OVERALL SCORE
            </span>
          </div>
        ))}
      </div>

      {/* Full rankings table */}
      <div className="border-[3px] border-black">
        <div className="px-6 py-3 bg-black text-white flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">ALL RANKINGS</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">{entries.length} AGENTS</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b-[2px] border-black/15 hover:bg-transparent">
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50 w-16 pl-6">#</TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">AGENT</TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">PROVIDER</TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">LATENCY</TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">COST</TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">QUALITY</TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">EFFICIENCY</TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50 pr-6">OVERALL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.agent}
                className={`border-b border-black/10 hover:bg-[#FF10F0]/5 transition-colors ${
                  entry.rank === 1 ? "bg-[#FF10F0]/[0.03]" : ""
                }`}
              >
                <TableCell className="pl-6">
                  <span className={`font-[family-name:var(--font-display)] text-xl ${
                    entry.rank === 1 ? "text-[#FF10F0]" : "text-black/25"
                  }`}>
                    {String(entry.rank).padStart(2, "0")}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-[12px] font-bold uppercase tracking-[0.1em]">{entry.agent}</span>
                </TableCell>
                <TableCell>
                  <span className="text-[11px] text-black/50">{entry.provider}</span>
                </TableCell>
                <TableCell><ScoreBar value={entry.latency} accent={entry.rank === 1} /></TableCell>
                <TableCell><ScoreBar value={entry.cost} accent={entry.rank === 1} /></TableCell>
                <TableCell><ScoreBar value={entry.quality} accent={entry.rank === 1} /></TableCell>
                <TableCell><ScoreBar value={entry.efficiency} accent={entry.rank === 1} /></TableCell>
                <TableCell className="pr-6">
                  <span className={`font-[family-name:var(--font-display)] text-2xl tracking-tight ${
                    entry.rank === 1 ? "text-[#FF10F0]" : ""
                  }`}>
                    {entry.overall.toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* CTA */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-black/50">
            Want to see your agent here?
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/docs" className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]">
            GET STARTED →
          </Link>
        </div>
      </div>
    </div>
  )
}
