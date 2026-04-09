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

const GATES = [
  { label: "G1+", value: 1 },
  { label: "G2+", value: 2 },
  { label: "G3+", value: 3 },
  { label: "G4+", value: 4 },
  { label: "G5+", value: 5 },
];

export function CostScoreChart({ allData, agents }: CostScoreChartProps) {
  const [minGate, setMinGate] = useState(1);

  const filtered = allData.filter(
    (d) => d.highestGate >= minGate && d.cost > 0,
  );

  const config: ChartConfig = Object.fromEntries(
    agents.map((agent) => [
      agent,
      { label: AGENT_LABELS[agent] ?? agent, color: AGENT_COLORS[agent] ?? "var(--chart-4)" },
    ]),
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-[family-name:var(--font-display)] text-sm text-[color:var(--muted-foreground)]">
          Gate threshold selector:
        </span>
        <div className="flex gap-1.5">
          {GATES.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => setMinGate(g.value)}
              className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] border px-3 py-1 transition-colors ${
                minGate === g.value
                  ? "bg-[color:var(--foreground)] text-[color:var(--card)] border-[color:var(--foreground)]"
                  : "text-[color:var(--chart-4)] border-[color:var(--secondary)] bg-[color:var(--card)]"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-[color:var(--border)] bg-[color:var(--secondary)] p-6 flex items-center justify-center min-h-[280px]">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)] text-center">
            No runs cleared gate {minGate}
          </p>
        </div>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="cost"
                type="number"
                scale="log"
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tickFormatter={(v: number) => `$${v < 1 ? v.toFixed(2) : v.toFixed(0)}`}
                name="Cost"
              />
              <YAxis
                dataKey="score"
                type="number"
                domain={[0, 1.1]}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tickFormatter={(v: number) => v.toFixed(2)}
                name="Score"
              />
              <ZAxis range={[60, 60]} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) =>
                      name === "cost"
                        ? `$${(value as number).toFixed(2)}`
                        : (value as number).toFixed(3)
                    }
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
      )}

      {/* Custom circle legend matching Figma */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        {agents.map((agent) => (
          <div key={agent} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: AGENT_HEX[agent] ?? "#999" }}
            />
            <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--muted-foreground)]">
              {AGENT_LABELS[agent] ?? agent}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
