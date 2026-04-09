"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";
import type { LeaderboardEntry } from "../../data/results-core";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { FilterSelect } from "../../components/leaderboard/filter-select";
import { GatePips } from "../../components/leaderboard/gate-pips";
import { GateLegend } from "../../components/leaderboard/gate-legend";
import { MetadataBar } from "../../components/leaderboard/metadata-bar";
import { StepsRow } from "../../components/leaderboard/steps-row";

const GATE_NAMES = [
  "NO GATES",
  "FUNCTIONAL",
  "CORRECT",
  "ROBUST",
  "PERFORMANT",
  "PRODUCTION",
];

function formatScenarioName(id: string): string {
  const words = id.replace(/^foo-bar-/, "").split("-");
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function formatScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "\u2014";
  return value.toFixed(2);
}

function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return "\u2014";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatCost(usd: number | null | undefined): string {
  if (usd == null || usd === 0) return "\u2014";
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

function RunIdCell({ runId }: { runId: string | undefined }) {
  if (!runId) {
    return (
      <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground">
        {"\u2014"}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground block max-w-[100px] truncate cursor-default">
          {runId}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="font-[family-name:var(--font-mono)] text-xs"
      >
        {runId}
      </TooltipContent>
    </Tooltip>
  );
}

type LeaderboardClientProps = {
  allEntries: LeaderboardEntry[];
  scenarios: string[];
  harnesses: string[];
  models: string[];
  personas: string[];
  agents: string[];
  auditRunIds: Record<string, string[]>;
};

function LeaderboardClientInner({
  allEntries,
  scenarios,
  harnesses,
  models,
  personas,
  agents,
  auditRunIds,
}: LeaderboardClientProps) {
  const searchParams = useSearchParams();
  const [scenarioFilter, setScenarioFilter] = useState(
    searchParams.get("scenario") ?? "__all__",
  );
  const [agentFilter, setAgentFilter] = useState(
    searchParams.get("agent") ?? "__all__",
  );
  const [harnessFilter, setHarnessFilter] = useState(
    searchParams.get("harness") ?? "__all__",
  );
  const [modelFilter, setModelFilter] = useState("__all__");
  const [personaFilter, setPersonaFilter] = useState("__all__");
  const [minGateFilter, setMinGateFilter] = useState("__all__");

  const updateUrl = useCallback(
    (filters: {
      scenario?: string;
      agent?: string;
      harness?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters.scenario && filters.scenario !== "__all__")
        params.set("scenario", filters.scenario);
      if (filters.agent && filters.agent !== "__all__")
        params.set("agent", filters.agent);
      if (filters.harness && filters.harness !== "__all__")
        params.set("harness", filters.harness);
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `/leaderboard?${qs}` : "/leaderboard",
      );
    },
    [],
  );

  const setFilter = useCallback(
    (
      key:
        | "scenario"
        | "agent"
        | "harness"
        | "model"
        | "persona"
        | "minGate",
      value: string,
    ) => {
      const v = value === "__all__" ? "__all__" : value;
      if (key === "scenario") setScenarioFilter(v);
      if (key === "agent") setAgentFilter(v);
      if (key === "harness") setHarnessFilter(v);
      if (key === "model") setModelFilter(v);
      if (key === "persona") setPersonaFilter(v);
      if (key === "minGate") setMinGateFilter(v);

      if (key === "scenario" || key === "agent" || key === "harness") {
        const updated = {
          scenario: key === "scenario" ? v : scenarioFilter,
          agent: key === "agent" ? v : agentFilter,
          harness: key === "harness" ? v : harnessFilter,
        };
        updateUrl(updated);
      }
    },
    [scenarioFilter, agentFilter, harnessFilter, updateUrl],
  );

  const entries = useMemo(() => {
    const isActive = (v: string) => v !== "__all__";
    const hasFilter =
      isActive(scenarioFilter) ||
      isActive(agentFilter) ||
      isActive(harnessFilter) ||
      isActive(modelFilter) ||
      isActive(personaFilter) ||
      isActive(minGateFilter);

    if (!hasFilter) return allEntries;

    const minGate = isActive(minGateFilter)
      ? parseInt(minGateFilter, 10)
      : 0;

    return allEntries
      .filter(
        (e) =>
          (!isActive(scenarioFilter) || e.scenario === scenarioFilter) &&
          (!isActive(agentFilter) || e.agent === agentFilter) &&
          (!isActive(harnessFilter) || e.harness === harnessFilter) &&
          (!isActive(modelFilter) || e.model === modelFilter) &&
          (!isActive(personaFilter) ||
            e.run_metadata?.persona === personaFilter) &&
          e.highest_gate >= minGate,
      )
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [
    allEntries,
    scenarioFilter,
    agentFilter,
    harnessFilter,
    modelFilter,
    personaFilter,
    minGateFilter,
  ]);

  function auditHref(entry: LeaderboardEntry): string {
    const runId = entry.run_id ?? "";
    const available = auditRunIds[entry.scenario] ?? [];
    return runId.length > 0 && available.includes(runId)
      ? `/audit/${entry.scenario}/${runId}`
      : `/audit/${entry.scenario}`;
  }

  const metadataLabel = `All Rankings \u00B7 ${entries.length} runs`;

  return (
    <div className="py-12 flex flex-col gap-5">
      {/* Hero */}
      <div className="pt-12 flex flex-col gap-5">
        <h1 className="font-[family-name:var(--font-display)] text-[44px] font-semibold leading-[51px] text-foreground">
          Leaderboard
        </h1>
        <p className="font-[family-name:var(--font-display)] text-lg leading-7 text-muted-foreground">
          All benchmark runs across agents, scenarios, harnesses, and prompt
          variants. Sort and filter to compare quality, cost, and efficiency
          across configurations. Click on a run to see full results.
        </p>
      </div>

      {/* Metadata bar + Filters */}
      <div className="flex flex-col gap-5">
        <MetadataBar label={metadataLabel} />

        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="AGENT"
            value={agentFilter}
            options={agents.map((a) => ({ value: a, label: a }))}
            onValueChange={(v) => setFilter("agent", v)}
          />
          {personas.length > 0 && (
            <FilterSelect
              label="PERSONA"
              value={personaFilter}
              options={personas.map((p) => ({ value: p, label: p }))}
              onValueChange={(v) => setFilter("persona", v)}
            />
          )}
          <FilterSelect
            label="HARNESS"
            value={harnessFilter}
            options={harnesses.map((h) => ({ value: h, label: h }))}
            onValueChange={(v) => setFilter("harness", v)}
          />
          <FilterSelect
            label="SCENARIO"
            value={scenarioFilter}
            options={scenarios.map((s) => ({
              value: s,
              label: formatScenarioName(s),
            }))}
            onValueChange={(v) => setFilter("scenario", v)}
          />
          {models.length > 1 && (
            <FilterSelect
              label="MODEL"
              value={modelFilter}
              options={models.map((m) => ({ value: m, label: m }))}
              onValueChange={(v) => setFilter("model", v)}
            />
          )}
          <FilterSelect
            label="MIN GATE"
            value={minGateFilter}
            options={[1, 2, 3, 4, 5].map((g) => ({
              value: String(g),
              label: GATE_NAMES[g] ?? `GATE ${g}`,
            }))}
            onValueChange={(v) => setFilter("minGate", v)}
          />
        </div>
      </div>

      {/* Gate legend + Table */}
      <TooltipProvider>
      <div className="flex flex-col gap-5">
        <GateLegend />

        <Table>
          <TableHeader>
            <TableRow className="border-b border-muted-foreground hover:bg-transparent">
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[44px] px-3 py-2">
                #
              </TableHead>
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[240px] px-3 py-2">
                Scenario
              </TableHead>
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[130px] px-3 py-2">
                Agent
              </TableHead>
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[130px] px-3 py-2">
                Model
              </TableHead>
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[110px] px-3 py-2">
                Harness
              </TableHead>
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[130px] px-3 py-2">
                Gates ▼
              </TableHead>
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[88px] px-3 py-2">
                Score ▼
              </TableHead>
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[88px] px-3 py-2">
                Time
              </TableHead>
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[76px] px-3 py-2">
                Cost
              </TableHead>
              <TableHead className="font-[family-name:var(--font-display)] text-[10px] font-bold text-muted-foreground tracking-[1.5px] bg-background w-[100px] px-3 py-2">
                Run ID
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const isLowScore = entry.normalized_score < 0.5;
              return (
                <TableRow
                  key={getLeaderboardEntryKey(entry)}
                  className="border-b border-muted-foreground h-14 hover:bg-secondary/50 transition-colors"
                >
                  <TableCell className="bg-background px-3 py-3">
                    <span className="font-[family-name:var(--font-display)] text-base text-muted-foreground">
                      {String(entry.rank).padStart(2, "0")}
                    </span>
                  </TableCell>
                  <TableCell className="bg-background px-3 py-3">
                    <Link
                      href={auditHref(entry)}
                      className="font-[family-name:var(--font-display)] text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {formatScenarioName(entry.scenario)}
                    </Link>
                  </TableCell>
                  <TableCell className="bg-background px-3 py-3">
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground">
                      {entry.agent}
                    </span>
                  </TableCell>
                  <TableCell className="bg-background px-3 py-3">
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground">
                      {entry.model}
                    </span>
                  </TableCell>
                  <TableCell className="bg-background px-3 py-3">
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded-sm">
                      {entry.harness}
                    </span>
                  </TableCell>
                  <TableCell className="bg-background px-3 py-3">
                    <GatePips gate={entry.highest_gate} />
                  </TableCell>
                  <TableCell className="bg-background px-3 py-3">
                    <span
                      className={cn(
                        "font-[family-name:var(--font-display)] text-xl",
                        isLowScore
                          ? "text-accent"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatScore(entry.normalized_score)}
                    </span>
                  </TableCell>
                  <TableCell className="bg-background px-3 py-3">
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-muted-foreground">
                      {formatTime(entry.efficiency?.wallClockSeconds)}
                    </span>
                  </TableCell>
                  <TableCell className="bg-background px-3 py-3">
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-muted-foreground">
                      {formatCost(entry.efficiency?.llmApiCostUsd)}
                    </span>
                  </TableCell>
                  <TableCell className="bg-background px-3 py-3">
                    <RunIdCell runId={entry.run_id} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      </TooltipProvider>

      {/* How it works */}
      <StepsRow />
    </div>
  );
}

export function LeaderboardClient(props: LeaderboardClientProps) {
  return (
    <Suspense>
      <LeaderboardClientInner {...props} />
    </Suspense>
  );
}
