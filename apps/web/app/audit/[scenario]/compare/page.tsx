import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAuditRunManifest,
  getScenarioAuditContext,
  getScenarioAuditIndex,
} from "@/data/audits";

import { CompareShell } from "./compare-shell";

const GATE_ORDER = ["functional", "correct", "robust", "performant", "production"] as const;

function formatScenarioName(value: string): string {
  return value
    .replace(/^foo-bar-/, "")
    .replace(/-/g, " ")
    .toUpperCase();
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ scenario: string }>;
  searchParams: Promise<{ left?: string; right?: string }>;
}) {
  const { scenario } = await params;
  const { left: leftId, right: rightId } = await searchParams;
  const index = getScenarioAuditIndex(scenario);
  const context = getScenarioAuditContext(scenario);

  if (!index || index.runs.length === 0) {
    notFound();
  }

  const resolvedLeftId = leftId ?? index.runs[0]?.runId;
  const resolvedRightId = rightId ?? index.runs[1]?.runId ?? index.runs[0]?.runId;

  if (!resolvedLeftId || !resolvedRightId) {
    notFound();
  }

  const leftManifest = getAuditRunManifest(scenario, resolvedLeftId);
  const rightManifest = getAuditRunManifest(scenario, resolvedRightId);

  if (!leftManifest || !rightManifest) {
    notFound();
  }

  const leftLogId = leftManifest.logs[0]?.id ?? "stdout";
  const rightLogId = rightManifest.logs[0]?.id ?? "stdout";

  const runs = index.runs.map((r) => ({
    runId: r.runId,
    harness: r.harness,
    agent: r.agent,
    model: r.model,
    timestamp: r.timestamp,
    highestGate: r.highestGate,
    normalizedScore: r.normalizedScore,
  }));

  const leftGates = GATE_ORDER.map((g) => ({
    gate: g,
    passed: leftManifest.gates[g]?.passed ?? false,
    score: leftManifest.gates[g]?.score ?? 0,
  }));
  const rightGates = GATE_ORDER.map((g) => ({
    gate: g,
    passed: rightManifest.gates[g]?.passed ?? false,
    score: rightManifest.gates[g]?.score ?? 0,
  }));

  return (
    <div className="px-4 lg:px-6 py-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-black/40 mb-4">
        <Link href="/audit" className="hover:text-black transition-colors">
          Audit
        </Link>
        <span>/</span>
        <Link
          href={`/audit/${scenario}`}
          className="hover:text-black transition-colors"
        >
          {formatScenarioName(scenario)}
        </Link>
        <span>/</span>
        <span className="text-black/70">Compare</span>
      </div>

      {/* Title */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl lg:text-4xl tracking-tight uppercase leading-[0.9]">
            {context?.title ?? formatScenarioName(scenario)}
            <span className="text-[#FF10F0] ml-2">Compare</span>
          </h1>
          <p className="text-xs text-black/50 mt-2 leading-relaxed">
            Side-by-side trace playback with synchronized controls.
          </p>
        </div>
        <Link
          href={`/audit/${scenario}/${resolvedLeftId}`}
          className="text-xs font-bold uppercase tracking-[0.15em] px-3 py-1.5 border-2 border-black hover:bg-[#FF10F0] transition-colors"
        >
          Back to Run
        </Link>
      </div>

      {/* Gate Comparison Strip */}
      <div className="grid grid-cols-2 gap-0 border-[3px] border-black mb-5">
        {[
          { manifest: leftManifest, gates: leftGates, label: "Left" },
          { manifest: rightManifest, gates: rightGates, label: "Right" },
        ].map((side, sideIdx) => (
          <div
            key={side.label}
            className={`${sideIdx === 0 ? "border-r-[3px] border-black" : ""}`}
          >
            <div className="bg-black px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white">
                {side.manifest.harness} · {side.manifest.agent}
              </span>
              <span className="text-xs uppercase tracking-[0.14em] text-[#FF10F0]">
                {side.manifest.highestGate}/5
              </span>
            </div>
            <div className="flex">
              {side.gates.map((g) => (
                <div
                  key={g.gate}
                  className={`flex-1 py-1.5 px-1 text-center border-r border-black/5 last:border-r-0 ${
                    g.passed ? "bg-[#FF10F0]/20" : ""
                  }`}
                >
                  <div
                    className={`w-[8px] h-[8px] mx-auto border-[1.5px] ${
                      g.passed ? "border-black bg-black" : "border-black/25 bg-transparent"
                    }`}
                  />
                  <p
                    className={`text-xs uppercase tracking-[0.08em] mt-0.5 ${
                      g.passed ? "text-black/60" : "text-black/35"
                    }`}
                  >
                    {g.gate.slice(0, 4)}
                  </p>
                </div>
              ))}
            </div>
            {/* Compact metrics */}
            <div className="grid grid-cols-4 border-t border-black/10">
              {[
                { l: "Score", v: `${Math.round(side.manifest.normalizedScore * 100)}%` },
                { l: "Time", v: `${side.manifest.efficiency.wallClockSeconds}s` },
                { l: "Steps", v: String(side.manifest.efficiency.agentSteps) },
                { l: "Cost", v: `$${side.manifest.efficiency.llmApiCostUsd.toFixed(2)}` },
              ].map((m) => (
                <div key={m.l} className="px-2 py-1.5 border-r border-black/5 last:border-r-0">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/35">
                    {m.l}
                  </p>
                  <p className="text-xs font-bold">{m.v}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Shell (client component) */}
      <CompareShell
        scenario={scenario}
        leftRunId={resolvedLeftId}
        rightRunId={resolvedRightId}
        leftLogId={leftLogId}
        rightLogId={rightLogId}
        leftLabel={`${leftManifest.harness} · ${leftManifest.agent}`}
        rightLabel={`${rightManifest.harness} · ${rightManifest.agent}`}
        runs={runs}
      />
    </div>
  );
}
