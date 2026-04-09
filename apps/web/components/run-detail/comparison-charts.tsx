"use client";

import {
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  Cell,
} from "recharts";

interface RunPoint {
  score: number;
  cost: number;
  time: number;
  agent: string;
  isCurrentRun: boolean;
}

interface ComparisonChartsProps {
  currentScore: number;
  currentCost: number;
  scenarioRuns: RunPoint[];
  scenarioTitle: string;
}

function buildKDE(scores: number[], bandwidth = 0.06, steps = 80): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    let density = 0;
    for (const s of scores) {
      const z = (x - s) / bandwidth;
      density += Math.exp(-0.5 * z * z) / (bandwidth * Math.sqrt(2 * Math.PI));
    }
    density /= scores.length || 1;
    points.push({ x, y: density });
  }
  return points;
}

export function ComparisonCharts({
  currentScore,
  currentCost,
  scenarioRuns,
  scenarioTitle,
}: ComparisonChartsProps) {
  const scores = scenarioRuns.map((r) => r.score);
  const kdeData = buildKDE(scores);
  const maxDensity = Math.max(...kdeData.map((d) => d.y), 1);

  const scatterData = scenarioRuns.map((r) => ({
    cost: r.cost > 0 ? r.cost : 0.01,
    score: r.score,
    isCurrentRun: r.isCurrentRun,
  }));

  const dotData = scenarioRuns.map((r) => ({
    x: r.score,
    y: -maxDensity * 0.06,
    isCurrentRun: r.isCurrentRun,
  }));

  const clusterHigh = scores.filter((s) => s >= 0.8).length;
  const clusterLow = scores.filter((s) => s < 0.5).length;
  const currentRun = scenarioRuns.find((r) => r.isCurrentRun);
  const otherRuns = scenarioRuns.filter((r) => !r.isCurrentRun);
  const cheapest = scenarioRuns.reduce((min, r) => (r.cost < min.cost && r.cost > 0 ? r : min), scenarioRuns[0]!);

  const distDescription = (() => {
    const parts: string[] = [`This run scores ${currentScore.toFixed(2)}.`];
    if (clusterHigh > 1) {
      parts.push(` ${clusterHigh} of ${scores.length} runs score above 0.80.`);
    }
    if (clusterLow > 0) {
      parts.push(` ${clusterLow} run${clusterLow > 1 ? "s" : ""} scored below 0.50, suggesting a binary outcome on this scenario.`);
    }
    return parts.join("");
  })();

  const costDescription = (() => {
    if (!currentRun) return "";
    const isCheapest = currentRun.cost <= cheapest.cost;
    const parts: string[] = [];
    if (isCheapest) {
      parts.push(`Cheapest run at $${currentRun.cost.toFixed(2)}.`);
    } else {
      parts.push(`This run cost $${currentRun.cost.toFixed(2)}.`);
    }
    const costlier = otherRuns.find((r) => r.cost > currentRun.cost * 5);
    if (costlier) {
      const ratio = Math.round(costlier.cost / currentRun.cost);
      parts.push(` ${costlier.agent} reaches ${costlier.score.toFixed(2)} but costs ${ratio}× more.`);
    }
    return parts.join("");
  })();

  return (
    <div className="grid grid-cols-2 border border-background bg-background">
      {/* Left: Score distribution */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-medium uppercase tracking-[0.72px] text-foreground">
            Where this run sits
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[8px] font-medium uppercase tracking-[0.48px] text-border">
            this scenario
          </span>
        </div>

        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={kdeData} margin={{ top: 20, right: 4, bottom: 30, left: 4 }}>
              <defs>
                <linearGradient id="kdeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--border)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--border)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1.0]}
                tick={{ fontSize: 9, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                tickFormatter={(v: number) => v.toFixed(2)}
                tickLine={false}
                axisLine={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              <YAxis hide domain={[-(maxDensity * 0.12), maxDensity * 1.2]} />
              <Area
                type="monotone"
                dataKey="y"
                stroke="var(--border)"
                strokeWidth={1.5}
                fill="url(#kdeFill)"
                isAnimationActive={false}
              />
              <ReferenceLine
                x={currentScore}
                stroke="var(--accent)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <ReferenceDot
                x={currentScore}
                y={0}
                r={5}
                fill="var(--accent)"
                stroke="none"
              />
              {scenarioRuns.filter((r) => !r.isCurrentRun).map((r, i) => (
                <ReferenceDot
                  key={i}
                  x={r.score}
                  y={-(maxDensity * 0.06)}
                  r={3}
                  fill="var(--foreground)"
                  stroke="none"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 font-[family-name:var(--font-display)] text-[11.2px] leading-[17.4px] text-muted-foreground">
          <span className="font-semibold">{distDescription.split(".")[0]}.</span>
          <span className="italic">{distDescription.slice(distDescription.indexOf(".") + 1)}</span>
        </p>
      </div>

      {/* Right: Score vs Cost scatter */}
      <div className="p-4 border-l border-background">
        <div className="flex items-center justify-between mb-1">
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-medium uppercase tracking-[0.72px] text-foreground">
            Score vs cost
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[8px] font-medium uppercase tracking-[0.48px] text-border">
            this scenario
          </span>
        </div>

        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 4, bottom: 10, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="cost"
                type="number"
                scale="log"
                domain={["auto", "auto"]}
                tick={{ fontSize: 9, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                tickFormatter={(v: number) => `$${v < 1 ? v.toFixed(2) : v.toFixed(1)}`}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                dataKey="score"
                type="number"
                domain={[0, 1.05]}
                ticks={[0, 0.25, 0.5, 0.75, 1.0]}
                tick={{ fontSize: 9, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                tickFormatter={(v: number) => v.toFixed(2)}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                width={36}
              />
              <Scatter data={scatterData} isAnimationActive={false}>
                {scatterData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.isCurrentRun ? "var(--accent)" : "var(--muted-foreground)"}
                    r={entry.isCurrentRun ? 7 : 4}
                    opacity={entry.isCurrentRun ? 1 : 0.5}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 font-[family-name:var(--font-display)] text-[11.2px] leading-[17.4px] text-muted-foreground">
          <span className="font-semibold">{costDescription.split(".")[0]}.</span>
          <span className="italic">{costDescription.slice(costDescription.indexOf(".") + 1)}</span>
        </p>
      </div>
    </div>
  );
}
