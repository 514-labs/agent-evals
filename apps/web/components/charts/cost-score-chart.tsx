"use client";

import { useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ZAxis,
  Label,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import type { CostScorePoint } from "./aggregate";
import { AGENT_LABELS } from "./aggregate";

interface CostScoreChartProps {
  allData: CostScorePoint[];
  agents: string[];
}

const AGENT_COLORS: Record<string, string> = {
  "Claude-Code": "var(--chart-1)",
  Codex: "var(--chart-3)",
  Cursor: "var(--chart-4)",
};

const AGENT_HEX: Record<string, string> = {
  "Claude-Code": "#B91C1C",
  Codex: "#1C1917",
  Cursor: "#A8A29E",
};

type TierKey = "all" | "tier-1" | "tier-2" | "tier-3";

const TIER_OPTIONS: { key: TierKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tier-1", label: "T1" },
  { key: "tier-2", label: "T2" },
  { key: "tier-3", label: "T3" },
];

const EPSILON = 0.01;
function scoreToY(score: number): number {
  return -Math.log10(1 + EPSILON - Math.min(score, 1));
}

const SCORE_TICKS = [0, 0.3, 0.6, 0.8, 0.9, 0.95, 1.0];
const Y_TICKS = SCORE_TICKS.map(scoreToY);
const Y_MAX = scoreToY(1.0);

function formatTimeTick(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = seconds / 60;
  return Number.isInteger(m) ? `${m}m` : `${m.toFixed(1)}m`;
}

export function CostScoreChart({ allData, agents }: CostScoreChartProps) {
  const [mode, setMode] = useState<"cost" | "time">("cost");
  const [tier, setTier] = useState<TierKey>("all");

  const filtered = allData
    .filter((d) => d.cost > 0 && d.time > 0)
    .filter((d) => tier === "all" || d.tier === tier)
    .map((d) => ({ ...d, yScore: scoreToY(d.score) }));

  const config: ChartConfig = Object.fromEntries(
    agents.map((agent) => [
      agent,
      { label: AGENT_LABELS[agent] ?? agent, color: AGENT_COLORS[agent] ?? "var(--chart-4)" },
    ]),
  );

  const xDataKey = mode === "cost" ? "cost" : "time";
  const xScale = mode === "cost" ? "log" : ("linear" as const);
  const xLabel = mode === "cost" ? "Cost (log scale)" : "Time";

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
            Score vs.
          </span>
          <div className="flex">
            <button
              type="button"
              onClick={() => setMode("cost")}
              className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] border px-3 py-1 transition-colors ${
                mode === "cost"
                  ? "bg-[color:var(--foreground)] text-[color:var(--card)] border-[color:var(--foreground)]"
                  : "text-[color:var(--chart-4)] border-[color:var(--sidebar)] bg-[color:var(--card)]"
              }`}
            >
              Cost
            </button>
            <button
              type="button"
              onClick={() => setMode("time")}
              className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] border border-l-0 px-3 py-1 transition-colors ${
                mode === "time"
                  ? "bg-[color:var(--foreground)] text-[color:var(--card)] border-[color:var(--foreground)]"
                  : "text-[color:var(--chart-4)] border-[color:var(--sidebar)] bg-[color:var(--card)]"
              }`}
            >
              Time
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-display)] text-sm text-[color:var(--muted-foreground)]">
            Scenario difficulty:
          </span>
          <div className="flex gap-1.5">
            {TIER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTier(opt.key)}
                className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] border px-3 py-1 transition-colors ${
                  tier === opt.key
                    ? "bg-[color:var(--foreground)] text-[color:var(--card)] border-[color:var(--foreground)]"
                    : "text-[color:var(--chart-4)] border-[color:var(--sidebar)] bg-[color:var(--card)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 40, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey={xDataKey}
              type="number"
              scale={xScale}
              domain={["auto", "auto"]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(v: number) =>
                mode === "cost"
                  ? `$${v < 1 ? v.toFixed(2) : v.toFixed(0)}`
                  : formatTimeTick(v)
              }
              name={mode === "cost" ? "Cost" : "Time"}
            >
              <Label value={xLabel} position="insideBottom" offset={-14} style={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }} />
            </XAxis>
            <YAxis
              dataKey="yScore"
              type="number"
              domain={[0, Y_MAX]}
              ticks={Y_TICKS}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(v: number) => {
                const score = 1 + EPSILON - Math.pow(10, -v);
                return score.toFixed(2);
              }}
              name="Score"
            >
              <Label value="Gated Score (log)" angle={-90} position="insideLeft" offset={0} style={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textAnchor: "middle" }} />
            </YAxis>
            <ZAxis range={[60, 60]} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === "cost") return `$${(value as number).toFixed(2)}`;
                    if (name === "time") return formatTimeTick(value as number);
                    const v = value as number;
                    const score = 1 + EPSILON - Math.pow(10, -v);
                    return score.toFixed(3);
                  }}
                />
              }
            />
            {agents.map((agent) => (
              <Scatter
                key={agent}
                name={AGENT_LABELS[agent] ?? agent}
                data={filtered.filter((d) => d.agent === agent)}
                fill={AGENT_HEX[agent] ?? "#999"}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Custom circle legend */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        {agents.map((agent) => {
          const n = filtered.filter((d) => d.agent === agent).length;
          return (
            <div key={agent} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: AGENT_HEX[agent] ?? "#999" }}
              />
              <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--muted-foreground)]">
                {AGENT_LABELS[agent] ?? agent}
                <span className="font-normal ml-1 text-[color:var(--chart-4)]">n={n}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
