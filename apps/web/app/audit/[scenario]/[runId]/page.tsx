import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditLogViewer } from "@/components/audit-log-viewer";
import {
  getAuditRunManifest,
  getScenarioAuditContext,
  getScenarioAuditIndex,
  listAuditScenarios,
} from "@/data/audits";

const GATE_ORDER = ["functional", "correct", "robust", "performant", "production"] as const;
const GATE_LABELS: Record<string, { label: string; number: string; detail: string }> = {
  functional: { label: "Functional", number: "01", detail: "It runs" },
  correct: { label: "Correct", number: "02", detail: "Right answers" },
  robust: { label: "Robust", number: "03", detail: "Handles edge cases" },
  performant: { label: "Performant", number: "04", detail: "Fast enough" },
  production: { label: "Production", number: "05", detail: "Ship it" },
};

function formatScenarioName(value: string): string {
  return value
    .replace(/^foo-bar-/, "")
    .replace(/-/g, " ")
    .toUpperCase();
}

function formatTimestamp(raw: string): string {
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return raw || "—";
  return new Date(parsed).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function generateStaticParams() {
  const params: Array<{ scenario: string; runId: string }> = [];
  for (const scenario of listAuditScenarios()) {
    const index = getScenarioAuditIndex(scenario);
    for (const run of index?.runs ?? []) {
      params.push({ scenario, runId: run.runId });
    }
  }
  return params;
}

export default async function ScenarioAuditRunPage({
  params,
}: {
  params: Promise<{ scenario: string; runId: string }>;
}) {
  const { scenario, runId } = await params;
  const manifest = getAuditRunManifest(scenario, runId);
  const index = getScenarioAuditIndex(scenario);
  const context = getScenarioAuditContext(scenario);
  if (!manifest || !index) {
    notFound();
  }

  const scorePercent = Math.round(manifest.normalizedScore * 100);
  const totalAssertions = Object.values(manifest.gates).reduce((sum, g) => {
    return sum + Object.keys(g.core).length + Object.keys(g.scenario).length;
  }, 0);
  const passedAssertions = Object.values(manifest.gates).reduce((sum, g) => {
    return (
      sum +
      Object.values(g.core).filter(Boolean).length +
      Object.values(g.scenario).filter(Boolean).length
    );
  }, 0);

  return (
    <div className="px-4 lg:px-6 py-6">
      {/* Breadcrumb + Scenario Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-black/40 mb-3">
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
          <span className="text-black/70">{manifest.runId}</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl lg:text-5xl tracking-tight uppercase leading-[0.9]">
              {context?.title ?? formatScenarioName(scenario)}
            </h1>
            <p className="text-[11px] text-black/50 mt-2 max-w-2xl leading-relaxed">
              {context?.description ??
                "Static audit with full run evidence, rubric breakdown, and scenario metadata."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {index.runs.length >= 1 && (
              <Link
                href={`/audit/${scenario}/compare?left=${runId}&right=${index.runs.find((r) => r.runId !== runId)?.runId ?? index.runs[0]?.runId}`}
                className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 border-[2px] border-[#FF10F0] bg-[#FF10F0] text-black hover:bg-black hover:text-white hover:border-black transition-colors"
              >
                Compare Runs
              </Link>
            )}
            <Link
              href="/leaderboard"
              className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 border-[2px] border-black hover:bg-black hover:text-white transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              href="/audit"
              className="text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 border-[2px] border-black hover:bg-[#FF10F0] transition-colors"
            >
              All Scenarios
            </Link>
          </div>
        </div>
      </div>

      {/* Gate Pipeline Visualization */}
      <div className="border-[3px] border-black mb-5">
        <div className="bg-black px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
            Gate Progression
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#FF10F0]">
            {manifest.highestGate}/5 Cleared
          </span>
        </div>
        <div className="flex">
          {GATE_ORDER.map((gate, i) => {
            const detail = manifest.gates[gate];
            const meta = GATE_LABELS[gate]!;
            const passed = detail?.passed ?? false;
            const isHighest = i + 1 === manifest.highestGate;
            return (
              <div
                key={gate}
                className={`flex-1 p-3 lg:p-4 border-r border-black/10 last:border-r-0 transition-colors ${
                  passed
                    ? isHighest
                      ? "bg-[#FF10F0]"
                      : "bg-[#FF10F0]/20"
                    : "bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`font-[family-name:var(--font-display)] text-xl lg:text-2xl ${
                      passed ? "text-black" : "text-black/20"
                    }`}
                  >
                    {meta.number}
                  </span>
                  <div
                    className={`w-[10px] h-[10px] border-[2px] border-black ${
                      passed ? "bg-black" : "bg-transparent"
                    }`}
                  />
                </div>
                <p
                  className={`text-[9px] font-bold uppercase tracking-[0.14em] ${
                    passed ? "text-black" : "text-black/35"
                  }`}
                >
                  {meta.label}
                </p>
                <p
                  className={`text-[8px] uppercase tracking-[0.1em] mt-0.5 ${
                    passed ? "text-black/60" : "text-black/20"
                  }`}
                >
                  {meta.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-0 border-[3px] border-black mb-5">
        {[
          { label: "Score", value: `${scorePercent}%`, accent: scorePercent >= 80 },
          { label: "Highest Gate", value: String(manifest.highestGate), accent: manifest.highestGate >= 4 },
          {
            label: "Assertions",
            value: `${passedAssertions}/${totalAssertions}`,
            accent: passedAssertions === totalAssertions,
          },
          { label: "Runtime", value: formatDuration(manifest.efficiency.wallClockSeconds), accent: false },
          { label: "Steps", value: String(manifest.efficiency.agentSteps), accent: false },
          {
            label: "Tokens",
            value: manifest.efficiency.tokensUsed.toLocaleString(),
            accent: false,
          },
          {
            label: "Cost",
            value: `$${manifest.efficiency.llmApiCostUsd.toFixed(2)}`,
            accent: false,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="p-3 border-r border-black/10 last:border-r-0 border-b md:border-b-0"
          >
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-black/40">
              {metric.label}
            </p>
            <p
              className={`font-[family-name:var(--font-display)] text-xl lg:text-2xl mt-0.5 ${
                metric.accent ? "text-[#FF10F0]" : ""
              }`}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main content: sidebar + panels */}
      <div className="grid lg:grid-cols-[16rem_1fr] gap-4">
        {/* Run Selector Sidebar */}
        <aside className="border-[3px] border-black h-fit lg:sticky lg:top-[65px]">
          <div className="bg-black px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
              Runs ({index.runs.length})
            </p>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            {index.runs.map((run) => {
              const active = run.runId === runId;
              return (
                <Link
                  key={run.runId}
                  href={`/audit/${scenario}/${run.runId}`}
                  className={`block px-3 py-2.5 border-b border-black/10 last:border-b-0 transition-colors ${
                    active
                      ? "bg-[#FF10F0]"
                      : "hover:bg-black/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] truncate">
                      {run.harness}
                    </p>
                    <div className="flex gap-[2px] shrink-0">
                      {[1, 2, 3, 4, 5].map((g) => (
                        <div
                          key={g}
                          className={`w-[6px] h-[6px] border-[1.5px] border-black ${
                            g <= run.highestGate ? "bg-black" : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[9px] text-black/50 mt-0.5 truncate">
                    {run.agent} · {formatTimestamp(run.timestamp)}
                  </p>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main panels */}
        <div className="space-y-4 min-w-0">
          {/* Run Identity Bar */}
          <div className="border-[3px] border-black">
            <div className="bg-black px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
                Run Identity
              </span>
              <span className="text-[9px] uppercase tracking-[0.14em] text-white/40">
                {formatTimestamp(manifest.timestamp)}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-0">
              {[
                { label: "Run ID", value: manifest.runId },
                { label: "Harness", value: manifest.harness },
                { label: "Agent", value: manifest.agent },
                { label: "Model", value: manifest.model },
                { label: "Version", value: manifest.version },
              ].map((field) => (
                <div
                  key={field.label}
                  className="px-3 py-2.5 border-r border-black/10 last:border-r-0 border-b md:border-b-0"
                >
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-black/40">
                    {field.label}
                  </p>
                  <p className="text-[11px] mt-0.5 truncate">{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Log Viewer */}
          <AuditLogViewer scenario={scenario} runId={runId} logs={manifest.logs} />

          {/* Rubric + Scenario Data side-by-side */}
          <div className="grid xl:grid-cols-[1fr_1fr] gap-4">
            {/* Rubric Breakdown */}
            <div className="border-[3px] border-black">
              <div className="bg-black px-4 py-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
                  Rubric Breakdown
                </span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#FF10F0]">
                  {passedAssertions}/{totalAssertions}
                </span>
              </div>
              <div className="divide-y divide-black/10">
                {GATE_ORDER.map((gate) => {
                  const detail = manifest.gates[gate];
                  const meta = GATE_LABELS[gate]!;
                  if (!detail) return null;
                  const allAssertions = [
                    ...Object.entries(detail.core).map(([name, passed]) => ({
                      name,
                      passed,
                      type: "core" as const,
                    })),
                    ...Object.entries(detail.scenario).map(([name, passed]) => ({
                      name,
                      passed,
                      type: "scenario" as const,
                    })),
                  ];
                  return (
                    <div key={gate}>
                      <div
                        className={`px-3 py-2 flex items-center justify-between ${
                          detail.passed ? "bg-[#FF10F0]/10" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-[family-name:var(--font-display)] text-lg">
                            {meta.number}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
                            {meta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase tracking-[0.1em] text-black/50">
                            {(detail.score * 100).toFixed(0)}%
                          </span>
                          <span
                            className={`text-[8px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 border-[2px] ${
                              detail.passed
                                ? "border-black bg-[#FF10F0] text-black"
                                : "border-black/25 text-black/50"
                            }`}
                          >
                            {detail.passed ? "Pass" : "Fail"}
                          </span>
                        </div>
                      </div>
                      {allAssertions.length > 0 && (
                        <div className="px-3 pb-2">
                          {allAssertions.map((assertion) => (
                            <div
                              key={`${gate}-${assertion.type}-${assertion.name}`}
                              className="flex items-center justify-between py-1 border-b border-black/5 last:border-b-0"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`text-[8px] uppercase tracking-[0.1em] px-1 py-0 shrink-0 ${
                                    assertion.type === "core"
                                      ? "bg-black/10 text-black/50"
                                      : "bg-black/5 text-black/40"
                                  }`}
                                >
                                  {assertion.type}
                                </span>
                                <span className="text-[10px] text-black/70 truncate">
                                  {assertion.name.replace(/_/g, " ")}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-bold shrink-0 ${
                                  assertion.passed
                                    ? "text-[#FF10F0]"
                                    : "text-black/25"
                                }`}
                              >
                                {assertion.passed ? "✓" : "✗"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scenario Data + Prompts + Tasks */}
            <div className="space-y-4">
              {/* Scenario Metadata */}
              <div className="border-[3px] border-black">
                <div className="bg-black px-4 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
                    Scenario
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-0">
                  {[
                    { label: "ID", value: scenario },
                    { label: "Domain", value: context?.domain ?? "—" },
                    { label: "Tier", value: context?.tier ?? "—" },
                    { label: "Harness", value: context?.harness ?? manifest.harness },
                  ].map((field) => (
                    <div
                      key={field.label}
                      className="px-3 py-2 border-r border-black/10 odd:border-r-black/10 border-b border-b-black/10"
                    >
                      <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-black/40">
                        {field.label}
                      </p>
                      <p className="text-[11px] mt-0.5">{field.value}</p>
                    </div>
                  ))}
                </div>
                {context?.tags && context.tags.length > 0 && (
                  <div className="px-3 py-2 flex flex-wrap gap-1.5">
                    {context.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[8px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 border-[2px] border-black/15 text-black/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="border-[3px] border-black">
                <div className="bg-black px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
                    Tasks
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.14em] text-white/40">
                    {(context?.tasks ?? []).length}
                  </span>
                </div>
                <div className="divide-y divide-black/10">
                  {(context?.tasks ?? []).map((task) => (
                    <div key={task.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-bold uppercase tracking-[0.14em]">
                          {task.id}
                        </span>
                        <span className="text-[8px] uppercase tracking-[0.12em] text-black/35 bg-black/5 px-1.5 py-0">
                          {task.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-black/60 leading-relaxed">
                        {task.description}
                      </p>
                    </div>
                  ))}
                  {(!context?.tasks || context.tasks.length === 0) && (
                    <div className="px-3 py-3 text-[11px] text-black/40">
                      No task metadata available.
                    </div>
                  )}
                </div>
              </div>

              {/* Prompts */}
              <div className="border-[3px] border-black">
                <div className="bg-black px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
                    Prompts
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.14em] text-white/40">
                    {(context?.prompts ?? []).length} persona(s)
                  </span>
                </div>
                <div className="divide-y divide-black/10">
                  {(context?.prompts ?? []).map((prompt) => (
                    <div key={prompt.persona}>
                      <div className="px-3 py-1.5 bg-black/[0.03] flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-[0.16em]">
                          {prompt.persona}
                        </span>
                        <span className="text-[8px] uppercase tracking-[0.1em] text-black/30">
                          {prompt.path}
                        </span>
                      </div>
                      <pre className="m-0 max-h-32 overflow-auto px-3 py-2 bg-[#0d0d0d]">
                        <code className="text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap break-words">
                          {prompt.content}
                        </code>
                      </pre>
                    </div>
                  ))}
                  {(!context?.prompts || context.prompts.length === 0) && (
                    <div className="px-3 py-3 text-[11px] text-black/40">
                      No prompt files found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {manifest.notes && manifest.notes.length > 0 && (
            <div className="border-[2px] border-dashed border-black/20 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-black/40 mb-2">
                Notes
              </p>
              {manifest.notes.map((note, i) => (
                <p key={i} className="text-[11px] text-black/50 leading-relaxed">
                  {note}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
