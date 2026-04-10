"use client";

import { useMemo, useState } from "react";
import { scaleLog, scaleLinear } from "d3-scale";
import type { LiftPoint } from "./aggregate";
import { AGENT_LABELS } from "./aggregate";

type TierKey = "all" | "tier-1" | "tier-2" | "tier-3";

interface LiftChartProps {
  dataByTier: Record<TierKey, LiftPoint[]>;
}

const TIER_OPTIONS: { key: TierKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tier-1", label: "T1" },
  { key: "tier-2", label: "T2" },
  { key: "tier-3", label: "T3" },
];

const AGENT_COLORS: Record<string, string> = {
  "Claude-Code": "#B91C1C",
  Codex: "#1C1917",
  Cursor: "#A8A29E",
};

const AGENT_ORDER = ["Claude-Code", "Codex", "Cursor"];

const W = 732;
const H = 302;
const PAD = { top: 20, right: 30, bottom: 72, left: 50 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function formatXTick(v: number, mode: "cost" | "time"): string {
  if (mode === "cost") return v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`;
  if (v < 60) return `${v}s`;
  const m = v / 60;
  return Number.isInteger(m) ? `${m}m` : `${m.toFixed(1)}m`;
}

const TIME_BREAK = 90;
const TIME_MAX = 195;
const BREAK_ZONE = 40;
const BREAK_GAP = 12;

function makeTimeBrokenScale(innerW: number) {
  const linearStart = BREAK_ZONE + BREAK_GAP;
  const linear = scaleLinear().domain([TIME_BREAK, TIME_MAX]).range([linearStart, innerW]);

  function scale(v: number): number {
    if (v <= TIME_BREAK) {
      return scaleLinear().domain([0, TIME_BREAK]).range([0, BREAK_ZONE])(v);
    }
    return linear(Math.min(v, TIME_MAX));
  }
  scale.ticks = (): number[] => [120, 150, 180];
  return { scale, linearStart };
}

function DesktopLiftChart({ data, mode }: { data: LiftPoint[]; mode: "cost" | "time" }) {
  const sorted = [...data].sort((a, b) => AGENT_ORDER.indexOf(a.agent) - AGENT_ORDER.indexOf(b.agent));

  const { xScale, yScale, xTicks, yTicks, isBroken } = useMemo(() => {
    const allX = sorted.flatMap((d) =>
      mode === "cost" ? [d.baseCost, d.specCost] : [d.baseTime, d.specTime],
    ).filter((v) => v > 0);
    const allY = sorted.flatMap((d) => [d.baseScore, d.specScore]);

    if (allX.length === 0) return { xScale: null, yScale: null, xTicks: [] as number[], yTicks: [] as number[], isBroken: false };

    const yMin = Math.max(0, Math.min(...allY) - 0.1);
    const yMax = 1.0;
    const ys = scaleLinear().domain([yMin, yMax]).range([INNER_H, 0]);

    const step = yMax - yMin > 0.5 ? 0.2 : yMax - yMin > 0.2 ? 0.1 : 0.05;
    const explicitYTicks: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) {
      explicitYTicks.push(Math.round(v * 100) / 100);
    }

    if (mode === "time") {
      const { scale } = makeTimeBrokenScale(INNER_W);
      return { xScale: scale, yScale: ys, xTicks: scale.ticks(), yTicks: explicitYTicks, isBroken: true };
    }

    const xMin = Math.max(0.01, Math.min(...allX) * 0.5);
    const xMax = Math.max(...allX) * 2;
    const xs = scaleLog().domain([xMin, xMax]).range([0, INNER_W]).nice();

    const rawXTicks = xs.ticks(4);
    const filteredXTicks = rawXTicks.filter((_, i, arr) => {
      if (i === 0 || i === arr.length - 1) return true;
      const prev = xs(arr[i - 1]!);
      const curr = xs(rawXTicks[i]!);
      return curr - prev > 40;
    });

    return { xScale: xs, yScale: ys, xTicks: filteredXTicks, yTicks: explicitYTicks, isBroken: false };
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

        {isBroken && (
          <g>
            <line x1={BREAK_ZONE + 2} x2={BREAK_ZONE + 2} y1={0} y2={INNER_H} stroke="var(--background)" strokeWidth={BREAK_GAP + 2} />
            <line x1={BREAK_ZONE - 1} x2={BREAK_ZONE + 5} y1={INNER_H - 4} y2={INNER_H + 4} stroke="var(--muted-foreground)" strokeWidth={1} />
            <line x1={BREAK_ZONE + 5} x2={BREAK_ZONE + 11} y1={INNER_H - 4} y2={INNER_H + 4} stroke="var(--muted-foreground)" strokeWidth={1} />
            <text x={BREAK_ZONE / 2} y={INNER_H + 16} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
              0–1.5m
            </text>
          </g>
        )}

        {xTicks.map((t) => (
          <text key={`xl-${t}`} x={xScale(t)} y={INNER_H + 16} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
            {formatXTick(t, mode)}
          </text>
        ))}
        <text x={INNER_W / 2} y={INNER_H + 34} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
          {mode === "cost" ? "Cost (log scale)" : "Time"}
        </text>
        {yTicks.map((t) => (
          <text key={`yl-${t}`} x={-8} y={yScale(t) + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)">
            {t.toFixed(2)}
          </text>
        ))}
        <text x={0} y={0} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)" fontFamily="var(--font-mono)" transform={`translate(-34,${INNER_H / 2}) rotate(-90)`}>
          Gated Score
        </text>

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
    </svg>
  );
}

function MobileLiftRow({ point, mode }: { point: LiftPoint; mode: "cost" | "time" }) {
  const color = AGENT_COLORS[point.agent] ?? "#999";
  const label = AGENT_LABELS[point.agent] ?? point.agent;
  const minScore = Math.min(point.baseScore, point.specScore);
  const maxScore = Math.max(point.baseScore, point.specScore);
  const rangeMin = Math.max(0, minScore - 0.15);
  const rangeMax = Math.min(1.0, maxScore + 0.15);
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
          {point.baseScore.toFixed(2)} base-rt (n={point.baseN})
        </span>
        <span className="font-[family-name:var(--font-display)] text-[10px] text-[color:var(--muted-foreground)] tabular-nums">
          {point.specScore.toFixed(2)} classic-de (n={point.specN})
        </span>
      </div>
    </div>
  );
}

export function LiftChart({ dataByTier }: LiftChartProps) {
  const [mode, setMode] = useState<"cost" | "time">("cost");
  const [tier, setTier] = useState<TierKey>("all");
  const data = dataByTier[tier];

  const sorted = data
    ? [...data].sort((a, b) => AGENT_ORDER.indexOf(a.agent) - AGENT_ORDER.indexOf(b.agent))
    : [];
  const hasData = sorted.length > 0;

  return (
    <>
      {/* Controls row */}
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
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
                    : "text-[color:var(--chart-4)] border-[color:var(--secondary)] bg-[color:var(--card)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="border border-[color:var(--border)] bg-[color:var(--secondary)] p-6 flex items-center justify-center min-h-[280px]">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
            No runs with both harnesses at this difficulty tier
          </p>
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden">
            {sorted.map((d) => (
              <MobileLiftRow key={d.agent} point={d} mode={mode} />
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block">
            <DesktopLiftChart data={sorted} mode={mode} />
          </div>

          {/* Legend: per agent × harness with n counts */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 justify-center">
            {sorted.map((d) => {
          const color = AGENT_COLORS[d.agent] ?? "#999";
          const label = AGENT_LABELS[d.agent] ?? d.agent;
          return (
            <div key={d.agent} className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full border-2" style={{ borderColor: color }} />
                <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--muted-foreground)]">
                  {label} Base-RT
                  <span className="font-normal ml-1 text-[color:var(--chart-4)]">n={d.baseN}</span>
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--muted-foreground)]">
                  {label} Classic-DE
                  <span className="font-normal ml-1 text-[color:var(--chart-4)]">n={d.specN}</span>
                </span>
              </span>
            </div>
          );
        })}
          </div>
        </>
      )}
    </>
  );
}
