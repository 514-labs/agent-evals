import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  getLeaderboardEntries,
  getUniqueScenarios,
  getUniqueHarnesses,
} from "../../data/results";
import { getScenarioAuditRunIds } from "../../data/audits";

const gateNames = [
  "NO GATES",
  "FUNCTIONAL",
  "CORRECT",
  "ROBUST",
  "PERFORMANT",
  "PRODUCTION",
];

function GatePips({ gate }: { gate: number }) {
  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((g) => (
        <div
          key={g}
          className={`w-[14px] h-[14px] border-[2px] border-black ${
            g <= gate ? "bg-[#FF10F0]" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

function formatScenarioName(id: string): string {
  return id
    .replace(/^foo-bar-/, "")
    .replace(/-/g, " ")
    .toUpperCase();
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

function getLeaderboardEntryKey(entry: {
  scenario: string;
  run_id?: string;
  result_file?: string;
  rank: number;
}): string {
  return `${entry.scenario}-${entry.run_id ?? entry.result_file ?? entry.rank}`;
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`text-xs uppercase tracking-[0.15em] px-3 py-1.5 border-[2px] transition-colors ${
        active
          ? "border-black bg-black text-white"
          : "border-black/30 text-black/50 hover:border-black hover:text-black"
      }`}
    >
      {label}
    </Link>
  );
}

function buildFilterUrl(
  current: { scenario?: string; agent?: string; harness?: string },
  override: Partial<{ scenario: string | undefined; agent: string | undefined; harness: string | undefined }>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...override };
  if (merged.scenario) params.set("scenario", merged.scenario);
  if (merged.agent) params.set("agent", merged.agent);
  if (merged.harness) params.set("harness", merged.harness);
  const qs = params.toString();
  return qs ? `/leaderboard?${qs}` : "/leaderboard";
}

function EmptyState() {
  return (
    <div className="py-24 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[7rem] tracking-tight uppercase leading-[0.85]">
        LEADER
        <br />
        BOARD
      </h1>
      <p className="mt-8 text-sm uppercase tracking-wider text-black/50 max-w-md mx-auto">
        No eval results found yet. Run the research preview or help expand it
        with a new eval.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/docs/running-evals"
          className="brutal-btn bg-[#FF10F0] text-black border-[3px] border-black px-8 py-3 text-sm font-bold uppercase tracking-[0.15em]"
        >
          RUN THE PREVIEW →
        </Link>
        <Link
          href="/docs/add-eval/getting-started"
          className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-sm font-bold uppercase tracking-[0.15em]"
        >
          ADD AN EVAL →
        </Link>
      </div>
    </div>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; agent?: string; harness?: string }>;
}) {
  const { scenario: scenarioFilter, agent: agentFilter, harness: harnessFilter } = await searchParams;
  const allEntries = getLeaderboardEntries();
  const scenarios = getUniqueScenarios();
  const harnesses = getUniqueHarnesses();
  const agents = [...new Set(allEntries.map((e) => e.agent))].sort();

  const currentFilters = { scenario: scenarioFilter, agent: agentFilter, harness: harnessFilter };
  const filterUrl = (override: Partial<typeof currentFilters>) => buildFilterUrl(currentFilters, override);

  if (allEntries.length === 0) {
    return <EmptyState />;
  }

  const hasFilter = scenarioFilter || agentFilter || harnessFilter;
  const entries = hasFilter
    ? allEntries
        .filter((e) =>
          (!scenarioFilter || e.scenario === scenarioFilter) &&
          (!agentFilter || e.agent === agentFilter) &&
          (!harnessFilter || e.harness === harnessFilter)
        )
        .map((e, i) => ({ ...e, rank: i + 1 }))
    : allEntries;

  const top3 = entries.slice(0, 3);
  const auditRunIdsByScenario = new Map(
    scenarios.map((scenario) => [scenario, getScenarioAuditRunIds(scenario)]),
  );

  return (
    <div className="py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[7rem] tracking-tight uppercase leading-[0.85]">
          LEADER
          <br />
          BOARD
        </h1>
        <p className="mt-4 text-xs uppercase tracking-wider text-black/50 max-w-md leading-relaxed">
          Ranked by highest gate cleared, then gated score within the reached gate
          based on passed core and scenario assertions.
          {hasFilter
            ? ` Showing ${entries.length} runs.`
            : ` ${entries.length} runs across ${scenarios.length} scenarios.`}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 space-y-3">
        {agents.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-black/40 w-20">Agent</span>
            <FilterChip href={filterUrl({ agent: undefined })} active={!agentFilter} label="ALL" />
            {agents.map((a) => (
              <FilterChip key={a} href={filterUrl({ agent: a })} active={agentFilter === a} label={a} />
            ))}
          </div>
        )}
        {harnesses.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-black/40 w-20">Harness</span>
            <FilterChip href={filterUrl({ harness: undefined })} active={!harnessFilter} label="ALL" />
            {harnesses.map((h) => (
              <FilterChip key={h} href={filterUrl({ harness: h })} active={harnessFilter === h} label={h} />
            ))}
          </div>
        )}
        {scenarios.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-black/40 w-20">Scenario</span>
            <FilterChip href={filterUrl({ scenario: undefined })} active={!scenarioFilter} label="ALL" />
            {scenarios.map((s) => (
              <FilterChip key={s} href={filterUrl({ scenario: s })} active={scenarioFilter === s} label={formatScenarioName(s)} />
            ))}
          </div>
        )}
      </div>

      {/* Podium -- Top 3 */}
      {top3.length >= 3 && (
        <div className="grid md:grid-cols-3 gap-0 mb-16">
          {top3.map((entry, i) => {
            const runId = entry.run_id ?? "";
            const runIds = auditRunIdsByScenario.get(entry.scenario) ?? new Set<string>();
            const deepLinkAvailable = runId.length > 0 && runIds.has(runId);
            const auditHref = deepLinkAvailable
              ? `/audit/${entry.scenario}/${runId}`
              : `/audit/${entry.scenario}`;

            return (
              <div
                key={getLeaderboardEntryKey(entry)}
                className={`border-[3px] border-black p-6 ${
                  i === 0
                    ? "bg-[#FF10F0] md:row-start-1"
                    : i === 1
                      ? "border-t-0 md:border-t-[3px] md:border-l-0 bg-black text-white"
                      : "border-t-0 md:border-t-[3px] md:border-l-0"
                }`}
              >
              <div className="flex items-start justify-between mb-4">
                <span
                  className={`font-[family-name:var(--font-display)] text-6xl lg:text-7xl tracking-tight ${
                    i === 0
                      ? "text-black/40"
                      : i === 1
                        ? "text-white/40"
                        : "text-black/30"
                  }`}
                >
                  #{entry.rank}
                </span>
                <span
                  className={`text-xs font-bold uppercase tracking-[0.2em] border-[2px] px-2 py-0.5 mt-2 ${
                    i === 1
                      ? "border-white text-white"
                      : "border-black text-black"
                  }`}
                >
                  {gateNames[entry.highest_gate]}
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-xl lg:text-2xl uppercase tracking-tight leading-[0.9]">
                <Link
                  href={auditHref}
                  className="hover:underline"
                >
                  {formatScenarioName(entry.scenario)}
                </Link>
              </h3>
              <p
                className={`mt-1 text-xs uppercase tracking-wider ${
                  i === 1 ? "text-white/50" : "text-black/40"
                }`}
              >
                {entry.agent} · {entry.harness}
              </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full rankings table */}
      <div className="border-[3px] border-black">
        <div className="px-6 py-3 bg-black text-white flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.3em]">
            ALL RANKINGS
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-white/70">
            {entries.length} RUNS
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b-[2px] border-black/15 hover:bg-transparent">
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50 w-12 pl-6">
                #
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">
                SCENARIO
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">
                HARNESS
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">
                GATE
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">
                GATED SCORE
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">
                TIME
              </TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50 pr-6">
                COST
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
                const runId = entry.run_id ?? "";
                const runIds = auditRunIdsByScenario.get(entry.scenario) ?? new Set<string>();
                const deepLinkAvailable = runId.length > 0 && runIds.has(runId);
                const auditHref = deepLinkAvailable
                  ? `/audit/${entry.scenario}/${runId}`
                  : `/audit/${entry.scenario}`;

                return (
              <TableRow
                key={getLeaderboardEntryKey(entry)}
                className={`border-b border-black/10 hover:bg-[#FF10F0]/5 transition-colors ${
                  entry.rank === 1 ? "bg-[#FF10F0]/3" : ""
                }`}
              >
                <TableCell className="pl-6">
                  <span
                    className={`font-[family-name:var(--font-display)] text-xl ${
                      entry.rank === 1 ? "text-[#FF10F0]" : "text-black/25"
                    }`}
                  >
                    {String(entry.rank).padStart(2, "0")}
                  </span>
                </TableCell>
                <TableCell>
                  <Link href={auditHref} className="text-xs font-bold uppercase tracking-[0.1em] hover:underline">
                    {formatScenarioName(entry.scenario)}
                  </Link>
                  <span className="block text-xs text-black/40 mt-0.5">
                    {entry.agent} · {entry.model.replace("claude-", "").replace("-20250514", "")}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-black/50">
                    {entry.harness}
                  </span>
                </TableCell>
                <TableCell>
                  <GatePips gate={entry.highest_gate} />
                </TableCell>
                <TableCell>
                  <span
                    className={`font-[family-name:var(--font-display)] text-2xl tracking-tight ${
                      entry.rank === 1 ? "text-[#FF10F0]" : ""
                    }`}
                  >
                    {formatScore(entry.normalized_score)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs tabular-nums text-black/50">
                    {formatTime(entry.efficiency?.wallClockSeconds)}
                  </span>
                </TableCell>
                <TableCell className="pr-6">
                  <span className="text-xs tabular-nums text-black/50">
                    {formatCost(entry.efficiency?.llmApiCostUsd)}
                  </span>
                </TableCell>
              </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* CTA */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-black/50">
            Want to benchmark your agent or collaborate on the preview?
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/docs/running-evals"
            className="brutal-btn bg-[#FF10F0] text-black border-[3px] border-black px-8 py-3 text-sm font-bold uppercase tracking-[0.15em]"
          >
            RUN THE PREVIEW →
          </Link>
          <Link
            href="/docs/add-eval/getting-started"
            className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-sm font-bold uppercase tracking-[0.15em]"
          >
            ADD AN EVAL →
          </Link>
        </div>
      </div>
    </div>
  );
}
