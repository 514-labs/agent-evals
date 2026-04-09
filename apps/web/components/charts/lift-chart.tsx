"use client";

import { useMemo } from "react";
import { scaleLog, scaleLinear } from "d3-scale";
import type { LiftPoint } from "./aggregate";

interface LiftChartProps {
  data: LiftPoint[];
}

const AGENT_COLORS: Record<string, string> = {
  "Claude-Code": "#B91C1C",
  Codex: "#1C1917",
  Cursor: "#A8A29E",
};

const AGENT_LABELS: Record<string, string> = {
  "Claude-Code": "Claude Code",
  Codex: "Codex",
  Cursor: "Cursor",
};

const W = 732;
const H = 260;
const PAD = { top: 20, right: 30, bottom: 50, left: 50 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

export function LiftChart({ data }: LiftChartProps) {
  const { xScale, yScale, xTicks, yTicks } = useMemo(() => {
    const allCosts = data.flatMap((d) => [d.baseCost, d.specCost]).filter((c) => c > 0);
    const allScores = data.flatMap((d) => [d.baseScore, d.specScore]);

    if (allCosts.length === 0) return { xScale: null, yScale: null, xTicks: [], yTicks: [] };

    const costMin = Math.max(0.01, Math.min(...allCosts) * 0.5);
    const costMax = Math.max(...allCosts) * 2;
    const scoreMin = Math.max(0, Math.min(...allScores) - 0.1);
    const scoreMax = Math.min(1, Math.max(...allScores) + 0.1);

    const xs = scaleLog().domain([costMin, costMax]).range([0, INNER_W]).nice();
    const ys = scaleLinear().domain([scoreMin, scoreMax]).range([INNER_H, 0]).nice();

    return {
      xScale: xs,
      yScale: ys,
      xTicks: xs.ticks(5),
      yTicks: ys.ticks(5),
    };
  }, [data]);

  if (!xScale || !yScale || data.length === 0) {
    return (
      <div className="border border-[color:var(--border)] bg-[color:var(--secondary)] p-6 flex items-center justify-center min-h-[280px]">
        <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
          Insufficient data for lift chart
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[732px]">
        <defs>
          {data.map((d) => (
            <marker
              key={`arrow-${d.agent}`}
              id={`arrow-${d.agent.replace(/\s+/g, "-")}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={AGENT_COLORS[d.agent] ?? "#999"} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Grid */}
          {xTicks.map((t) => (
            <line key={`xg-${t}`} x1={xScale(t)} x2={xScale(t)} y1={0} y2={INNER_H} stroke="var(--border)" strokeDasharray="3 3" />
          ))}
          {yTicks.map((t) => (
            <line key={`yg-${t}`} x1={0} x2={INNER_W} y1={yScale(t)} y2={yScale(t)} stroke="var(--border)" strokeDasharray="3 3" />
          ))}

          {/* Axes */}
          <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="var(--border)" />
          <line x1={0} x2={0} y1={0} y2={INNER_H} stroke="var(--border)" />

          {/* X axis labels */}
          {xTicks.map((t) => (
            <text key={`xl-${t}`} x={xScale(t)} y={INNER_H + 16} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
              ${t < 1 ? t.toFixed(2) : t.toFixed(0)}
            </text>
          ))}

          {/* Y axis labels */}
          {yTicks.map((t) => (
            <text key={`yl-${t}`} x={-8} y={yScale(t) + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">
              {t.toFixed(1)}
            </text>
          ))}

          {/* Arrows + dots per agent */}
          {data.map((d) => {
            const color = AGENT_COLORS[d.agent] ?? "#999";
            const x1 = xScale(Math.max(0.01, d.baseCost));
            const y1 = yScale(d.baseScore);
            const x2 = xScale(Math.max(0.01, d.specCost));
            const y2 = yScale(d.specScore);
            return (
              <g key={d.agent}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={color}
                  strokeWidth={1.5}
                  markerEnd={`url(#arrow-${d.agent.replace(/\s+/g, "-")})`}
                />
                <circle cx={x1} cy={y1} r={6} fill="none" stroke={color} strokeWidth={2} />
                <circle cx={x2} cy={y2} r={6} fill={color} />
              </g>
            );
          })}
        </g>

        {/* Legend */}
        <g transform={`translate(${PAD.left},${H - 16})`}>
          {data.map((d, i) => {
            const color = AGENT_COLORS[d.agent] ?? "#999";
            const xOff = i * 110;
            return (
              <g key={d.agent} transform={`translate(${xOff},0)`}>
                <circle cx={5} cy={5} r={4} fill={color} />
                <text x={14} y={9} fontSize={10} fill="var(--muted-foreground)">{AGENT_LABELS[d.agent] ?? d.agent}</text>
              </g>
            );
          })}
          <g transform={`translate(${data.length * 110 + 20},0)`}>
            <circle cx={5} cy={5} r={4} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            <text x={14} y={9} fontSize={9} fill="var(--muted-foreground)">base-rt</text>
            <circle cx={75} cy={5} r={4} fill="var(--muted-foreground)" />
            <text x={84} y={9} fontSize={9} fill="var(--muted-foreground)">classic-de</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
