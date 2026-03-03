import Link from "next/link";

import {
  getScenarioAuditIndex,
  getScenarioAuditContext,
  listAuditScenarios,
} from "@/data/audits";

function formatScenarioName(value: string): string {
  return value
    .replace(/^foo-bar-/, "")
    .replace(/-/g, " ")
    .toUpperCase();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTimestamp(raw: string): string {
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return raw || "—";
  return new Date(parsed).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditIndexPage() {
  const scenarioIds = listAuditScenarios();

  const scenarios = scenarioIds
    .map((id) => {
      const index = getScenarioAuditIndex(id);
      const context = getScenarioAuditContext(id);
      return { id, index, context };
    })
    .filter((s) => s.index && s.index.runs.length > 0);

  return (
    <div className="px-4 lg:px-8 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-black/40 mb-2">
            DEC Bench
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[5rem] tracking-tight uppercase leading-[0.85]">
            AUDIT
          </h1>
          <p className="mt-3 text-xs uppercase tracking-wider text-black/50 max-w-lg leading-relaxed">
            Run evidence, rubric breakdowns, and full agent traces for every
            evaluated scenario.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leaderboard"
            className="text-xs font-bold uppercase tracking-[0.15em] px-3 py-1.5 border-2 border-black hover:bg-black hover:text-white transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="border-[3px] border-black p-8 text-center">
          <p className="text-sm uppercase tracking-wider text-black/50">
            No audit bundles found. Export runs to see them here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((s) => {
            const latest = s.index!.runs[0]!;
            const runCount = s.index!.runs.length;
            const meta = latest;
            return (
              <Link
                key={s.id}
                href={`/audit/${s.id}/${latest.runId}`}
                className="group border-[3px] border-black hover:border-[#FF10F0] transition-colors flex flex-col"
              >
                <div className="bg-black px-4 py-2 flex items-center justify-between group-hover:bg-[#FF10F0] transition-colors">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-white group-hover:text-black transition-colors truncate">
                    {s.context?.title ?? formatScenarioName(s.id)}
                  </span>
                  <span className="text-xs uppercase tracking-[0.14em] text-white/50 group-hover:text-black/50 transition-colors shrink-0 ml-2">
                    →
                  </span>
                </div>

                <div className="px-4 py-2.5 flex-1">
                  <p className="text-sm text-black/55 leading-snug line-clamp-2 mb-2.5">
                    {s.context?.description ?? s.id}
                  </p>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex gap-[3px]">
                      {[1, 2, 3, 4, 5].map((g) => (
                        <div
                          key={g}
                          className={`w-2 h-2 border-[1.5px] border-black ${
                            g <= latest.highestGate
                              ? "bg-[#FF10F0]"
                              : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold">
                      {latest.highestGate}/5
                    </span>
                    <span className="text-xs text-black/40">
                      {Math.round(latest.normalizedScore * 100)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-0 border border-black/10">
                    {[
                      { label: "Runs", value: String(runCount) },
                      { label: "Agent", value: meta.agent ?? "—" },
                      { label: "Model", value: (meta.model ?? "—").replace("claude-", "").slice(0, 14) },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className="px-2.5 py-1.5 border-r border-black/10 last:border-r-0"
                      >
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">
                          {field.label}
                        </p>
                        <p className="text-xs mt-0.5 truncate">
                          {field.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-4 py-2 border-t border-black/10 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.12em] text-black/35">
                    {formatTimestamp(latest.timestamp)}
                  </span>
                  {runCount >= 2 && (
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-black/40">
                      {runCount} runs
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
