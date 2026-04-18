"use client";

import { useMemo, useState, type ReactNode } from "react";
import { scaleLinear } from "d3-scale";
import { buildHarnessScenarioNarrative } from "@/data/harness-scenario-narrative";
import {
  HARNESS_MATRIX_GATE_MAX,
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

const X_METRICS = [
  {
    key: "costUsd" as const,
    heading: "Cost",
    label: "Cost (USD)",
    axisDescription: "run cost in USD (lower is better)",
  },
  {
    key: "timeSec" as const,
    heading: "Time",
    label: "Time (s)",
    axisDescription: "wall-clock run time in seconds (lower is better)",
  },
  {
    key: "turns" as const,
    heading: "Turns",
    label: "Turns",
    axisDescription: "agent turn count (lower is better)",
  },
] as const;

type XField = (typeof X_METRICS)[number]["key"];

function xMetricMeta(field: XField) {
  return X_METRICS.find((m) => m.key === field)!;
}

function formatXTick(field: XField, t: number): string {
  if (field === "costUsd") return t.toFixed(2);
  return `${Math.round(t)}`;
}

const Y_METRICS = [
  {
    key: "score" as const,
    heading: "Score",
    axisShort: "Score",
    label: "Score",
    axisDescription: "gated composite score on a 0–1 scale (higher is better)",
  },
  {
    key: "gatePassed" as const,
    heading: "Gate Achievement",
    axisShort: "Gate",
    label: "Gate Achievement",
    axisDescription: `checklist checks passed (0–${HARNESS_MATRIX_GATE_MAX}; higher is better)`,
  },
] as const;

type YField = (typeof Y_METRICS)[number]["key"];

function yMetricMeta(field: YField) {
  return Y_METRICS.find((m) => m.key === field)!;
}

/** Renders `**bold**` segments as `<strong>`. */
function renderInlineBold(text: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong key={k++} className="font-semibold text-[color:var(--foreground)]">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length > 0 ? out : text;
}

function yValue(p: ParsedHarnessPoint, yField: YField): number {
  return yField === "score" ? p.score : p.gatePassed;
}

function yDomain(yField: YField): [number, number] {
  return yField === "score" ? [0, 1] : [0, HARNESS_MATRIX_GATE_MAX];
}

function formatYTick(yField: YField, t: number): string {
  return yField === "score" ? t.toFixed(2) : `${Math.round(t)}`;
}

/** Y = gated score (0–1) or checks passed (0–5); X = cost, time, or turns. */
function ScoreVersusScatter({
  points,
  xField,
  yField,
}: {
  points: ParsedHarnessPoint[];
  xField: XField;
  yField: YField;
}) {
  const { label: xLabel } = xMetricMeta(xField);
  const { axisShort: yAxisShort } = yMetricMeta(yField);

  if (points.length === 0) {
    return (
      <div className="flex h-[228px] max-w-[360px] items-center justify-center border border-dashed border-[color:var(--border)] bg-[color:var(--secondary)]/30 text-[color:var(--muted-foreground)]">
        <span className="font-[family-name:var(--font-mono)] text-[10px]">No completed runs</span>
      </div>
    );
  }

  const xs = points.map((p) => p[xField]);
  const [xMin, xMax] = padDomain(Math.min(...xs), Math.max(...xs), 0.12, true);

  const xScale = scaleLinear().domain([xMin, xMax]).range([0, INNER_W]);
  const [y0, y1] = yDomain(yField);
  const yScale = scaleLinear().domain([y0, y1]).range([INNER_H, 0]);
  const xTicks = xScale.ticks(4);
  const yTicks =
    yField === "score" ? yScale.ticks(4) : Array.from({ length: HARNESS_MATRIX_GATE_MAX + 1 }, (_, i) => i);

  const midY = PAD.t + INNER_H / 2;

  return (
    <div className="w-full max-w-[420px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label={`${yMetricMeta(yField).label} vs ${xLabel}`}
      >
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
          {yAxisShort}
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
              {formatXTick(xField, t)}
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
              {formatYTick(yField, t)}
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
            const cy = yScale(yValue(p, yField));
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
  const [xField, setXField] = useState<XField>("costUsd");
  const [yField, setYField] = useState<YField>("score");
  const [scenario, setScenario] = useState<(typeof HARNESS_MATRIX_SCENARIO_ORDER)[number]>(
    HARNESS_MATRIX_SCENARIO_ORDER[0]!,
  );
  const byScenario = useMemo(() => harnessMatrixPointsByScenario(), []);
  const points = byScenario.get(scenario) ?? [];
  const xMeta = xMetricMeta(xField);
  const yMeta = yMetricMeta(yField);
  const { heading: xHeading } = xMeta;
  const { heading: yHeading } = yMeta;
  const { topline, paragraphs: narrativeParagraphs } = buildHarnessScenarioNarrative(
    scenario,
    points,
    xField,
    yField,
  );

  return (
    <div className="inline-block max-w-full space-y-0 border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-4 sm:px-5 sm:py-6">
      <div className="mb-5 flex flex-col gap-3 border-b border-[color:var(--border)] pb-4 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
            Vertical
          </span>
          <select
            value={yField}
            onChange={(e) => setYField(e.target.value as YField)}
            className="max-w-[min(100%,16rem)] border border-[color:var(--secondary)] bg-[color:var(--card)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--foreground)]/20"
          >
            {Y_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-wrap items-center gap-2 sm:ml-1">
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
            Horizontal
          </span>
          <select
            value={xField}
            onChange={(e) => setXField(e.target.value as XField)}
            className="border border-[color:var(--secondary)] bg-[color:var(--card)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--foreground)]/20"
          >
            {X_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-wrap items-center gap-2 sm:ml-1">
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
            Scenario
          </span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as (typeof HARNESS_MATRIX_SCENARIO_ORDER)[number])}
            className="max-w-[min(100%,28rem)] border border-[color:var(--secondary)] bg-[color:var(--card)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--foreground)]/20"
          >
            {HARNESS_MATRIX_SCENARIO_ORDER.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 max-w-[420px]">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold leading-snug text-[color:var(--foreground)]">
          {yHeading} vs {xHeading} in{" "}
          <span className="font-[family-name:var(--font-mono)] font-semibold tracking-tight break-all">{scenario}</span>
        </h2>
        <p className="mt-1.5 font-[family-name:var(--font-display)] text-xs leading-relaxed text-[color:var(--muted-foreground)]">
          Vertical: {yMeta.axisDescription}. Horizontal: {xMeta.axisDescription}.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col">
          <div className="flex justify-center sm:justify-start">
            <ScoreVersusScatter points={points} xField={xField} yField={yField} />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[color:var(--border)] pt-4 font-[family-name:var(--font-mono)] text-[9px] text-[color:var(--muted-foreground)] sm:justify-start">
            {(["baseline", "v2", "v3", "v4", "v5"] as const).map((id) => (
              <span key={id} className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full" style={{ backgroundColor: PERSONA_FILL[id] }} />
                {id}
              </span>
            ))}
          </div>
        </div>

        <aside
          className="lg:max-w-[22rem] lg:shrink-0 lg:border-l lg:border-[color:var(--border)] lg:pl-6"
          aria-label={`Narrative for scenario ${scenario}`}
        >
          <p className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--chart-4)]">
            Product harness vs baseline
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-sm font-semibold leading-snug text-[color:var(--foreground)]">
            {renderInlineBold(topline)}
          </p>
          <div
            className="mt-3 space-y-3 font-[family-name:var(--font-display)] text-xs leading-relaxed text-[color:var(--muted-foreground)]"
            aria-live="polite"
            aria-atomic="true"
            key={`${scenario}-${xField}-${yField}-${topline}`}
          >
            {narrativeParagraphs.map((para, i) => (
              <p key={i}>{renderInlineBold(para)}</p>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
