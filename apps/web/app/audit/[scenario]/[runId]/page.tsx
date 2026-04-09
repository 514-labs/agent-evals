import Link from "next/link";
import { notFound } from "next/navigation";
import { createHash } from "node:crypto";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { DecTag } from "@workspace/ui/components/dec-tag";
import { DataTable } from "@workspace/ui/components/data-table";

import {
  SectionHeading,
  SectionDescription,
  GateAssertionGrid,
  AgentInteractionCard,
  DebuggingCard,
  SidebarToc,
  AgentStandings,
  CompareRunsCta,
  ComparisonCharts,
} from "@/components/run-detail";

import {
  getAssertionLogs,
  getAuditRunTrace,
  getAuditRunManifest,
  getScenarioAuditContext,
  getScenarioAuditIndex,
  listAuditScenarios,
} from "@/data/audits";
import { getLeaderboardEntries } from "@/data/results";

const GATE_ORDER = ["functional", "correct", "robust", "performant", "production"] as const;
const GATE_LABELS: Record<string, { label: string; number: string; description: string }> = {
  functional: { label: "Functional", number: "G1", description: "It runs without errors" },
  correct: { label: "Correct", number: "G2", description: "Produces expected output" },
  robust: { label: "Robust", number: "G3", description: "Handles edge cases" },
  performant: { label: "Performant", number: "G4", description: "Meets latency targets" },
  production: { label: "Production", number: "G5", description: "Ship-ready code quality" },
};

