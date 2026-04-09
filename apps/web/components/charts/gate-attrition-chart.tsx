"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Label,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import type { GateAttritionPoint } from "./aggregate";
import { AGENT_LABELS, MODEL_LABELS } from "./aggregate";

interface GateAttritionChartProps {
  data: GateAttritionPoint[];
  agents: string[];
}

const SERIES_COLORS: Record<string, string> = {
  "Claude-Code": "var(--chart-1)",
  Codex: "var(--chart-3)",
  Cursor: "var(--chart-4)",
  "Claude Opus 4.6": "var(--chart-1)",
  "Claude Sonnet 4.6": "var(--chart-2)",
  "GPT-5.4": "var(--chart-3)",
  "Composer 2": "var(--chart-4)",
  Composer: "var(--chart-5)",
};

const SERIES_HEX: Record<string, string> = {
  "Claude-Code": "#B91C1C",
  Codex: "#1C1917",
  Cursor: "#A8A29E",
  "Claude Opus 4.6": "#B91C1C",
  "Claude Sonnet 4.6": "#DC2626",
  "GPT-5.4": "#1C1917",
  "Composer 2": "#A8A29E",
  Composer: "#D6D3D1",
};

const LABELS: Record<string, string> = { ...AGENT_LABELS, ...MODEL_LABELS };

export function GateAttritionChart({ data, agents }: GateAttritionChartProps) {
  const config: ChartConfig = Object.fromEntries(
    agents.map((agent) => [
      agent,
      { label: LABELS[agent] ?? agent, color: SERIES_COLORS[agent] ?? "var(--chart-4)" },
    ]),
  );

  if (data.length === 0) return null;

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 24, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="gate"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            >
              <Label value="Gate" position="insideBottom" offset={-14} style={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }} />
            </XAxis>
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tickFormatter={(v: number) => `${v}%`}
            >
              <Label value="Pass Rate" angle={-90} position="insideLeft" offset={0} style={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)", textAnchor: "middle" }} />
            </YAxis>
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
              style={{ backgroundColor: SERIES_HEX[agent] ?? "#999" }}
            />
            <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--muted-foreground)]">
              {LABELS[agent] ?? agent}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
