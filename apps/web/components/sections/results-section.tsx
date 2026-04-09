import Link from "next/link";
import {
  getLeaderboardEntries,
  type LeaderboardEntry,
} from "@/data/results";

const AGENTS = ["codex", "claude-code", "cursor"] as const;
const GATE_LABELS = [
  "\u2014",
  "Functional",
  "Correct",
  "Robust",
  "Performant",
  "Production",
];

function formatScore(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "\u2014";
  return v.toFixed(2);
}

function formatTime(s: number | null | undefined): string {
  if (s == null || s === 0) return "\u2014";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatCost(usd: number | null | undefined): string {
  if (usd == null || usd === 0) return "\u2014";
  return `$${usd.toFixed(2)}`;
}

export function ResultsSection() {
  const entries = getLeaderboardEntries();
  const bestByAgent = new Map<string, LeaderboardEntry>();
  for (const entry of entries) {
    const existing = bestByAgent.get(entry.agent);
    if (!existing || entry.highest_gate > existing.highest_gate) {
      bestByAgent.set(entry.agent, entry);
    }
  }

  return (
    <div className="pt-6">

      <p className="mt-6 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
        We report initial results from the v0.1 evaluation for Codex, Claude
        Code, and Cursor across 37 data engineering scenarios. All evaluation
        runs were executed in identical containerized environments; complete run
        data is available in the{" "}
        <Link
          href="/leaderboard"
          className="underline decoration-[color:var(--accent)] underline-offset-2 hover:text-[color:var(--foreground)] transition-colors"
        >
          public leaderboard
        </Link>
        .
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[color:var(--foreground)]">
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-left py-2 pr-4 text-[color:var(--foreground)]">
                Agent
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-left py-2 pr-4 text-[color:var(--foreground)]">
                Scenario
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-left py-2 pr-4 text-[color:var(--foreground)]">
                Highest Gate
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 pr-4 text-[color:var(--foreground)]">
                Score
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 pr-4 text-[color:var(--foreground)]">
                Time
              </th>
              <th className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-right py-2 text-[color:var(--foreground)]">
                Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {AGENTS.map((agent) => {
              const entry = bestByAgent.get(agent);
              const label = agent.replace("-", " ");
              return (
                <tr
                  key={agent}
                  className="border-b border-[color:var(--secondary)] hover:bg-[color:var(--secondary)] transition-colors"
                >
                  <td className="py-2.5 pr-4 text-xs font-bold capitalize">
                    {label}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-[color:var(--muted-foreground)]">
                    {entry
                      ? entry.scenario
                          .replace(/^foo-bar-/, "")
                          .replace(/-/g, " ")
                      : "\u2014"}
                  </td>
                  <td className="py-2.5 pr-4">
                    {entry ? (
                      <span className="text-xs">
                        G{entry.highest_gate}{" "}
                        <span className="text-[color:var(--chart-4)]">
                          {GATE_LABELS[entry.highest_gate]}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-[color:var(--chart-4)]">
                        {"\u2014"}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-right tabular-nums">
                    {formatScore(entry?.normalized_score)}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                    {formatTime(entry?.efficiency?.wallClockSeconds)}
                  </td>
                  <td className="py-2.5 text-xs text-right tabular-nums text-[color:var(--muted-foreground)]">
                    {formatCost(entry?.efficiency?.llmApiCostUsd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] text-center">
          Table 3 &mdash; Best run per agent. Per-scenario breakdowns available
          on the{" "}
          <Link
            href="/leaderboard"
            className="underline hover:text-[color:var(--muted-foreground)] transition-colors"
          >
            leaderboard
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
