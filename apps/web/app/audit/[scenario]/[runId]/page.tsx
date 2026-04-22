import Link from "next/link";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";
import { codeToHtml } from "shiki";

import { AuditLogViewer } from "@/components/audit-log-viewer";
import { AuditGatesPanel } from "@/components/audit-gates-panel";
import { AuditTracePanel } from "@/components/audit-trace-panel";
import {
  getAssertionLogs,
  getAuditRunTrace,
  getAuditRunManifest,
  getAssertionSources,
  getCoreAssertionSource,
  getScenarioAssertionCatalog,
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

function formatTokensShort(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 10_000) return `${Math.round(tokens / 1_000)}k`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return tokens.toLocaleString();
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

/**
 * Section heading used throughout the run detail page.
 * Matches the muted, paper-document aesthetic of the docs/marketing site:
 * small mono label on a subtle secondary surface with a hairline border.
 */
function SectionHeader({
  title,
  meta,
  className = "",
}: {
  title: string;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 bg-[color:var(--secondary)]/60 border-b border-[color:var(--border)] px-4 py-2 ${className}`}
    >
      <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
        {title}
      </span>
      {meta ? (
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
          {meta}
        </span>
      ) : null}
    </div>
  );
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
  const assertionLogs = getAssertionLogs(scenario, runId);
  if (!manifest || !index) {
    notFound();
  }

  const assertionSources = getAssertionSources(scenario);
  const assertionCatalog = getScenarioAssertionCatalog(scenario);

  const highlightCode = async (code: string) =>
    codeToHtml(code, {
      lang: "typescript",
      themes: { light: "vitesse-light", dark: "vitesse-dark" },
    });

  const highlightedScenarioSources: Partial<Record<string, string>> = {};
  for (const [gate, source] of Object.entries(assertionSources.scenario)) {
    if (source) {
      highlightedScenarioSources[gate] = await highlightCode(source);
    }
  }

  const highlightedCoreSources: Record<string, string> = {};
  const allCoreNames = new Set<string>();
  for (const gateResult of Object.values(manifest.gates)) {
    for (const name of Object.keys(gateResult.core)) {
      allCoreNames.add(name);
    }
  }
  for (const gateCoreNames of Object.values(assertionCatalog.core)) {
    for (const name of gateCoreNames) {
      allCoreNames.add(name);
    }
  }
  for (const name of allCoreNames) {
    const src = getCoreAssertionSource(name);
    if (src) {
      highlightedCoreSources[name] = await highlightCode(src);
    }
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
  const traceUsage = trace?.usage;
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
  const costValue = `$${manifest.efficiency.llmApiCostUsd.toFixed(2)}`;
  const costDescription =
    manifest.efficiency.llmApiCostSource === "agent-reported"
      ? "API cost reported directly by the agent CLI."
      : "API cost derived from the stored token buckets using published per-token pricing because the agent CLI did not report a dollar amount.";

  return (
    <div className="mx-auto max-w-[1420px] px-6 lg:px-14 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--chart-4)] mb-4">
        <Link
          href="/audit"
          className="hover:text-[color:var(--foreground)] transition-colors"
        >
          Audit
        </Link>
        <span>›</span>
        <Link
          href={`/audit/${scenario}`}
          className="hover:text-[color:var(--foreground)] transition-colors"
        >
          {formatScenarioName(scenario)}
        </Link>
        <span>›</span>
        <span className="text-[color:var(--muted-foreground)] truncate">
          {manifest.model} · {manifest.harness}
        </span>
      </div>

      {/* Title */}
      <div className="mb-4">
        <h1 className="font-[family-name:var(--font-display)] text-3xl lg:text-4xl tracking-tight leading-[1.1] text-[color:var(--foreground)]">
          {context?.title ?? formatScenarioName(scenario)}
        </h1>
        <p className="text-sm text-[color:var(--muted-foreground)] mt-2 max-w-2xl leading-normal">
          {context?.description ??
            "Static audit with full run evidence and gate breakdown."}
        </p>
      </div>

      {/* Actions row: in-page jumps on the left, cross-page actions on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="#trace"
            className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--secondary)] hover:border-[color:var(--foreground)] transition-colors"
          >
            Trace
          </a>
          <a
            href="#logs"
            className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--secondary)] hover:border-[color:var(--foreground)] transition-colors"
          >
            Debug
          </a>
          <a
            href="#gates"
            className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--secondary)] hover:border-[color:var(--foreground)] transition-colors"
          >
            Gates
          </a>
          <a
            href="#config"
            className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--secondary)] hover:border-[color:var(--foreground)] transition-colors"
          >
            Setup & Scenario
          </a>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {index.runs.length >= 1 && (
            <Link
              href={`/audit/${scenario}/compare?left=${runId}&right=${index.runs.find((r) => r.runId !== runId)?.runId ?? index.runs[0]?.runId}`}
              className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 border border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-foreground)] hover:bg-[color:var(--foreground)] hover:border-[color:var(--foreground)] transition-colors"
            >
              Compare
            </Link>
          )}
          <Link
            href="/leaderboard"
            className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)] hover:border-[color:var(--foreground)] transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Verdict strip — compact, single row so Trace/Logs stay above the fold.
          Tiles deep-link to their relevant detail section. */}
      <div className="border border-[color:var(--border)] bg-[color:var(--card)] mb-6 flex flex-wrap items-stretch">
        {/* Score → Gates (score is derived from gate evaluation) */}
        <a
          href="#gates"
          className="group flex items-center gap-2 px-4 py-2 border-r border-[color:var(--border)] hover:bg-[color:var(--secondary)]/60 transition-colors"
          title="Jump to Gates"
        >
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--chart-4)] group-hover:text-[color:var(--foreground)]">
            Score
          </span>
          <span
            className={`font-[family-name:var(--font-display)] text-2xl leading-none ${
              scorePercent >= 80
                ? "text-[color:var(--accent)]"
                : scorePercent >= 40
                  ? "text-[color:var(--foreground)]"
                  : "text-[color:var(--chart-4)]"
            }`}
          >
            {scorePercent}%
          </span>
        </a>
        {/* Gates → Gates */}
        <a
          href="#gates"
          className="group flex items-center gap-2 px-4 py-2 border-r border-[color:var(--border)] hover:bg-[color:var(--secondary)]/60 transition-colors"
          title="Jump to Gates"
        >
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--chart-4)] group-hover:text-[color:var(--foreground)]">
            Gates
          </span>
          <span className="font-[family-name:var(--font-display)] text-2xl leading-none text-[color:var(--foreground)]">
            {manifest.highestGate}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
            of 5 cleared
          </span>
        </a>
        {/* Assertions → Gates (assertions live inside the gates panel) */}
        <a
          href="#gates"
          className="group flex items-center gap-2 px-4 py-2 border-r border-[color:var(--border)] hover:bg-[color:var(--secondary)]/60 transition-colors"
          title="Jump to Gates"
        >
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--chart-4)] group-hover:text-[color:var(--foreground)]">
            Assertions
          </span>
          <span className="font-[family-name:var(--font-display)] text-2xl leading-none text-[color:var(--foreground)]">
            {passedAssertions}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
            of {totalAssertions}
          </span>
          <span
            className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] ${
              passedAssertions === totalAssertions
                ? "text-[color:var(--accent)]"
                : "text-[color:var(--foreground)]"
            }`}
          >
            passed
          </span>
        </a>
        {/* Runtime */}
        <div className="flex items-center gap-2 px-4 py-2 border-r border-[color:var(--border)]">
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--chart-4)]">
            Runtime
          </span>
          <span className="font-[family-name:var(--font-display)] text-2xl leading-none text-[color:var(--foreground)]">
            {formatDuration(manifest.efficiency.wallClockSeconds)}
          </span>
        </div>
        {/* Tokens (total + input/output when reported) */}
        <div className="flex items-center gap-2 px-4 py-2 border-r border-[color:var(--border)]">
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--chart-4)]">
            Tokens
          </span>
          <span className="font-[family-name:var(--font-display)] text-2xl leading-none text-[color:var(--foreground)]">
            {formatTokensShort(manifest.efficiency.tokensUsed)}
          </span>
          {(typeof traceUsage?.inputTokens === "number" && traceUsage.inputTokens > 0) ||
          (typeof traceUsage?.outputTokens === "number" && traceUsage.outputTokens > 0) ? (
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
              {typeof traceUsage?.inputTokens === "number" && traceUsage.inputTokens > 0
                ? `${formatTokensShort(traceUsage.inputTokens)} in`
                : null}
              {typeof traceUsage?.inputTokens === "number" &&
              traceUsage.inputTokens > 0 &&
              typeof traceUsage?.outputTokens === "number" &&
              traceUsage.outputTokens > 0
                ? " · "
                : null}
              {typeof traceUsage?.outputTokens === "number" && traceUsage.outputTokens > 0
                ? `${formatTokensShort(traceUsage.outputTokens)} out`
                : null}
            </span>
          ) : null}
        </div>
        {/* Cost */}
        <div
          className="flex items-center gap-2 px-4 py-2 border-r border-[color:var(--border)]"
          title={costDescription}
        >
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--chart-4)]">
            Cost
          </span>
          <span className="font-[family-name:var(--font-display)] text-2xl leading-none text-[color:var(--foreground)]">
            {costValue}
          </span>
        </div>
      </div>

      {/* Main grid: sidebar + content */}
      <div className="grid lg:grid-cols-[15rem_1fr] gap-6">
        {/* Sticky sidebar: runs list only — jump nav lives in the page header. */}
        <aside className="border border-[color:var(--border)] bg-[color:var(--card)] h-fit lg:sticky lg:top-[70px]">
          <SectionHeader title={`Runs (${index.runs.length})`} />
          <div className="max-h-[28rem] overflow-auto">
            {index.runs.map((run) => {
              const active = run.runId === runId;
              return (
                <Link
                  key={run.runId}
                  href={`/audit/${scenario}/${run.runId}`}
                  className={`block px-3 py-2 border-b border-[color:var(--border)] last:border-b-0 transition-colors ${
                    active
                      ? "bg-[color:var(--accent)]/10 border-l-2 border-l-[color:var(--accent)]"
                      : "hover:bg-[color:var(--secondary)]/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--foreground)] truncate">
                      {run.harness}
                    </p>
                    <div className="flex gap-[2px] shrink-0">
                      {[1, 2, 3, 4, 5].map((g) => (
                        <div
                          key={g}
                          className={`w-[5px] h-[5px] border border-[color:var(--border)] ${
                            g <= run.highestGate
                              ? "bg-[color:var(--foreground)] border-[color:var(--foreground)]"
                              : "bg-transparent"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5 truncate">
                    {run.agent} · {formatTimestamp(run.timestamp)}
                  </p>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <div className="space-y-6 min-w-0">
          {/* Trace + Debugging Output stay at the very top (514-1284):
              above-the-fold evidence for triage is the most important thing
              on this page. Verdict lives in the compact strip above the grid. */}
          <section id="trace" className="scroll-mt-24">
            <AuditTracePanel summary={manifest.traceSummary} trace={trace} />
          </section>
          <section id="logs" className="scroll-mt-24">
            <AuditLogViewer scenario={scenario} runId={runId} logs={manifest.logs} />
          </section>

          {/* Gates — includes progression strip in its header */}
          <section id="gates" className="scroll-mt-24">
          <AuditGatesPanel
            gates={manifest.gates}
            passedAssertions={passedAssertions}
            totalAssertions={totalAssertions}
            highestGate={manifest.highestGate}
            assertionLogs={assertionLogs}
            assertionCatalog={assertionCatalog}
            highlightedSources={{
              scenario: highlightedScenarioSources,
              core: highlightedCoreSources,
            }}
          />
          </section>

          {/* Run Configuration + Prompt */}
          <section
            id="config"
            className="scroll-mt-24 border border-[color:var(--border)] bg-[color:var(--card)]"
          >
            <SectionHeader
              title="Run Configuration"
              meta={formatTimestamp(manifest.timestamp)}
            />
            <div className="grid grid-cols-3 md:grid-cols-7 border-b border-[color:var(--border)]">
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
                  className="px-3 py-2 border-r border-[color:var(--border)] last:border-r-0 border-b border-b-[color:var(--border)] md:border-b-0"
                >
                  <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
                    {field.label}
                  </p>
                  <p className="font-[family-name:var(--font-mono)] text-[11px] mt-0.5 truncate text-[color:var(--foreground)]">
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
            <details>
              <summary className="cursor-pointer list-none px-4 py-2 flex items-center justify-between hover:bg-[color:var(--secondary)]/60 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                    Prompt Used
                  </span>
                  <span
                    title={
                      promptHashMatchesCurrent === true
                        ? "The SHA-256 hash of the prompt used in this run matches the prompt file on disk. The agent ran with the latest version."
                        : promptHashMatchesCurrent === false
                          ? "The prompt used in this run differs from the current prompt file on disk. Results may not reflect latest prompt changes."
                          : "Unable to compare — either the run or the current prompt hash is unavailable."
                    }
                    className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 border ${
                      promptHashMatchesCurrent === true
                        ? "border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[color:var(--foreground)]"
                        : promptHashMatchesCurrent === false
                          ? "border-yellow-400 bg-yellow-100 text-yellow-900"
                          : "border-[color:var(--border)] bg-[color:var(--secondary)] text-[color:var(--chart-4)]"
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
                  <span className="text-xs text-[color:var(--chart-4)] font-mono">
                    {shortHash(runMeta?.promptSha256)}
                  </span>
                  <span className="text-xs text-[color:var(--chart-4)]">+</span>
                </div>
              </summary>
              <div className="border-t border-[color:var(--border)]">
                <div className="px-4 py-1.5 flex items-center gap-4 bg-[color:var(--secondary)]/60 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--chart-4)]">
                  <span>Path: {runMeta?.promptPath ?? "—"}</span>
                  <span>
                    Current hash: {shortHash(currentPromptSha256 ?? undefined)}
                  </span>
                </div>
                <pre className="m-0 max-h-56 overflow-auto px-4 py-3 bg-[color:var(--secondary)]/40 border-t border-[color:var(--border)]">
                  <code className="font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[color:var(--foreground)] whitespace-pre-wrap break-words">
                    {runMeta?.promptContent ??
                      runMeta?.promptPreview ??
                      "No prompt content captured."}
                  </code>
                </pre>
              </div>
            </details>
          </section>

          {/* Scenario context */}
          <section id="scenario" className="scroll-mt-24 grid xl:grid-cols-2 gap-4">
            {/* Scenario identity + tags */}
            <div className="border border-[color:var(--border)] bg-[color:var(--card)]">
              <SectionHeader title="Scenario" />
              <div className="grid grid-cols-2">
                {[
                  { label: "ID", value: scenario },
                  { label: "Domain", value: context?.domain ?? "—" },
                  { label: "Tier", value: context?.tier ?? "—" },
                  { label: "Harness", value: manifest.harness },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="px-3 py-2 border-r border-[color:var(--border)] odd:border-r-[color:var(--border)] border-b border-b-[color:var(--border)]"
                  >
                    <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
                      {field.label}
                    </p>
                    <p className="font-[family-name:var(--font-mono)] text-[11px] mt-0.5 text-[color:var(--foreground)]">
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
              {context?.tags && context.tags.length > 0 && (
                <div className="px-3 py-2 flex flex-wrap gap-1">
                  {context.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border border-[color:var(--border)] text-[color:var(--muted-foreground)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Starting State + Tasks */}
            <div className="space-y-4">
              {context?.infrastructure && (
                <div className="border border-[color:var(--border)] bg-[color:var(--card)]">
                  <div className="bg-[color:var(--secondary)]/60 border-b border-[color:var(--border)] px-4 py-2 flex items-center justify-between gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                      Starting State
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {context.infrastructure.services.map((service) => (
                        <span
                          key={service}
                          className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border border-[color:var(--border)] text-[color:var(--muted-foreground)]"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                  {context.infrastructure.description && (
                    <div className="px-4 py-3">
                      <p className="text-xs text-[color:var(--muted-foreground)] leading-normal">
                        {context.infrastructure.description}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="border border-[color:var(--border)] bg-[color:var(--card)]">
                <SectionHeader
                  title="Tasks"
                  meta={String((context?.tasks ?? []).length)}
                />
                <div className="divide-y divide-[color:var(--border)]">
                  {(context?.tasks ?? []).map((task) => (
                    <div key={task.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--foreground)]">
                          {task.id}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--chart-4)] bg-[color:var(--secondary)] px-1 py-0">
                          {task.category}
                        </span>
                      </div>
                      <p className="text-xs text-[color:var(--muted-foreground)] leading-normal">
                        {task.description}
                      </p>
                    </div>
                  ))}
                  {(!context?.tasks || context.tasks.length === 0) && (
                    <div className="px-4 py-3 text-xs text-[color:var(--chart-4)]">
                      No task metadata available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
