import { scaleLinear } from "d3-scale";

const REFERENCE = { id: "BASE-RT", score: 1.0, cost: 0.45 } as const;
const VERSIONS = [
  { id: "V1", score: 0.33, cost: 1.37, filled: false },
  { id: "V2", score: 0.33, cost: 0.48, filled: false },
  { id: "V3", score: 0.33, cost: 0.5, filled: false },
  { id: "V4", score: 1.0, cost: 0.67, filled: false },
  { id: "V5", score: 1.0, cost: 0.43, filled: true },
] as const;

const RED = "#c62828";
const GREY = "#4a4a4a";

/** Room for y tick labels (left) and point labels (right). */
const W = 492;
const H = 318;
const PAD = { top: 52, right: 52, bottom: 52, left: 60 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

const R_REF = 6;
const R_VER = 6;
const LINE_SHRINK = 7;

const Y_TICK_LABEL_X = -8;

/** Left margin, left of y tick numerals; label reads bottom-to-top after rotation. */
const Y_AXIS_LABEL_X = 16;

/** Position relative to point (cx, cy); y-axis is standard (higher cost toward the top). */
const POINT_LABELS: Record<
  string,
  { dx: number; dy: number; textAnchor: "start" | "middle" | "end" }
> = {
  "BASE-RT": { dx: -10, dy: 12, textAnchor: "end" },
  V4: { dx: -10, dy: 0, textAnchor: "end" },
  V5: { dx: 12, dy: -10, textAnchor: "start" },
  // V1 highest cost (top of chart); V2/V3 lowest — labels to the right, stacked
  V1: { dx: 12, dy: 12, textAnchor: "start" },
  V2: { dx: 12, dy: -12, textAnchor: "start" },
  V3: { dx: 12, dy: 10, textAnchor: "start" },
};

function shortenSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  shrinkA: number,
  shrinkB: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x1, y1, x2, y2 };
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * shrinkA,
    y1: y1 + uy * shrinkA,
    x2: x2 - ux * shrinkB,
    y2: y2 - uy * shrinkB,
  };
}

function PointLabel({
  x,
  y,
  fill,
  textAnchor,
  children,
}: {
  x: number;
  y: number;
  fill: string;
  textAnchor: "start" | "middle" | "end";
  children: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline="middle"
      fontSize={10}
      fill={fill}
      fontFamily="var(--font-display)"
      fontWeight={700}
      paintOrder="stroke"
      stroke="var(--card)"
      strokeWidth={4}
      strokeLinejoin="round"
    >
      {children}
    </text>
  );
}

export function MooseHarnessVersionScatter() {
  const allScores = [REFERENCE.score, ...VERSIONS.map((v) => v.score)];
  const allCosts = [REFERENCE.cost, ...VERSIONS.map((v) => v.cost)];
  const xMax = Math.min(1.05, Math.max(...allScores) + 0.05);
  const xMin = Math.max(0, Math.min(...allScores) - 0.05);
  const yMax = Math.max(...allCosts) * 1.12;
  const xScale = scaleLinear().domain([xMin, xMax]).range([0, INNER_W]);
  /** Standard vertical axis: $0 at bottom, higher cost toward the top. */
  const yScale = scaleLinear().domain([0, yMax]).range([INNER_H, 0]);
  const xTicks = xScale.ticks(6).filter((t) => t >= 0 && t <= 1.001);
  const yTicks = yScale.ticks(5);

  const plotMidY = PAD.top + INNER_H / 2;

  return (
    <div className="min-w-0">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-center text-[color:var(--foreground)] tracking-tight">
        Moose Harness improvement over versions
      </h3>
      <p className="mt-1.5 max-w-[52ch] mx-auto text-center font-[family-name:var(--font-mono)] text-[9px] leading-snug text-pretty text-[color:var(--muted-foreground)]">
        Higher score is to the right; higher cost (USD) is toward the top. Lower cost is better at a given score.
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full h-auto max-w-[492px] mx-auto block overflow-visible"
        role="img"
        aria-label="Scatter plot of score versus cost by harness version"
      >
        <defs>
          <marker
            id="csv-ingest-harness-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={RED} />
          </marker>
        </defs>

        <text
          x={Y_AXIS_LABEL_X}
          y={plotMidY}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--muted-foreground)"
          fontSize={9}
          fontFamily="var(--font-mono)"
          fontWeight={700}
          transform={`rotate(-90, ${Y_AXIS_LABEL_X}, ${plotMidY})`}
        >
          Cost (USD)
        </text>

        <g transform={`translate(${PAD.left},${PAD.top})`}>
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
            <text key={`xl-${t}`} x={xScale(t)} y={INNER_H + 16} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
              {t.toFixed(2)}
            </text>
          ))}
          <text
            x={INNER_W / 2}
            y={INNER_H + 36}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted-foreground)"
            fontFamily="var(--font-mono)"
            fontWeight={600}
          >
            Score
          </text>

          {yTicks.map((t) => (
            <text key={`yl-${t}`} x={Y_TICK_LABEL_X} y={yScale(t) + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">
              ${t.toFixed(2)}
            </text>
          ))}

          {VERSIONS.slice(0, -1).map((_, i) => {
            const a = VERSIONS[i]!;
            const b = VERSIONS[i + 1]!;
            const ax = xScale(a.score);
            const ay = yScale(a.cost);
            const bx = xScale(b.score);
            const by = yScale(b.cost);
            const seg = shortenSegment(ax, ay, bx, by, LINE_SHRINK, LINE_SHRINK);
            return (
              <line
                key={`${a.id}-${b.id}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={RED}
                strokeWidth={1.5}
                markerEnd="url(#csv-ingest-harness-arrow)"
              />
            );
          })}

          <circle cx={xScale(REFERENCE.score)} cy={yScale(REFERENCE.cost)} r={R_REF} fill={GREY} stroke={GREY} strokeWidth={1.5} />
          {VERSIONS.map((v) => {
            const cx = xScale(v.score);
            const cy = yScale(v.cost);
            if (v.filled) {
              return <circle key={v.id} cx={cx} cy={cy} r={R_VER} fill={RED} stroke={RED} strokeWidth={2} />;
            }
            return <circle key={v.id} cx={cx} cy={cy} r={R_VER} fill="none" stroke={RED} strokeWidth={2} />;
          })}

          {(() => {
            const cfg = POINT_LABELS[REFERENCE.id]!;
            const cx = xScale(REFERENCE.score);
            const cy = yScale(REFERENCE.cost);
            return (
              <PointLabel x={cx + cfg.dx} y={cy + cfg.dy} fill={GREY} textAnchor={cfg.textAnchor}>
                {REFERENCE.id}
              </PointLabel>
            );
          })()}
          {VERSIONS.map((v) => {
            const cfg = POINT_LABELS[v.id]!;
            const cx = xScale(v.score);
            const cy = yScale(v.cost);
            return (
              <PointLabel key={`t-${v.id}`} x={cx + cfg.dx} y={cy + cfg.dy} fill={RED} textAnchor={cfg.textAnchor}>
                {v.id}
              </PointLabel>
            );
          })}
        </g>
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: GREY }} />
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--muted-foreground)]">BASE-RT</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full border-2" style={{ borderColor: RED }} />
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--muted-foreground)]">V1–V4</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: RED }} />
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--muted-foreground)]">V5</span>
        </span>
      </div>
    </div>
  );
}
