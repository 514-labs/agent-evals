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
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-2">
          DEC Bench
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[5rem] tracking-tight uppercase leading-[0.85]">
          AUDIT
        </h1>
        <p className="mt-3 text-[12px] uppercase tracking-wider text-black/50 max-w-lg">
          Inspect run evidence, rubric breakdowns, and full agent traces for
          every evaluated scenario.
        </p>
      </div>

      {scenarios.length === 0 ? (
        <div className="border-[3px] border-black p-8 text-center">
          <p className="text-[12px] uppercase tracking-wider text-black/50">
            No audit bundles found. Export runs to see them here.
          </p>
        </div>
      ) : (
        <div className="border-[3px] border-black">
          <div className="px-4 py-2.5 bg-black text-white flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
              Scenarios
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
              {scenarios.length} with runs
            </span>
          </div>

          <div className="divide-y divide-black/10">
            {scenarios.map((s) => {
              const latest = s.index!.runs[0]!;
              const runCount = s.index!.runs.length;
              return (
                <div key={s.id} className="group relative">
                <Link
                  href={`/audit/${s.id}/${latest.runId}`}
                  className="flex items-center gap-6 px-4 py-4 hover:bg-[#FF10F0] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold uppercase tracking-[0.1em]">
                      {s.context?.title ?? formatScenarioName(s.id)}
                    </p>
                    <p className="text-[11px] text-black/50 group-hover:text-black/70 mt-0.5 truncate max-w-xl">
                      {s.context?.description ?? s.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-black/40 group-hover:text-black/60">
                        Runs
                      </p>
                      <p className="font-[family-name:var(--font-display)] text-xl">
                        {runCount}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-black/40 group-hover:text-black/60">
                        Best Gate
                      </p>
                      <p className="font-[family-name:var(--font-display)] text-xl">
                        {latest.highestGate}/5
                      </p>
                    </div>
                    <div className="flex gap-[3px]">
                      {[1, 2, 3, 4, 5].map((g) => (
                        <div
                          key={g}
                          className={`w-[10px] h-[10px] border-[2px] border-black ${
                            g <= latest.highestGate
                              ? "bg-[#FF10F0]"
                              : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-bold text-black/30 group-hover:text-black/60">
                      →
                    </span>
                  </div>
                </Link>
                {runCount >= 2 && (
                  <div className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Link
                      href={`/audit/${s.id}/compare?left=${s.index!.runs[0]!.runId}&right=${s.index!.runs[1]?.runId ?? s.index!.runs[0]!.runId}`}
                      className="text-[8px] font-bold uppercase tracking-[0.14em] px-2 py-1 border-[2px] border-black bg-white hover:bg-[#FF10F0] transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Compare
                    </Link>
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
