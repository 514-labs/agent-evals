"use client";

import { useMemo, useState } from "react";
import { scaleLog, scaleLinear } from "d3-scale";
import type { LiftPoint } from "./aggregate";
import { AGENT_LABELS } from "./aggregate";

interface LiftChartProps {
  data: LiftPoint[];
}

const AGENT_COLORS: Record<string, string> = {
  "Claude-Code": "#B91C1C",
  Codex: "#1C1917",
  Cursor: "#A8A29E",
};

const AGENT_ORDER = ["Claude-Code", "Codex", "Cursor"];

const W = 732;
const H = 280;
const PAD = { top: 20, right: 30, bottom: 50, left: 50 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function formatXTick(v: number, mode: "cost" | "time"): string {
  if (mode === "cost") return v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`;
  if (v < 60) return `${v}s`;
  return `${Math.round(v / 60)}m`;
}

function DesktopLiftChart({ data, mode }: { data: LiftPoint[]; mode: "cost" | "time" }) {
  const sorted = [...data].sort((a, b) => AGENT_ORDER.indexOf(a.agent) - AGENT_ORDER.indexOf(b.agent));

  const { xScale, yScale, xTicks, yTicks } = useMemo(() => {
    const allX = sorted.flatMap((d) =>
      mode === "cost" ? [d.baseCost, d.specCost] : [d.baseTime, d.specTime],
    ).filter((v) => v > 0);
    const allY = sorted.flatMap((d) => [d.baseScore, d.specScore]);

    if (allX.length === 0) return { xScale: null, yScale: null, xTicks: [], yTicks: [] };

    const xMin = Math.max(mode === "cost" ? 0.01 : 1, Math.min(...allX) * 0.5);
    const xMax = Math.max(...allX) * 2;
    const yMin = Math.max(0, Math.min(...allY) - 0.1);
    const yMax = Math.min(1.1, Math.max(...allY) + 0.1);

    const xs = scaleLog().domain([xMin, xMax]).range([0, INNER_W]).nice();
    const ys = scaleLinear().domain([yMin, yMax]).range([INNER_H, 0]).nice();

    const rawXTicks = xs.ticks(4);
    const filteredXTicks = rawXTicks.filter((_, i, arr) => {
      if (i === 0 || i === arr.length - 1) return true;
      const prev = xs(arr[i - 1]!);
      const curr = xs(rawXTicks[i]!);
      return curr - prev > 40;
    });

    return { xScale: xs, yScale: ys, xTicks: filteredXTicks, yTicks: ys.ticks(5) };
  }, [sorted, mode]);

  if (!xScale || !yScale) return null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[732px]">
      <defs>
        {sorted.map((d) => (
          <marker
            key={`arrow-${d.agent}`}
            id={`arrow-${d.agent.replace(/\s+/g, "-")}-${mode}`}
            viewBox="0 0 10 10"
            refX="8" refY="5"
            markerWidth="6" markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={AGENT_COLORS[d.agent] ?? "#999"} />
          </marker>
        ))}
      </defs>

      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {xTicks.map((t) => (
          <line key={`xg-${t}`} x1={xScale(t)} x2={xScale(t)} y1={0} y2={INNER_H} stroke="var(--border)" strokeDasharray="3 3" />
        ))}
        {yTicks.map((t) => (
          <line key={`yg-${t}`} x1={0} x2={INNER_W} y1={yScale(t)} y2={yScale(t)} stroke="var(--border)" strokeDasharray="3 3" />
        ))}

        <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="var(--border)" />
        <line x1={0} x2={0} y1={0} y2={INNER_H} stroke="var(--border)" />

        {xTicks.map((t) => (
          <text key={`xl-${t}`} x={xScale(t)} y={INNER_H + 16} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
            {formatXTick(t, mode)}
          </text>
        ))}
        {yTicks.map((t) => (
          <text key={`yl-${t}`} x={-8} y={yScale(t) + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">
            {t.toFixed(1)}
          </text>
        ))}

        {sorted.map((d) => {
          const color = AGENT_COLORS[d.agent] ?? "#999";
          const xBase = mode === "cost" ? Math.max(0.01, d.baseCost) : Math.max(1, d.baseTime);
          const xSpec = mode === "cost" ? Math.max(0.01, d.specCost) : Math.max(1, d.specTime);
          const x1 = xScale(xBase);
          const y1 = yScale(d.baseScore);
          const x2 = xScale(xSpec);
          const y2 = yScale(d.specScore);
          return (
            <g key={d.agent}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeWidth={1.5}
                markerEnd={`url(#arrow-${d.agent.replace(/\s+/g, "-")}-${mode})`}
              />
              <circle cx={x1} cy={y1} r={5} fill="none" stroke={color} strokeWidth={2} />
              <circle cx={x2} cy={y2} r={5} fill={color} />
            </g>
          );
        })}
      </g>

      {/* Left-aligned legend */}
      <g transform={`translate(${PAD.left},${H - 14})`}>
        {sorted.map((d, i) => {
          const color = AGENT_COLORS[d.agent] ?? "#999";
          return (
            <g key={d.agent} transform={`translate(${i * 100},0)`}>
              <circle cx={5} cy={5} r={4} fill={color} />
              <text x={14} y={9} fontSize={10} fill="var(--muted-foreground)">{AGENT_LABELS[d.agent] ?? d.agent}</text>
            </g>
          );
        })}
        <g transform={`translate(${sorted.length * 100 + 20},0)`}>
          <circle cx={5} cy={5} r={4} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
          <text x={14} y={9} fontSize={9} fill="var(--muted-foreground)">base-rt</text>
          <circle cx={75} cy={5} r={4} fill="var(--muted-foreground)" />
          <text x={84} y={9} fontSize={9} fill="var(--muted-foreground)">classic-de</text>
        </g>
      </g>
    </svg>
  );
}

