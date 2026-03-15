import Link from "next/link";

import { getLeaderboardEntries, type LeaderboardEntry } from "@/data/results";

const AGENTS = ["claude-code", "codex", "cursor"] as const;
const GATE_NAMES = ["—", "FUNCTIONAL", "CORRECT", "ROBUST", "PERFORMANT", "PRODUCTION"];

function GatePips({ gate }: { gate: number }) {
  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((g) => (
        <div
          key={g}
          className={`w-3 h-3 border-[2px] border-current ${
            g <= gate ? "bg-[#FF10F0]" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

function formatScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(2);
}

function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatCost(usd: number | null | undefined): string {
  if (usd == null || usd === 0) return "—";
  return `$${usd.toFixed(2)}`;
}

function AgentColumn({
  entry,
  highlight,
}: {
  entry: LeaderboardEntry | null;
  highlight: boolean;
}) {
  if (!entry) {
    return (
      <div
        className={`flex flex-col border-[3px] border-black p-6 ${
          highlight ? "border-t-0 md:border-t-[3px] md:border-l-0" : ""
        }`}
      >
        <p className="text-xs uppercase tracking-wider text-black/40 text-center py-8">
          No runs yet
        </p>
      </div>
    );
  }

  const agentLabel = entry.agent.replace("-", " ").toUpperCase();
  const scenarioLabel = entry.scenario
    .replace(/^foo-bar-/, "")
    .replace(/-/g, " ")
    .toUpperCase();

  return (
    <div
      className={`flex flex-col border-[3px] border-black group hover:bg-[#FF10F0]/5 transition-colors ${
        highlight ? "border-t-0 md:border-t-[3px] md:border-l-0" : ""
      }`}
    >
      <div className="px-5 py-3 bg-black text-white flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.25em]">
          {agentLabel}
        </span>
        <span className="text-xs uppercase tracking-[0.15em] text-white/50">
          {entry.model.replace("claude-", "").replace("-20250514", "").slice(0, 16)}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-black/40 mb-1">
            Scenario
          </p>
          <p className="text-sm font-bold uppercase tracking-[0.1em]">
            {scenarioLabel}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GatePips gate={entry.highest_gate} />
          <span className="text-xs font-bold uppercase tracking-[0.15em]">
            {GATE_NAMES[entry.highest_gate] ?? "—"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-0 border border-black/10">
          {[
            { label: "Score", value: formatScore(entry.normalized_score) },
            { label: "Time", value: formatTime(entry.efficiency?.wallClockSeconds) },
            { label: "Cost", value: formatCost(entry.efficiency?.llmApiCostUsd) },
          ].map((field) => (
            <div
              key={field.label}
              className="px-3 py-2 border-r border-black/10 last:border-r-0"
            >
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-black/35">
                {field.label}
              </p>
              <p className="text-sm font-bold mt-0.5 tabular-nums">
                {field.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-black/10">
        <Link
          href={`/audit/${entry.scenario}/${entry.run_id ?? ""}`}
          className="text-xs font-bold uppercase tracking-[0.15em] text-black/40 hover:text-[#FF10F0] transition-colors"
        >
          View audit →
        </Link>
      </div>
    </div>
  );
}

export function AgentComparison() {
  const entries = getLeaderboardEntries();

  if (entries.length === 0) return null;

  const bestByAgent = new Map<string, LeaderboardEntry>();
  for (const entry of entries) {
    if (!bestByAgent.has(entry.agent)) {
      bestByAgent.set(entry.agent, entry);
    }
  }

  const columns = AGENTS.map((agent) => bestByAgent.get(agent) ?? null);
  if (columns.every((c) => c === null)) return null;

  return (
    <section className="relative z-10">
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-16">
        <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-7xl tracking-tight uppercase">
          AGENT COMPARISON
        </h2>
        <p className="mt-3 mb-12 text-sm uppercase tracking-wider text-black/50 max-w-lg">
          Best run from each agent, ranked by highest gate cleared.
          Click through to audit the full trace.
        </p>

        <div className="grid md:grid-cols-3 gap-0">
          {columns.map((entry, i) => (
            <AgentColumn
              key={AGENTS[i]}
              entry={entry}
              highlight={i > 0}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link
            href="/leaderboard"
            className="text-xs font-bold uppercase tracking-[0.15em] text-black/40 hover:text-black transition-colors"
          >
            Full leaderboard →
          </Link>
          <Link
            href="/docs/running-evals"
            className="brutal-btn bg-[#FF10F0] text-black border-[3px] border-black px-6 py-2 text-xs font-bold uppercase tracking-[0.15em]"
          >
            Run your own comparison →
          </Link>
        </div>
      </div>
    </section>
  );
}
