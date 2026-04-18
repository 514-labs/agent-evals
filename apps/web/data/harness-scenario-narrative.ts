import type { ParsedHarnessPoint } from "@/data/harness-version-scenario-matrix";
import { HARNESS_MATRIX_GATE_MAX } from "@/data/harness-version-scenario-matrix";

export const HARNESS_PERSONA_ORDER = ["baseline", "v2", "v3", "v4", "v5"] as const;

export type HarnessNarrativeX = "costUsd" | "timeSec" | "turns";
export type HarnessNarrativeY = "score" | "gatePassed";

const EPS = 1e-6;

export type HarnessScenarioNarrative = {
  topline: string;
  paragraphs: string[];
};

function yValue(p: ParsedHarnessPoint, yField: HarnessNarrativeY): number {
  return yField === "score" ? p.score : p.gatePassed;
}

function xValue(p: ParsedHarnessPoint, xField: HarnessNarrativeX): number {
  return p[xField];
}

function formatY(yField: HarnessNarrativeY, v: number): string {
  if (yField === "score") return v.toFixed(2);
  return `${Math.round(v)}/${HARNESS_MATRIX_GATE_MAX}`;
}

function formatX(xField: HarnessNarrativeX, v: number): string {
  if (xField === "costUsd") return `$${v.toFixed(2)}`;
  if (xField === "timeSec") return `${Math.round(v)}s`;
  return `${Math.round(v)} turns`;
}

function xAxisName(xField: HarnessNarrativeX): "cost" | "time" | "turns" {
  if (xField === "costUsd") return "cost";
  if (xField === "timeSec") return "time";
  return "turns";
}

function yAxisName(yField: HarnessNarrativeY): "score" | "gate" {
  return yField === "score" ? "score" : "gate";
}

/** Product revisions present in canonical order (v2 first … latest last). */
function productRevisions(byPersona: Map<string, ParsedHarnessPoint>): ParsedHarnessPoint[] {
  const out: ParsedHarnessPoint[] = [];
  for (let i = 1; i < HARNESS_PERSONA_ORDER.length; i++) {
    const id = HARNESS_PERSONA_ORDER[i]!;
    const p = byPersona.get(id);
    if (p) out.push(p);
  }
  return out;
}

const PRODUCT_FRAMING =
  "**Baseline** is the harness **without our product improvements** (the control). **v2–v5** are **successive product-side harness revisions** trying to beat that baseline. This matrix has **v2–v5** only—there is no **v1** row in the data.";

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

type AxisDelta = { better: boolean; worse: boolean; flat: boolean };

function deltaHigherBetter(v: number, baseline: number): AxisDelta {
  return {
    better: v > baseline + EPS,
    worse: v < baseline - EPS,
    flat: Math.abs(v - baseline) <= EPS,
  };
}

function deltaLowerBetter(v: number, baseline: number): AxisDelta {
  return {
    better: v < baseline - EPS,
    worse: v > baseline + EPS,
    flat: Math.abs(v - baseline) <= EPS,
  };
}

type ChartDeltas = {
  y: AxisDelta;
  x: AxisDelta;
  yLabel: "score" | "gate";
  xLabel: "cost" | "time" | "turns";
};

function chartDeltas(
  p: ParsedHarnessPoint,
  baseline: ParsedHarnessPoint,
  xField: HarnessNarrativeX,
  yField: HarnessNarrativeY,
): ChartDeltas {
  return {
    y: deltaHigherBetter(yValue(p, yField), yValue(baseline, yField)),
    x: deltaLowerBetter(xValue(p, xField), xValue(baseline, xField)),
    yLabel: yAxisName(yField),
    xLabel: xAxisName(xField),
  };
}

function axesBetter(d: ChartDeltas): string[] {
  const out: string[] = [];
  if (d.y.better) out.push(d.yLabel);
  if (d.x.better) out.push(d.xLabel);
  return out;
}

function axesWorse(d: ChartDeltas): string[] {
  const out: string[] = [];
  if (d.y.worse) out.push(d.yLabel);
  if (d.x.worse) out.push(d.xLabel);
  return out;
}

function notWorseOnAny(d: ChartDeltas): boolean {
  return !d.y.worse && !d.x.worse;
}

function productImproved(
  revs: ParsedHarnessPoint[],
  xField: HarnessNarrativeX,
  yField: HarnessNarrativeY,
): boolean {
  if (revs.length < 2) return false;
  const first = revs[0]!;
  const last = revs[revs.length - 1]!;
  if (yValue(last, yField) > yValue(first, yField) + EPS) return true;
  if (xValue(last, xField) < xValue(first, xField) - EPS) return true;
  return false;
}

