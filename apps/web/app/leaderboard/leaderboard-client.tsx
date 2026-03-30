"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import type { LeaderboardEntry } from "../../data/results";

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
            g <= gate ? "bg-[#B91C1C]" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

function formatScenarioName(id: string): string {
  const words = id.replace(/^foo-bar-/, "").split("-");
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
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

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs uppercase tracking-[0.15em] px-3 py-1.5 border-[2px] transition-colors cursor-pointer ${
        active
          ? "border-black bg-black text-white"
          : "border-black/30 text-black/50 hover:border-black hover:text-black"
      }`}
    >
      {label}
    </button>
  );
}

type LeaderboardClientProps = {
  allEntries: LeaderboardEntry[];
  scenarios: string[];
  harnesses: string[];
  agents: string[];
  auditRunIds: Record<string, string[]>;
  initialFilters: {
    scenario?: string;
    agent?: string;
    harness?: string;
  };
};

export function LeaderboardClient({
  allEntries,
  scenarios,
  harnesses,
  agents,
  auditRunIds,
  initialFilters,
}: LeaderboardClientProps) {
  const [scenarioFilter, setScenarioFilter] = useState(initialFilters.scenario);
  const [agentFilter, setAgentFilter] = useState(initialFilters.agent);
  const [harnessFilter, setHarnessFilter] = useState(initialFilters.harness);

  const updateUrl = useCallback(
    (filters: { scenario?: string; agent?: string; harness?: string }) => {
      const params = new URLSearchParams();
      if (filters.scenario) params.set("scenario", filters.scenario);
      if (filters.agent) params.set("agent", filters.agent);
      if (filters.harness) params.set("harness", filters.harness);
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `/leaderboard?${qs}` : "/leaderboard");
    },
    [],
  );

  const setFilter = useCallback(
    (key: "scenario" | "agent" | "harness", value: string | undefined) => {
      const updated = { scenario: scenarioFilter, agent: agentFilter, harness: harnessFilter, [key]: value };
      if (key === "scenario") setScenarioFilter(value);
      if (key === "agent") setAgentFilter(value);
      if (key === "harness") setHarnessFilter(value);
      updateUrl(updated);
    },
    [scenarioFilter, agentFilter, harnessFilter, updateUrl],
  );

  const entries = useMemo(() => {
    const hasFilter = scenarioFilter || agentFilter || harnessFilter;
    if (!hasFilter) return allEntries;
    return allEntries
      .filter(
        (e) =>
          (!scenarioFilter || e.scenario === scenarioFilter) &&
          (!agentFilter || e.agent === agentFilter) &&
          (!harnessFilter || e.harness === harnessFilter),
      )
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [allEntries, scenarioFilter, agentFilter, harnessFilter]);

  const top3 = entries.slice(0, 3);
  const hasFilter = scenarioFilter || agentFilter || harnessFilter;

  function auditHref(entry: LeaderboardEntry): string {
    const runId = entry.run_id ?? "";
    const available = auditRunIds[entry.scenario] ?? [];
    return runId.length > 0 && available.includes(runId)
      ? `/audit/${entry.scenario}/${runId}`
      : `/audit/${entry.scenario}`;
  }

  return (
    <div className="py-12">
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

      <div className="mb-8 space-y-3">
        {agents.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-black/40 w-20">Agent</span>
            <FilterChip onClick={() => setFilter("agent", undefined)} active={!agentFilter} label="ALL" />
            {agents.map((a) => (
              <FilterChip key={a} onClick={() => setFilter("agent", a)} active={agentFilter === a} label={a} />
            ))}
          </div>
        )}
        {harnesses.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-black/40 w-20">Harness</span>
            <FilterChip onClick={() => setFilter("harness", undefined)} active={!harnessFilter} label="ALL" />
            {harnesses.map((h) => (
              <FilterChip key={h} onClick={() => setFilter("harness", h)} active={harnessFilter === h} label={h} />
            ))}
          </div>
        )}
        {scenarios.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-black/40 w-20">Scenario</span>
            <FilterChip onClick={() => setFilter("scenario", undefined)} active={!scenarioFilter} label="ALL" />
            {scenarios.map((s) => (
              <FilterChip key={s} onClick={() => setFilter("scenario", s)} active={scenarioFilter === s} label={formatScenarioName(s)} />
            ))}
          </div>
        )}
      </div>

      {top3.length >= 3 && (
        <div className="grid md:grid-cols-3 gap-0 mb-16">
          {top3.map((entry, i) => (
            <div
              key={getLeaderboardEntryKey(entry)}
              className={`border-[3px] border-black p-6 ${
                i === 0
                  ? "bg-[#B91C1C] md:row-start-1"
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
                <Link href={auditHref(entry)} className="hover:underline">
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
          ))}
        </div>
      )}

      <div className="border-[3px] border-black">
        <div className="px-6 py-3 bg-black text-white flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.3em]">ALL RANKINGS</span>
          <span className="text-xs uppercase tracking-[0.2em] text-white/70">{entries.length} RUNS</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b-[2px] border-black/15 hover:bg-transparent">
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50 w-12 pl-6">#</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">SCENARIO</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">HARNESS</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">GATE</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">GATED SCORE</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">TIME</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-[0.2em] text-black/50 pr-6">COST</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={getLeaderboardEntryKey(entry)}
                className={`border-b border-black/10 hover:bg-[#B91C1C]/5 transition-colors ${
                  entry.rank === 1 ? "bg-[#B91C1C]/3" : ""
                }`}
              >
                <TableCell className="pl-6">
                  <span
                    className={`font-[family-name:var(--font-display)] text-xl ${
                      entry.rank === 1 ? "text-[#B91C1C]" : "text-black/25"
                    }`}
                  >
                    {String(entry.rank).padStart(2, "0")}
                  </span>
                </TableCell>
                <TableCell>
                  <Link href={auditHref(entry)} className="text-xs font-bold uppercase tracking-[0.1em] hover:underline">
                    {formatScenarioName(entry.scenario)}
                  </Link>
                  <span className="block text-xs text-black/40 mt-0.5">
                    {entry.agent} · {entry.model.replace("claude-", "").replace("-20250514", "")}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-black/50">{entry.harness}</span>
                </TableCell>
                <TableCell>
                  <GatePips gate={entry.highest_gate} />
                </TableCell>
                <TableCell>
                  <span
                    className={`font-[family-name:var(--font-display)] text-2xl tracking-tight ${
                      entry.rank === 1 ? "text-[#B91C1C]" : ""
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
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-black/50">
            Want to benchmark your agent or collaborate on the preview?
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/docs/running-evals"
            className="brutal-btn bg-[#B91C1C] text-black border-[3px] border-black px-8 py-3 text-sm font-bold uppercase tracking-[0.15em]"
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