function MobileLiftRow({ point, mode }: { point: LiftPoint; mode: "cost" | "time" }) {
  const color = AGENT_COLORS[point.agent] ?? "#999";
  const label = AGENT_LABELS[point.agent] ?? point.agent;
  const minScore = Math.min(point.baseScore, point.specScore);
  const maxScore = Math.max(point.baseScore, point.specScore);
  const rangeMin = Math.max(0, minScore - 0.15);
  const rangeMax = Math.min(1.1, maxScore + 0.15);
  const scale = scaleLinear().domain([rangeMin, rangeMax]).range([0, 100]);

  const basePct = scale(point.baseScore);
  const specPct = scale(point.specScore);
  const delta = point.baseScore > 0
    ? Math.round(((point.specScore - point.baseScore) / point.baseScore) * 100)
    : 0;

  return (
    <div className="py-3 border-b border-[color:var(--border)] last:border-b-0">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-[family-name:var(--font-display)] text-xs font-bold" style={{ color }}>
          {label}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--accent)] tabular-nums">
          {delta > 0 ? "+" : ""}{delta}%
        </span>
      </div>
      <div className="relative h-[24px]">
        <div className="absolute inset-x-0 top-[11px] h-px bg-[color:var(--border)]" />
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 24">
          <defs>
            <marker id={`m-arrow-${point.agent}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          </defs>
          <line x1={basePct} y1={12} x2={specPct} y2={12} stroke={color} strokeWidth={1.5} markerEnd={`url(#m-arrow-${point.agent})`} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute top-[6px] size-3 rounded-full border-2" style={{ left: `calc(${basePct}% - 6px)`, borderColor: color }} />
        <div className="absolute top-[6px] size-3 rounded-full" style={{ left: `calc(${specPct}% - 6px)`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-[family-name:var(--font-display)] text-[10px] text-[color:var(--muted-foreground)] tabular-nums">
          {point.baseScore.toFixed(2)} base-rt
        </span>
        <span className="font-[family-name:var(--font-display)] text-[10px] text-[color:var(--muted-foreground)] tabular-nums">
          {point.specScore.toFixed(2)} classic-de
        </span>
      </div>
    </div>
  );
}

export function LiftChart({ data }: LiftChartProps) {
  const [mode, setMode] = useState<"cost" | "time">("cost");

  if (data.length === 0) {
    return (
      <div className="border border-[color:var(--border)] bg-[color:var(--secondary)] p-6 flex items-center justify-center min-h-[280px]">
        <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
          Insufficient data for lift chart
        </p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => AGENT_ORDER.indexOf(a.agent) - AGENT_ORDER.indexOf(b.agent));

  return (
    <>
      {/* Cost / Time toggle */}
      <div className="flex justify-between items-center mb-3">
        <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
          Gated score vs.
        </span>
        <div className="flex">
          <button
            type="button"
            onClick={() => setMode("cost")}
            className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] border px-3 py-1 transition-colors ${
              mode === "cost"
                ? "bg-[color:var(--foreground)] text-[color:var(--card)] border-[color:var(--foreground)]"
                : "text-[color:var(--chart-4)] border-[color:var(--secondary)] bg-[color:var(--card)]"
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
                : "text-[color:var(--chart-4)] border-[color:var(--secondary)] bg-[color:var(--card)]"
            }`}
          >
            Time
          </button>
        </div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden">
        {sorted.map((d) => (
          <MobileLiftRow key={d.agent} point={d} mode={mode} />
        ))}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full border-2 border-[color:var(--muted-foreground)]" />
            <span className="font-[family-name:var(--font-mono)] text-[9px] text-[color:var(--muted-foreground)]">base-rt</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-[color:var(--muted-foreground)]" />
            <span className="font-[family-name:var(--font-mono)] text-[9px] text-[color:var(--muted-foreground)]">classic-de</span>
          </div>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden sm:block">
        <DesktopLiftChart data={data} mode={mode} />
      </div>
    </>
  );
}