function buildTopline(
  baseline: ParsedHarnessPoint,
  revs: ParsedHarnessPoint[],
  xField: HarnessNarrativeX,
  yField: HarnessNarrativeY,
): string {
  if (revs.length === 0) return "No product revisions to compare.";

  const latest = revs[revs.length - 1]!;
  const latestDelta = chartDeltas(latest, baseline, xField, yField);
  const better = axesBetter(latestDelta);
  const worse = axesWorse(latestDelta);

  const beatsOnBoth = latestDelta.y.better && latestDelta.x.better;
  const allRevsBeatBothAxes =
    revs.length > 1 &&
    revs.every((r) => {
      const d = chartDeltas(r, baseline, xField, yField);
      return d.y.better && d.x.better;
    });
  const improved = productImproved(revs, xField, yField);

  if (beatsOnBoth) {
    if (allRevsBeatBothAxes) return "Improved, always better than baseline.";
    return `Improved to better than baseline on ${latestDelta.yLabel} and ${latestDelta.xLabel}.`;
  }

  if (better.length > 0 && worse.length === 0 && notWorseOnAny(latestDelta)) {
    return `Improved to better than baseline on ${joinList(better)}.`;
  }

  if (better.length > 0 && worse.length > 0) {
    return `Mixed: better on ${joinList(better)}, worse on ${joinList(worse)}.`;
  }

  if (better.length === 0 && worse.length === 0) {
    return "No change vs baseline.";
  }

  if (improved) {
    return "Improved, still worse than baseline.";
  }

  return "Not improved vs baseline.";
}

function formatChartReading(
  p: ParsedHarnessPoint,
  xField: HarnessNarrativeX,
  yField: HarnessNarrativeY,
): string {
  const yName = yAxisName(yField);
  const xName = xAxisName(xField);
  return `${formatY(yField, yValue(p, yField))} ${yName}, ${formatX(xField, xValue(p, xField))} ${xName}`;
}

function buildTrajectoryParagraph(
  baseline: ParsedHarnessPoint,
  revs: ParsedHarnessPoint[],
  xField: HarnessNarrativeX,
  yField: HarnessNarrativeY,
): string {
  const baselineLine = `**baseline** (no product): ${formatChartReading(baseline, xField, yField)}`;
  const revLines = revs.map(
    (r) => `**${r.persona}**: ${formatChartReading(r, xField, yField)}`,
  );
  return [baselineLine, ...revLines].join(" · ");
}

function buildLatestVsBaselineParagraph(
  baseline: ParsedHarnessPoint,
  latest: ParsedHarnessPoint,
  xField: HarnessNarrativeX,
  yField: HarnessNarrativeY,
): string {
  const d = chartDeltas(latest, baseline, xField, yField);
  const parts: string[] = [];

  const yb = formatY(yField, yValue(baseline, yField));
  const yf = formatY(yField, yValue(latest, yField));
  if (d.y.better) parts.push(`${d.yLabel} ${yb} → ${yf}`);
  else if (d.y.worse) parts.push(`${d.yLabel} ${yb} → ${yf} (down)`);
  else parts.push(`${d.yLabel} unchanged at ${yf}`);

  const xb = formatX(xField, xValue(baseline, xField));
  const xf = formatX(xField, xValue(latest, xField));
  if (d.x.better) parts.push(`${d.xLabel} ${xb} → ${xf}`);
  else if (d.x.worse) parts.push(`${d.xLabel} ${xb} → ${xf} (up)`);
  else parts.push(`${d.xLabel} unchanged at ${xf}`);

  return `**${latest.persona} vs baseline** — ${parts.join("; ")}.`;
}

/**
 * Narrative keyed to the two currently selected chart axes (Y = score|gate, X = cost|time|turns).
 * The topline is a one-line takeaway; paragraphs back it with numbers on the same axes.
 */
export function buildHarnessScenarioNarrative(
  scenario: string,
  points: ParsedHarnessPoint[],
  xField: HarnessNarrativeX,
  yField: HarnessNarrativeY,
): HarnessScenarioNarrative {
  const byPersona = new Map(points.map((p) => [p.persona, p] as const));
  const baseline = byPersona.get("baseline");
  const revs = productRevisions(byPersona);

  if (!baseline && revs.length === 0) {
    return {
      topline: "No runs to compare.",
      paragraphs: [
        "Choose another scenario or backfill the matrix so the no-product **baseline** and product **v2–v5** can be contrasted.",
        PRODUCT_FRAMING,
      ],
    };
  }

  if (!baseline) {
    const latest = revs[revs.length - 1]!;
    return {
      topline: "Baseline did not run here.",
      paragraphs: [
        `No-product **baseline** is missing. Newest product revision: **${latest.persona}** (${formatChartReading(latest, xField, yField)}).`,
        PRODUCT_FRAMING,
      ],
    };
  }

  if (revs.length === 0) {
    return {
      topline: "No product revisions in this slice.",
      paragraphs: [
        `No-product **baseline** ran (${formatChartReading(baseline, xField, yField)}), but no **v2–v5** product revisions appear.`,
        PRODUCT_FRAMING,
      ],
    };
  }

  const topline = buildTopline(baseline, revs, xField, yField);
  const latest = revs[revs.length - 1]!;

  return {
    topline,
    paragraphs: [
      buildLatestVsBaselineParagraph(baseline, latest, xField, yField),
      `**Trajectory** — ${buildTrajectoryParagraph(baseline, revs, xField, yField)}.`,
      PRODUCT_FRAMING,
    ],
  };
}
