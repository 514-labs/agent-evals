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
  type LeaderboardEntry,
} from "../../data/results";

const gateNames = [
  "—",
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

function EmptyState() {
  return (
    <div className="py-24 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[7rem] tracking-tight uppercase leading-[0.85]">
        LEADER
        <br />
        BOARD
      </h1>
      <p className="mt-8 text-[12px] uppercase tracking-wider text-black/50 max-w-md mx-auto">
        No eval results found. Run your first eval to see results here.
      </p>
      <div className="mt-8">
        <Link
          href="/docs/running-evals"
          className="brutal-btn bg-[#FF10F0] text-black border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]"
        >
          RUN AN EVAL →
        </Link>
      </div>
    </div>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario: scenarioFilter } = await searchParams;
  const allEntries = getLeaderboardEntries();
  const scenarios = getUniqueScenarios();

  if (allEntries.length === 0) {
    return <EmptyState />;
  }

  const entries = scenarioFilter
    ? allEntries
        .filter((e) => e.scenario === scenarioFilter)
        .map((e, i) => ({ ...e, rank: i + 1 }))
    : allEntries;

  const top3 = entries.slice(0, 3);

  return (
    <div className="py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-[7rem] tracking-tight uppercase leading-[0.85]">
          LEADER
          <br />
          BOARD
        </h1>
        <p className="mt-4 text-[12px] uppercase tracking-wider text-black/50 max-w-md">
          Ranked by highest gate cleared, then normalized score within the gate.
          {scenarioFilter
            ? ` Showing: ${formatScenarioName(scenarioFilter)}.`
            : ` ${entries.length} runs across ${scenarios.length} scenarios.`}
        </p>
      </div>

      {/* Scenario filter */}
      {scenarios.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/leaderboard"
            className={`text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 border-[2px] transition-colors ${
              !scenarioFilter
                ? "border-black bg-black text-white"
                : "border-black/30 text-black/50 hover:border-black hover:text-black"
            }`}
          >
            ALL
          </Link>
          {scenarios.map((s) => (
            <Link
              key={s}
              href={`/leaderboard?scenario=${s}`}
              className={`text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 border-[2px] transition-colors ${
                scenarioFilter === s
                  ? "border-black bg-black text-white"
                  : "border-black/30 text-black/50 hover:border-black hover:text-black"
              }`}
            >
              {formatScenarioName(s)}
            </Link>
          ))}
        </div>
      )}

      {/* Podium -- Top 3 */}
      {top3.length >= 3 && (
        <div className="grid md:grid-cols-3 gap-0 mb-16">
          {top3.map((entry, i) => (
            <div
              key={`${entry.scenario}-${entry.harness}-${entry.agent}`}
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
                  className={`text-[10px] font-bold uppercase tracking-[0.2em] border-[2px] px-2 py-0.5 mt-2 ${
                    i === 1
                      ? "border-white text-white"
                      : "border-black text-black"
                  }`}
                >
                  {gateNames[entry.highest_gate]}
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-xl lg:text-2xl uppercase tracking-tight leading-[0.9]">
                {formatScenarioName(entry.scenario)}
              </h3>
              <p
                className={`mt-1 text-[11px] uppercase tracking-wider ${
                  i === 1 ? "text-white/50" : "text-black/40"
                }`}
              >
                {entry.agent} · {entry.harness}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Full rankings table */}
      <div className="border-[3px] border-black">
        <div className="px-6 py-3 bg-black text-white flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
            ALL RANKINGS
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/70">
            {entries.length} RUNS
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b-[2px] border-black/15 hover:bg-transparent">
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50 w-12 pl-6">
                #
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                SCENARIO
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                HARNESS
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                GATE
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                SCORE
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50">
                TIME
              </TableHead>
              <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/50 pr-6">
                COST
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={`${entry.scenario}-${entry.harness}-${entry.agent}`}
                className={`border-b border-black/10 hover:bg-[#FF10F0]/5 transition-colors ${
                  entry.rank === 1 ? "bg-[#FF10F0]/[0.03]" : ""
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
                  <span className="text-[12px] font-bold uppercase tracking-[0.1em]">
                    {formatScenarioName(entry.scenario)}
                  </span>
                  <span className="block text-[10px] text-black/40 mt-0.5">
                    {entry.agent} · {entry.model.replace("claude-", "").replace("-20250514", "")}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-[11px] text-black/50">
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
                    {entry.normalized_score.toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-[11px] tabular-nums text-black/50">
                    {entry.efficiency.wallClockSeconds}s
                  </span>
                </TableCell>
                <TableCell className="pr-6">
                  <span className="text-[11px] tabular-nums text-black/50">
                    ${entry.efficiency.llmApiCostUsd.toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* CTA */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-black/50">
            Want to see your harness or agent here?
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/docs/running-evals"
            className="brutal-btn bg-[#FF10F0] text-black border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]"
          >
            RUN AN EVAL →
          </Link>
          <Link
            href="/docs"
            className="brutal-btn bg-black text-white border-[3px] border-black px-8 py-3 text-[12px] font-bold uppercase tracking-[0.15em]"
          >
            GET STARTED →
          </Link>
        </div>
      </div>
    </div>
  );
}
