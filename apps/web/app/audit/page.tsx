import Link from "next/link";

import {
  getScenarioAuditIndex,
  getScenarioAuditContext,
  listAuditScenarios,
} from "@/data/audits";

function formatScenarioName(value: string): string {
  const words = value.replace(/^foo-bar-/, "").split("-");
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
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
    <div className="mx-auto max-w-[1420px] px-6 lg:px-14 py-10">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[color:var(--chart-4)] mb-2">
            DEC Bench
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-tight leading-[1.05] text-[color:var(--foreground)]">
            Audit
          </h1>
          <p className="mt-3 text-sm text-[color:var(--muted-foreground)] max-w-xl leading-relaxed">
            Run evidence, gate breakdowns, and full agent traces for every
            evaluated scenario.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leaderboard"
            className="text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)] hover:border-[color:var(--foreground)] transition-colors font-[family-name:var(--font-mono)]"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="border border-[color:var(--border)] bg-[color:var(--card)]">
          <div className="border-b border-[color:var(--border)] bg-[color:var(--secondary)]/60 px-5 py-2.5">
            <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              No auditable benchmark runs yet
            </p>
          </div>
          <div className="p-6">
            <p className="text-sm text-[color:var(--muted-foreground)] leading-relaxed max-w-xl mb-6">
              Audit pages appear after you run a benchmark and export the
              results. Each export creates an audit bundle with the full agent
              trace, assertion log, and scoring breakdown.
            </p>
            <div className="bg-[color:var(--secondary)]/70 border border-[color:var(--border)] p-4 font-mono text-xs leading-relaxed max-w-lg text-[color:var(--foreground)]">
              <p className="text-[color:var(--chart-4)] mb-1"># Run a benchmark</p>
              <p>dec-bench run --scenario &lt;ID&gt;</p>
              <p className="text-[color:var(--chart-4)] mt-3 mb-1">
                # Export the audit bundle
              </p>
              <p>dec-bench audit export --results-dir results</p>
              <p className="text-[color:var(--chart-4)] mt-3 mb-1">
                # Or run and open in one step
              </p>
              <p>
                dec-bench audit open --scenario &lt;ID&gt; --run-id &lt;RUN_ID&gt;
              </p>
            </div>
            <p className="text-xs text-[color:var(--chart-4)] mt-4">
              See the{" "}
              <Link
                href="/docs/running-evals"
                className="text-[color:var(--foreground)] underline decoration-[color:var(--accent)] underline-offset-4 hover:bg-[color:var(--secondary)] transition-colors"
              >
                running evals guide
              </Link>{" "}
              for the full walkthrough.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((s) => {
            const latest = s.index!.runs[0]!;
            const runCount = s.index!.runs.length;
            const meta = latest;
            return (
              <Link
                key={s.id}
                href={`/audit/${s.id}/${latest.runId}`}
                className="group border border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--foreground)] transition-colors flex flex-col"
              >
                <div className="bg-[color:var(--secondary)]/60 border-b border-[color:var(--border)] px-4 py-2 flex items-center justify-between">
                  <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] group-hover:text-[color:var(--foreground)] transition-colors truncate">
                    {s.context?.title ?? formatScenarioName(s.id)}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)] group-hover:text-[color:var(--foreground)] transition-colors shrink-0 ml-2">
                    →
                  </span>
                </div>

                <div className="px-4 py-3 flex-1">
                  <p className="text-sm text-[color:var(--muted-foreground)] leading-snug line-clamp-2 mb-3">
                    {s.context?.description ?? s.id}
                  </p>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex gap-[3px]">
                      {[1, 2, 3, 4, 5].map((g) => (
                        <div
                          key={g}
                          className={`w-2 h-2 border border-[color:var(--border)] ${
                            g <= latest.highestGate
                              ? "bg-[color:var(--accent)] border-[color:var(--accent)]"
                              : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-[color:var(--foreground)]">
                      {latest.highestGate}/5
                    </span>
                    <span className="text-xs text-[color:var(--chart-4)]">
                      {Math.round(latest.normalizedScore * 100)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 border border-[color:var(--border)]">
                    {[
                      { label: "Runs", value: String(runCount) },
                      { label: "Agent", value: meta.agent ?? "—" },
                      {
                        label: "Model",
                        value: (meta.model ?? "—").replace("claude-", "").slice(0, 14),
                      },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className="px-2.5 py-1.5 border-r border-[color:var(--border)] last:border-r-0"
                      >
                        <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
                          {field.label}
                        </p>
                        <p className="text-xs mt-0.5 truncate text-[color:var(--foreground)]">
                          {field.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-4 py-2 border-t border-[color:var(--border)] flex items-center justify-between">
                  <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--chart-4)]">
                    {formatTimestamp(latest.timestamp)}
                  </span>
                  {runCount >= 2 && (
                    <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
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