function formatScenarioTitle(value: string): string {
  const words = value.replace(/^foo-bar-/, "").split("-");
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

export default async function RunDetailPage({
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
  if (!manifest || !index) notFound();

  const runMeta = manifest.runMetadata;
  const currentPromptForPersona =
    runMeta && context
      ? context.prompts.find((p) => p.persona === runMeta.persona) ?? null
      : null;
  const currentPromptSha256 = currentPromptForPersona
    ? sha256(currentPromptForPersona.content)
    : null;
  const promptMatchesCurrent =
    runMeta?.promptSha256 && currentPromptSha256
      ? runMeta.promptSha256 === currentPromptSha256
      : null;

  const totalAssertions = Object.values(manifest.gates).reduce(
    (sum, g) => sum + Object.keys(g.core).length + Object.keys(g.scenario).length,
    0,
  );
  const passedAssertions = Object.values(manifest.gates).reduce(
    (sum, g) =>
      sum +
      Object.values(g.core).filter(Boolean).length +
      Object.values(g.scenario).filter(Boolean).length,
    0,
  );

  const failedAssertionNames = Object.entries(manifest.gates).flatMap(([, g]) => [
    ...Object.entries(g.core).filter(([, v]) => !v).map(([k]) => k),
    ...Object.entries(g.scenario).filter(([, v]) => !v).map(([k]) => k),
  ]);

  const scenarioTitle = context?.title ?? formatScenarioTitle(scenario);

  // Build agent standings for sidebar
  const allEntries = getLeaderboardEntries();
  const allScenarioRuns = allEntries.filter((e) => e.scenario === scenario);
  const scenarioEntries = [...allScenarioRuns]
    .sort((a, b) => b.normalized_score - a.normalized_score)
    .slice(0, 4)
    .map((e, i) => ({
      rank: i + 1,
      agent: e.agent,
      model: e.model,
      score: e.normalized_score,
      highestGate: e.highest_gate,
      isCurrentRun: e.run_id === runId,
    }));

  const chartRuns = allScenarioRuns.map((e) => ({
    score: e.normalized_score,
    cost: e.efficiency.llmApiCostUsd,
    time: e.efficiency.wallClockSeconds,
    agent: e.agent,
    isCurrentRun: e.run_id === runId,
  }));

  // Run number within this scenario
  const runIndex = index.runs.findIndex((r) => r.runId === runId);
  const runNumber = runIndex >= 0 ? runIndex + 1 : 1;

  // Compare href
  const otherRun = index.runs.find((r) => r.runId !== runId);
  const compareHref = otherRun
    ? `/audit/${scenario}/compare?left=${runId}&right=${otherRun.runId}`
    : `/audit/${scenario}`;

  // Narrative summary
  const gateReached = GATE_LABELS[GATE_ORDER[manifest.highestGate - 1] ?? ""] ?? null;
  const narrativeParts: string[] = [];
  narrativeParts.push(
    `${manifest.agent} (${manifest.model}) attempted the ${formatScenarioTitle(scenario)} scenario`,
  );
  if (context?.infrastructure?.services.length) {
    narrativeParts.push(
      ` on ${context.infrastructure.services.join(", ")} infrastructure`,
    );
  }
  if (runMeta?.persona) {
    narrativeParts.push(` with a ${runMeta.persona} prompt`);
  }
  narrativeParts.push(".");
  if (gateReached) {
    narrativeParts.push(
      ` It cleared ${manifest.highestGate} of 5 gates, reaching ${gateReached.label} (${gateReached.number}), with a score of ${manifest.normalizedScore.toFixed(2)}.`,
    );
  }
  if (failedAssertionNames.length > 0 && failedAssertionNames.length <= 5) {
    narrativeParts.push(
      ` It fell short on: ${failedAssertionNames.map((n) => n.replace(/_/g, " ")).join(", ")}.`,
    );
  }
  narrativeParts.push(
    ` At $${manifest.efficiency.llmApiCostUsd.toFixed(2)} and ${formatDuration(manifest.efficiency.wallClockSeconds)}.`,
  );
  const narrative = narrativeParts.join("");

  // Efficiency metrics for table
  const efficiencyMetrics = [
    { label: "Runtime", value: formatDuration(manifest.efficiency.wallClockSeconds) },
    { label: "Steps", value: String(manifest.efficiency.agentSteps) },
    { label: "Tokens", value: manifest.efficiency.tokensUsed.toLocaleString() },
    { label: "Cost", value: `$${manifest.efficiency.llmApiCostUsd.toFixed(2)}` },
  ];

  const traceUsage = trace?.usage;
  const tokenBreakdown = [
    traceUsage?.inputTokens ? { label: "Input", value: traceUsage.inputTokens.toLocaleString() } : null,
    traceUsage?.outputTokens ? { label: "Output", value: traceUsage.outputTokens.toLocaleString() } : null,
    traceUsage?.cachedInputTokens ? { label: "Cached", value: traceUsage.cachedInputTokens.toLocaleString() } : null,
    traceUsage?.cacheReadTokens ? { label: "Cache Read", value: traceUsage.cacheReadTokens.toLocaleString() } : null,
    traceUsage?.cacheWriteTokens ? { label: "Cache Write", value: traceUsage.cacheWriteTokens.toLocaleString() } : null,
  ].filter((m): m is { label: string; value: string } => m !== null && m.value !== "0");

  return (
    <div className="w-full">
      {/* ── Breadcrumb bar ── */}
      <div className="w-full bg-secondary border-b border-background">
        <div className="max-w-[1440px] mx-auto px-6 lg:pl-[185px] lg:pr-6">
          <div className="flex items-center gap-[7px] h-[34px] font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.72px]">
            <Link
              href="/audit"
              className="text-chart-4 hover:text-muted-foreground transition-colors"
            >
              Scenarios
            </Link>
            <span className="text-chart-4">/</span>
            <Link
              href={`/audit/${scenario}`}
              className="text-chart-4 hover:text-muted-foreground transition-colors"
            >
              {scenarioTitle}
            </Link>
            <span className="text-chart-4">/</span>
            <span className="text-muted-foreground truncate">
              Run #{runNumber} — {manifest.agent} · {manifest.model}
            </span>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="max-w-[1440px] mx-auto flex gap-12 px-6 lg:pl-[185px] lg:pr-6 pt-8 pb-16">
        {/* ═══ Main content ═══ */}
        <div className="flex-1 min-w-0 max-w-[785px] space-y-10">
          {/* ── Hero: Title + Badges + Narrative ── */}
          <header>
            <h1 className="font-[family-name:var(--font-display)] text-[38px] font-semibold leading-[1.15] tracking-tight">
              Run {manifest.runId.replace(/\D/g, "").slice(-10)}
            </h1>

            <div className="flex flex-wrap items-center gap-2.5 mt-4">
              {[
                scenarioTitle,
                manifest.agent,
                manifest.model,
                runMeta?.persona,
              ]
                .filter((v): v is string => Boolean(v))
                .map((label) => (
                  <DecTag key={label}>{label}</DecTag>
                ))}
            </div>

            <p className="mt-4 font-[family-name:var(--font-display)] text-sm leading-[1.75] text-muted-foreground max-w-[785px]">
              {narrative}
            </p>
          </header>

          {/* ── Score ── */}
          <section>
            <SectionHeading id="score">Score</SectionHeading>
            <div className="flex items-center gap-5 mt-5">
              <span className="font-[family-name:var(--font-display)] text-[44px] font-semibold leading-[51px] tabular-nums shrink-0">
                {manifest.normalizedScore.toFixed(2)}
              </span>
              <p className="flex-1 font-[family-name:var(--font-display)] text-sm leading-[26px] text-muted-foreground">
                Gated score. Each cleared gate contributes its full band, partial credit within the failed gate.
                1.00 = all five gates passed.
              </p>
            </div>
          </section>

          {/* ── Comparison (placeholder charts) ── */}
          <section>
            <SectionHeading id="comparison">Comparison</SectionHeading>
            <SectionDescription className="mt-1">
              Run sits at the {manifest.normalizedScore >= 0.9 ? "top" : "middle"} of the score
              distribution for this scenario. {chartRuns.length} runs recorded.
            </SectionDescription>
            <div className="mt-5">
              <ComparisonCharts
                currentScore={manifest.normalizedScore}
                currentCost={manifest.efficiency.llmApiCostUsd}
                scenarioRuns={chartRuns}
                scenarioTitle={scenarioTitle}
              />
            </div>
          </section>

          {/* ── Result ── */}
          <section>
            <SectionHeading id="result">Result</SectionHeading>
            <SectionDescription className="mt-1">
              {context?.description ??
                "Static audit with full run evidence and rubric breakdown."}
            </SectionDescription>
          </section>

          {/* ── Assertions ── */}
          <section>
            <SectionHeading id="assertions" className="mb-4">
              Assertions: {passedAssertions} of {totalAssertions} cleared
            </SectionHeading>
            <GateAssertionGrid gates={manifest.gates} />
          </section>

          {/* ── Gate Progression ── */}
          <section>
            <SectionHeading id="gate-progression">Gate Progression</SectionHeading>

            <div className="mt-5">
              {/* Header */}
              <div className="grid grid-cols-[120px_140px_100px_60px_1fr] border-b border-secondary h-[37px] items-center">
                {["Gate", "Description", "Cleared", "Score", "Assertions"].map((col) => (
                  <div key={col} className="px-[18px] py-3">
                    <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-foreground">
                      {col}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {GATE_ORDER.map((gate, i) => {
                const detail = manifest.gates[gate];
                const meta = GATE_LABELS[gate]!;
                if (!detail) return null;
                const gateNum = i + 1;
                if (gateNum > manifest.highestGate + 1) return null;
                const total = Object.keys(detail.core).length + Object.keys(detail.scenario).length;
                const passed = Object.values(detail.core).filter(Boolean).length + Object.values(detail.scenario).filter(Boolean).length;
                const allNames = [
                  ...Object.keys(detail.core),
                  ...Object.keys(detail.scenario),
                ];
                const isHighest = gateNum === manifest.highestGate;
                const cleared = detail.passed
                  ? isHighest ? "yes (highest)" : "yes"
                  : "no";

                return (
                  <div key={gate} className="grid grid-cols-[120px_140px_100px_60px_1fr] border-b border-secondary min-h-[39px] items-center">
                    <div className="px-[18px] py-3">
                      <span className="font-[family-name:var(--font-display)] text-xs text-muted-foreground whitespace-nowrap">
                        {meta.number} {meta.label}
                      </span>
                    </div>
                    <div className="px-[18px] py-3">
                      <span className="font-[family-name:var(--font-display)] text-xs text-muted-foreground">
                        {meta.description}
                      </span>
                    </div>
                    <div className="px-[18px] py-3">
                      <span className="font-[family-name:var(--font-display)] text-xs text-muted-foreground whitespace-nowrap">
                        {cleared}
                      </span>
                    </div>
                    <div className="px-[18px] py-3">
                      <span className="font-[family-name:var(--font-display)] text-xs text-muted-foreground tabular-nums">
                        {passed}/{total}
                      </span>
                    </div>
                    <div className="px-[18px] py-3 min-w-0">
                      <span className="font-[family-name:var(--font-display)] text-xs text-muted-foreground break-words">
                        {allNames.join(", ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 font-[family-name:var(--font-display)] text-sm leading-[1.4] text-muted-foreground">
              Each assertion name links to its source file on GitHub. Link pattern: github.com/514-labs/agent-evals/blob/main/scenarios/{"{scenario_id}"}/assertions/{"{gate}"}.ts
            </p>
          </section>

          {/* ── Run Metrics ── */}
          <section>
            <SectionHeading id="run-metrics">Run Metrics</SectionHeading>

            <DataTable
              className="mt-5"
              columns={[
                { key: "runtime", label: "Runtime" },
                { key: "steps", label: "Steps" },
                { key: "tokens", label: "Tokens" },
                { key: "cost", label: "Cost" },
                { key: "assertions", label: "Assertions" },
              ]}
              rows={[{
                runtime: formatDuration(manifest.efficiency.wallClockSeconds),
                steps: String(manifest.efficiency.agentSteps),
                tokens: manifest.efficiency.tokensUsed.toLocaleString(),
                cost: `$${manifest.efficiency.llmApiCostUsd.toFixed(2)}`,
                assertions: `${passedAssertions}/${totalAssertions}`,
              }]}
            />
          </section>

          {/* ── Agent Trajectory ── */}
          <section>
            <SectionHeading id="agent-trajectory">Agent trajectory</SectionHeading>
            <SectionDescription className="mt-1">
              Step-by-step trace of the agent&apos;s interaction with the environment.
            </SectionDescription>
            <div className="mt-4">
              <AgentInteractionCard trace={trace} />
            </div>
          </section>

          {/* ── Scenario ── */}
          <section>
            <SectionHeading id="scenario">Scenario</SectionHeading>
            <SectionDescription className="mt-1">
              {context?.description ?? "No scenario description available."}
            </SectionDescription>

            {/* Problem */}
            {context?.infrastructure && (
              <div className="mt-6">
                <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">
                  Problem
                </h3>
                <p className="mt-1 font-[family-name:var(--font-display)] text-sm text-muted-foreground leading-relaxed">
                  {context.infrastructure.description}
                </p>
                <div className="flex flex-wrap gap-2.5 mt-2">
                  {context.infrastructure.services.map((svc) => (
                    <DecTag key={svc}>{svc}</DecTag>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks */}
            {context?.tasks && context.tasks.length > 0 && (
              <div className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-muted-foreground hover:bg-transparent">
                      <TableHead className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-muted-foreground tracking-[0.08em] bg-background px-3 py-2 uppercase w-24">
                        Task
                      </TableHead>
                      <TableHead className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-muted-foreground tracking-[0.08em] bg-background px-3 py-2 uppercase w-28">
                        Category
                      </TableHead>
                      <TableHead className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-muted-foreground tracking-[0.08em] bg-background px-3 py-2 uppercase">
                        Description
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {context.tasks.map((task) => (
                      <TableRow key={task.id} className="border-b border-muted-foreground hover:bg-secondary/30">
                        <TableCell className="font-[family-name:var(--font-mono)] text-xs text-foreground/80 bg-background px-3 py-2">
                          {task.id}
                        </TableCell>
                        <TableCell className="font-[family-name:var(--font-mono)] text-xs text-muted-foreground bg-background px-3 py-2">
                          {task.category}
                        </TableCell>
                        <TableCell className="font-[family-name:var(--font-display)] text-xs text-foreground/70 bg-background px-3 py-2">
                          {task.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* ── Prompt ── */}
          <section>
            <SectionHeading id="prompt">Prompt</SectionHeading>
            <div className="flex flex-wrap gap-2.5 mt-2">
              {runMeta?.persona && (
                <DecTag>{runMeta.persona}</DecTag>
              )}
              {runMeta?.planMode && (
                <DecTag>plan: {runMeta.planMode}</DecTag>
              )}
              {promptMatchesCurrent !== null && (
                <DecTag>
                  {promptMatchesCurrent ? "matches current" : "differs from current"}
                </DecTag>
              )}
            </div>
            <div className="mt-3 border border-border overflow-hidden">
              <pre className="max-h-20 overflow-auto p-3 bg-secondary/30">
                <code className="font-[family-name:var(--font-mono)] text-xs leading-relaxed text-foreground/60 whitespace-pre-wrap break-words">
                  {runMeta?.promptContent ?? runMeta?.promptPreview ?? "No prompt content captured."}
                </code>
              </pre>
            </div>
            <SectionDescription className="mt-2">
              The harness injects a system prompt followed by the scenario-specific user prompt.
              {runMeta?.promptPath && (
                <> Path: <code className="font-[family-name:var(--font-mono)] text-[11px]">{runMeta.promptPath}</code></>
              )}
            </SectionDescription>
          </section>

          {/* ── Solution ── */}
          <section>
            <SectionHeading id="solution">Solution</SectionHeading>
            <SectionDescription className="mt-1">
              How the agent solved the problem: the code it produced and the full interaction trajectory.
              The trajectory is the most valuable artifact for researchers. It shows reasoning, tool use, error recovery, and iteration patterns.
            </SectionDescription>

            <div className="mt-5 border border-secondary rounded-[3px] overflow-hidden">
              <div className="bg-secondary flex items-center justify-between px-3.5 py-1.5">
                <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold tracking-[1px] text-muted-foreground">
                  Generated code
                </span>
                <span className="font-[family-name:var(--font-display)] text-[11px] font-bold text-border">
                  Copy
                </span>
              </div>
              <div className="bg-card border-l-[3px] border-secondary px-5 py-3.5">
                <span className="font-[family-name:var(--font-mono)] text-[13px] leading-[22px] text-muted-foreground">
                  {manifest.efficiency.agentSteps} steps, {manifest.efficiency.tokensUsed.toLocaleString()} tokens.
                </span>
              </div>
            </div>
          </section>

          {/* ── Appendix: Config ── */}
          <section>
            <SectionHeading id="appendix">Appendix</SectionHeading>
            <SectionDescription className="mt-1">
              Reproducibility evidence. Every run executes inside a fresh Docker container with isolated Postgres, ClickHouse, and Redpanda.
              The hashes below let you verify this run used the exact image and prompt claimed.
            </SectionDescription>

            <DataTable
              className="mt-5"
              columns={[
                { key: "promptSha", label: "Prompt SHA-256" },
                { key: "runId", label: "Run ID" },
                { key: "harness", label: "Harness" },
              ]}
              rows={[{
                promptSha: `${runMeta?.promptSha256?.slice(0, 12) ?? "—"}…${promptMatchesCurrent === true ? " matches current" : ""}`,
                runId: manifest.runId,
                harness: manifest.harness,
              }]}
            />

            <DataTable
              className="mt-5"
              columns={[
                { key: "timestamp", label: "Timestamp" },
                { key: "agentModel", label: "Agent · Model" },
                { key: "version", label: "Version" },
              ]}
              rows={[{
                timestamp: new Date(manifest.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
                agentModel: `${manifest.agent} · ${manifest.model}`,
                version: manifest.version,
              }]}
            />
          </section>

          {/* ── Debugging output ── */}
          <section>
            <SectionHeading id="debugging">Debugging output</SectionHeading>
            <SectionDescription className="mt-1">
              Raw artifacts from the harness: stdout streams, trace payloads, session JSONL, and assertion logs.
              Open a tab to inspect file contents with paging.
            </SectionDescription>
            <div className="mt-4">
              <DebuggingCard scenario={scenario} runId={runId} logs={manifest.logs} />
            </div>
          </section>
        </div>

        {/* ═══ Sidebar ═══ */}
        <aside className="w-[300px] shrink-0 hidden xl:block pt-[254px]">
          <div className="sticky top-16 space-y-5">
            {/* TOC */}
            <SidebarToc />

            {/* Agent standings */}
            <AgentStandings entries={scenarioEntries} />

            {/* Compare CTA */}
            {index.runs.length >= 2 && <CompareRunsCta href={compareHref} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
