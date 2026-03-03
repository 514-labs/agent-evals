import Link from "next/link";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";

import { AuditLogViewer } from "@/components/audit-log-viewer";
import { AuditTracePanel } from "@/components/audit-trace-panel";
import {
  getAuditRunTrace,
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
  return value.replace(/^foo-bar-/, "").replace(/-/g, " ").toUpperCase();
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

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function shortHash(value: string | undefined): string {
  if (!value) return "—";
  return value.slice(0, 12);
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
  const trace = getAuditRunTrace(scenario, runId);
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
  const runMeta = manifest.runMetadata;
  const currentPromptForPersona =
    runMeta && context
      ? context.prompts.find((prompt) => prompt.persona === runMeta.persona) ?? null
      : null;
  const currentPromptSha256 = currentPromptForPersona
    ? sha256(currentPromptForPersona.content)
    : null;
  const promptHashMatchesCurrent =
    runMeta?.promptSha256 && currentPromptSha256
      ? runMeta.promptSha256 === currentPromptSha256
      : null;

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
        <span className="text-black/70 truncate max-w-[12rem]">{manifest.runId}</span>
      </div>

      {/* Title + actions */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl lg:text-5xl tracking-tight uppercase leading-[0.9]">
            {context?.title ?? formatScenarioName(scenario)}
          </h1>
          <p className="text-sm text-black/50 mt-2 max-w-2xl leading-normal">
            {context?.description ?? "Static audit with full run evidence and rubric breakdown."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {index.runs.length >= 1 && (
            <Link
              href={`/audit/${scenario}/compare?left=${runId}&right=${index.runs.find((r) => r.runId !== runId)?.runId ?? index.runs[0]?.runId}`}
              className="text-xs font-bold uppercase tracking-[0.15em] px-3 py-1.5 border-2 border-[#FF10F0] bg-[#FF10F0] text-black hover:bg-black hover:text-white hover:border-black transition-colors"
            >
              Compare
            </Link>
          )}
          <Link
            href="/leaderboard"
            className="text-xs font-bold uppercase tracking-[0.15em] px-3 py-1.5 border-2 border-black hover:bg-black hover:text-white transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Gate pipeline */}
      <div className="border-[3px] border-black mb-4">
        <div className="bg-black px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-white">
            Gate Progression
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-[#FF10F0]">
            {manifest.highestGate}/5
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
                className={`flex-1 px-3 py-2 border-r border-black/10 last:border-r-0 transition-colors ${
                  passed
                    ? isHighest
                      ? "bg-[#FF10F0]"
                      : "bg-[#FF10F0]/20"
                    : "bg-white"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`font-[family-name:var(--font-display)] text-xl ${
                      passed ? "text-black" : "text-black/20"
                    }`}
                  >
                    {meta.number}
                  </span>
                  <div
                    className={`w-2 h-2 border-[1.5px] border-black ${
                      passed ? "bg-black" : "bg-transparent"
                    }`}
                  />
                </div>
                <p
                  className={`text-xs font-bold uppercase tracking-[0.14em] ${
                    passed ? "text-black" : "text-black/30"
                  }`}
                >
                  {meta.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-0 border-[3px] border-black mb-4">
        {[
          { label: "Score", value: `${scorePercent}%`, accent: scorePercent >= 80 },
          { label: "Gate", value: String(manifest.highestGate), accent: manifest.highestGate >= 4 },
          { label: "Assertions", value: `${passedAssertions}/${totalAssertions}`, accent: passedAssertions === totalAssertions },
          { label: "Runtime", value: formatDuration(manifest.efficiency.wallClockSeconds), accent: false },
          { label: "Steps", value: String(manifest.efficiency.agentSteps), accent: false },
          { label: "Tokens", value: manifest.efficiency.tokensUsed.toLocaleString(), accent: false },
          { label: "Cost", value: `$${manifest.efficiency.llmApiCostUsd.toFixed(2)}`, accent: false },
        ].map((metric) => (
          <div
            key={metric.label}
            className="p-2.5 border-r border-black/10 last:border-r-0 border-b lg:border-b-0"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">
              {metric.label}
            </p>
            <p
              className={`font-[family-name:var(--font-display)] text-lg mt-0.5 ${
                metric.accent ? "text-[#FF10F0]" : ""
              }`}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main grid: sidebar + content */}
      <div className="grid lg:grid-cols-[14rem_1fr] gap-4">
        {/* Run selector sidebar */}
        <aside className="border-[3px] border-black h-fit lg:sticky lg:top-[65px]">
          <div className="bg-black px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white">
              Runs ({index.runs.length})
            </p>
          </div>
          <div className="max-h-96 overflow-auto">
            {index.runs.map((run) => {
              const active = run.runId === runId;
              return (
                <Link
                  key={run.runId}
                  href={`/audit/${scenario}/${run.runId}`}
                  className={`block px-3 py-2 border-b border-black/10 last:border-b-0 transition-colors ${
                    active ? "bg-[#FF10F0]" : "hover:bg-black/3"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] truncate">
                      {run.harness}
                    </p>
                    <div className="flex gap-[2px] shrink-0">
                      {[1, 2, 3, 4, 5].map((g) => (
                        <div
                          key={g}
                          className={`w-[5px] h-[5px] border-[1px] border-black ${
                            g <= run.highestGate ? "bg-black" : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-black/50 mt-0.5 truncate">
                    {run.agent} · {formatTimestamp(run.timestamp)}
                  </p>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <div className="space-y-4 min-w-0">
          {/* Run identity + prompt: consolidated into one block */}
          <div className="border-[3px] border-black">
            <div className="bg-black px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-white">
                Run Configuration
              </span>
              <span className="text-xs uppercase tracking-[0.14em] text-white/40">
                {formatTimestamp(manifest.timestamp)}
              </span>
            </div>
            {/* Identity row */}
            <div className="grid grid-cols-3 md:grid-cols-7 gap-0 border-b border-black/10">
              {[
                { label: "Harness", value: manifest.harness },
                { label: "Agent", value: manifest.agent },
                { label: "Model", value: manifest.model },
                { label: "Version", value: manifest.version },
                { label: "Persona", value: runMeta?.persona ?? "—" },
                { label: "Plan Mode", value: runMeta?.planMode ?? "—" },
                {
                  label: "Prompt",
                  value:
                    promptHashMatchesCurrent === true
                      ? "Current"
                      : promptHashMatchesCurrent === false
                        ? "Differs"
                        : "Unknown",
                },
              ].map((field) => (
                <div
                  key={field.label}
                  className="px-3 py-2 border-r border-black/10 last:border-r-0 border-b md:border-b-0"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">
                    {field.label}
                  </p>
                  <p className="text-xs mt-0.5 truncate">{field.value}</p>
                </div>
              ))}
            </div>
            {/* Prompt content */}
            <details>
              <summary className="cursor-pointer list-none px-4 py-2 flex items-center justify-between hover:bg-black/3 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.14em]">
                    Prompt Used
                  </span>
                  <span
                    className={`text-xs font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 ${
                      promptHashMatchesCurrent === true
                        ? "bg-[#FF10F0]/20 text-black/70"
                        : promptHashMatchesCurrent === false
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-black/5 text-black/40"
                    }`}
                  >
                    {promptHashMatchesCurrent === true
                      ? "Matches current"
                      : promptHashMatchesCurrent === false
                        ? "Differs from current"
                        : "Comparison unavailable"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-black/30 font-mono">
                    {shortHash(runMeta?.promptSha256)}
                  </span>
                  <span className="text-xs text-black/30">+</span>
                </div>
              </summary>
              <div className="border-t border-black/10">
                <div className="px-4 py-1.5 flex items-center gap-4 bg-black/3 text-xs text-black/45">
                  <span>
                    Path: {runMeta?.promptPath ?? "—"}
                  </span>
                  <span>
                    Current hash: {shortHash(currentPromptSha256 ?? undefined)}
                  </span>
                </div>
                <pre className="m-0 max-h-48 overflow-auto px-4 py-2.5 bg-[#0d0d0d]">
                  <code className="text-xs leading-relaxed text-white/70 whitespace-pre-wrap break-words">
                    {runMeta?.promptContent ?? runMeta?.promptPreview ?? "No prompt content captured."}
                  </code>
                </pre>
              </div>
            </details>
          </div>

          {/* Agent interaction timeline */}
          <AuditTracePanel summary={manifest.traceSummary} trace={trace} />

          {/* Log viewer */}
          <AuditLogViewer scenario={scenario} runId={runId} logs={manifest.logs} />

          {/* Rubric + Scenario side-by-side */}
          <div className="grid xl:grid-cols-2 gap-4">
            {/* Rubric */}
            <div className="border-[3px] border-black">
              <div className="bg-black px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-white">
                  Rubric
                </span>
                <span className="text-xs uppercase tracking-[0.14em] text-[#FF10F0]">
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
                        className={`px-3 py-1.5 flex items-center justify-between ${
                          detail.passed ? "bg-[#FF10F0]/10" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-[family-name:var(--font-display)] text-base">
                            {meta.number}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-[0.14em]">
                            {meta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-black/45">
                            {(detail.score * 100).toFixed(0)}%
                          </span>
                          <span
                            className={`text-xs font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border-2 ${
                              detail.passed
                                ? "border-black bg-[#FF10F0] text-black"
                                : "border-black/20 text-black/40"
                            }`}
                          >
                            {detail.passed ? "Pass" : "Fail"}
                          </span>
                        </div>
                      </div>
                      {allAssertions.length > 0 && (
                        <div className="px-3 py-1.5">
                          {allAssertions.map((assertion) => (
                            <div
                              key={`${gate}-${assertion.type}-${assertion.name}`}
                              className="flex items-center justify-between py-1"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`text-xs uppercase tracking-[0.1em] px-1 shrink-0 ${
                                    assertion.type === "core"
                                      ? "bg-black/8 text-black/45"
                                      : "bg-black/4 text-black/35"
                                  }`}
                                >
                                  {assertion.type}
                                </span>
                                <span className="text-xs text-black/65 truncate">
                                  {assertion.name.replace(/_/g, " ")}
                                </span>
                              </div>
                              <span
                                className={`text-sm font-bold shrink-0 leading-none ${
                                  assertion.passed ? "text-[#FF10F0]" : "text-black/20"
                                }`}
                              >
                                {assertion.passed ? "+" : "x"}
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

            {/* Scenario info */}
            <div className="space-y-4">
              <div className="border-[3px] border-black">
                <div className="bg-black px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-white">
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
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">
                        {field.label}
                      </p>
                      <p className="text-xs mt-0.5">{field.value}</p>
                    </div>
                  ))}
                </div>
                {context?.tags && context.tags.length > 0 && (
                  <div className="px-3 py-2 flex flex-wrap gap-1">
                    {context.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border border-black/15 text-black/45"
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
                  <span className="text-xs font-bold uppercase tracking-[0.3em] text-white">
                    Tasks
                  </span>
                  <span className="text-xs uppercase tracking-[0.14em] text-white/40">
                    {(context?.tasks ?? []).length}
                  </span>
                </div>
                <div className="divide-y divide-black/10">
                  {(context?.tasks ?? []).map((task) => (
                    <div key={task.id} className="px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold uppercase tracking-[0.14em]">
                          {task.id}
                        </span>
                        <span className="text-xs uppercase tracking-[0.12em] text-black/30 bg-black/5 px-1 py-0">
                          {task.category}
                        </span>
                      </div>
                      <p className="text-xs text-black/55 leading-normal">
                        {task.description}
                      </p>
                    </div>
                  ))}
                  {(!context?.tasks || context.tasks.length === 0) && (
                    <div className="px-3 py-3 text-xs text-black/35">
                      No task metadata available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
