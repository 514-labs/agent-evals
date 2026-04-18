"use client";

import { useState } from "react";
import { scaleLinear } from "d3-scale";
import {
  HARNESS_MATRIX_SCENARIO_ORDER,
  harnessMatrixPointsByScenario,
  type ParsedHarnessPoint,
} from "@/data/harness-version-scenario-matrix";

const PERSONA_FILL: Record<string, string> = {
  baseline: "#4a4a4a",
  v2: "#795548",
  v3: "#c62828",
  v4: "#1565c0",
  v5: "#2e7d32",
};

const W = 360;
const H = 228;
const PAD = { t: 18, r: 14, b: 40, l: 46 };
const INNER_W = W - PAD.l - PAD.r;
const INNER_H = H - PAD.t - PAD.b;

function padDomain(low: number, high: number, padFrac: number, clampLowZero: boolean): [number, number] {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return [0, 1];
  if (high - low < 1e-9) {
    const d = Math.max(Math.abs(high) * 0.12, 0.04);
    const lo = clampLowZero ? Math.max(0, low - d) : low - d;
    return [lo, high + d];
  }
  const p = (high - low) * padFrac;
  const lo = clampLowZero ? Math.max(0, low - p) : low - p;
  return [lo, high + p];
}

type XMode = "cost" | "time";

/** Y = gated score; X = cost (USD) or time (s) per `xField`. */
function ScoreVersusScatter({
  points,
  xField,
}: {
  points: ParsedHarnessPoint[];
  xField: "costUsd" | "timeSec";
}) {
  const xLabel = xField === "costUsd" ? "Cost (USD)" : "Time (s)";

  if (points.length === 0) {
    return (
      <div className="flex h-[228px] max-w-[360px] items-center justify-center border border-dashed border-[color:var(--border)] bg-[color:var(--secondary)]/30 text-[color:var(--muted-foreground)]">
        <span className="font-[family-name:var(--font-mono)] text-[10px]">No completed runs</span>
      </div>
    );
  }

  const xs = points.map((p) => p[xField]);
  const scores = points.map((p) => p.score);
  const [xMin, xMax] = padDomain(Math.min(...xs), Math.max(...xs), 0.12, true);
  const [yMin, yMax] = padDomain(Math.min(...scores), Math.max(...scores), 0.12, true);

  const xScale = scaleLinear().domain([xMin, xMax]).range([0, INNER_W]);
  const yScale = scaleLinear().domain([yMin, yMax]).range([INNER_H, 0]);
  const xTicks = xScale.ticks(4);
  const yTicks = yScale.ticks(4);

  const midY = PAD.t + INNER_H / 2;

  return (
    <div className="w-full max-w-[420px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label={`Score vs ${xLabel}`}>
        <text
          x={14}
          y={midY}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--muted-foreground)"
          fontSize={8}
          fontFamily="var(--font-mono)"
          fontWeight={700}
          transform={`rotate(-90, 14, ${midY})`}
        >
          Score
        </text>

        <g transform={`translate(${PAD.l},${PAD.t})`}>
          {xTicks.map((t) => (
            <line
              key={`xg-${t}`}
              x1={xScale(t)}
              x2={xScale(t)}
              y1={0}
              y2={INNER_H}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
          ))}
          {yTicks.map((t) => (
            <line
              key={`yg-${t}`}
              x1={0}
              x2={INNER_W}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
          ))}
          <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="var(--border)" />
          <line x1={0} x2={0} y1={0} y2={INNER_H} stroke="var(--border)" />

          {xTicks.map((t) => (
            <text
              key={`xl-${t}`}
              x={xScale(t)}
              y={INNER_H + 14}
              textAnchor="middle"
              fontSize={8}
              fill="var(--muted-foreground)"
              fontFamily="var(--font-mono)"
            >
              {xField === "costUsd" ? t.toFixed(2) : `${Math.round(t)}`}
            </text>
          ))}
          {yTicks.map((t) => (
            <text
              key={`yl-${t}`}
              x={-6}
              y={yScale(t) + 3}
              textAnchor="end"
              fontSize={8}
              fill="var(--muted-foreground)"
              fontFamily="var(--font-mono)"
            >
              {t.toFixed(2)}
            </text>
          ))}
          <text
            x={INNER_W / 2}
            y={INNER_H + 32}
            textAnchor="middle"
            fontSize={9}
            fill="var(--muted-foreground)"
            fontFamily="var(--font-mono)"
            fontWeight={600}
          >
            {xLabel}
          </text>

          {points.map((p) => {
            const cx = xScale(p[xField]);
            const cy = yScale(p.score);
            const fill = PERSONA_FILL[p.persona] ?? "#888";
            return (
              <g key={p.persona}>
                <circle cx={cx} cy={cy} r={5} fill={fill} stroke="var(--card)" strokeWidth={1.5} />
                <text
                  x={cx + 7}
                  y={cy + 3}
                  fontSize={8}
                  fill="var(--foreground)"
                  fontFamily="var(--font-mono)"
                  fontWeight={600}
                  paintOrder="stroke"
                  stroke="var(--card)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                >
                  {p.persona}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export function HarnessScenarioMatrixCharts() {
  const [mode, setMode] = useState<XMode>("cost");
  const xField = mode === "cost" ? "costUsd" : "timeSec";
  const byScenario = harnessMatrixPointsByScenario();

  return (
    <div className="space-y-0 border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-4 sm:px-5 sm:py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] pb-4">
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
        <span className="font-[family-name:var(--font-display)] text-xs text-[color:var(--muted-foreground)]">
          Horizontal axis follows selection; score stays on the vertical axis.
        </span>
      </div>

      <div className="mb-4 hidden font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted-foreground)] lg:grid lg:grid-cols-[minmax(11rem,13rem)_1fr] lg:gap-x-4">
        <span>Scenario</span>
        <span className="text-center lg:text-left">Chart</span>
      </div>

      {HARNESS_MATRIX_SCENARIO_ORDER.map((scenario) => {
        const points = byScenario.get(scenario) ?? [];
        return (
          <div
            key={scenario}
            className="grid grid-cols-1 gap-4 border-t border-[color:var(--border)] pt-6 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(11rem,13rem)_1fr] lg:gap-x-4 lg:pt-6"
          >
            <div className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.05em] text-[color:var(--foreground)] lg:max-w-[13rem] lg:self-center lg:pt-2 break-all">
              {scenario}
            </div>
            <div className="flex justify-center lg:justify-start">
              <ScoreVersusScatter points={points} xField={xField} />
            </div>
          </div>
        );
      })}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[color:var(--border)] pt-4 font-[family-name:var(--font-mono)] text-[9px] text-[color:var(--muted-foreground)]">
        {(["baseline", "v2", "v3", "v4", "v5"] as const).map((id) => (
          <span key={id} className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: PERSONA_FILL[id] }} />
            {id}
          </span>
        ))}
      </div>
    </div>
  );
}
