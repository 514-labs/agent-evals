"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import type { GateAttritionPoint } from "./aggregate";
import { AGENT_LABELS } from "./aggregate";

interface GateAttritionChartProps {
  data: GateAttritionPoint[];
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

export function GateAttritionChart({ data, agents }: GateAttritionChartProps) {
  const config: ChartConfig = Object.fromEntries(
    agents.map((agent) => [
      agent,
      { label: AGENT_LABELS[agent] ?? agent, color: AGENT_COLORS[agent] ?? "var(--chart-4)" },
    ]),
  );

  if (data.length === 0) return null;

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="gate"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {agents.map((agent) => (
              <Line
                key={agent}
                type="monotone"
                dataKey={agent}
                stroke={`var(--color-${agent})`}
                strokeWidth={2}
              dot={{ r: 4, fill: `var(--color-${agent})` }}
              activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

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
