"use client";

import type { LiftBarData } from "./aggregate";
import { AGENT_LABELS } from "./aggregate";

interface HarnessLiftChartProps {
  harnessData: LiftBarData[];
  personaData: LiftBarData[];
}

function LiftBar({
  value,
  max,
  label,
  color,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 h-[18px]">
      <div className="flex-1 relative h-[14px]">
        <div
          className="absolute inset-y-0 left-0 h-full"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-[family-name:var(--font-display)] text-[11px] text-[color:var(--muted-foreground)] tabular-nums whitespace-nowrap shrink-0 w-[90px] text-right">
        {value.toFixed(2)} {label}
      </span>
    </div>
  );
}

function LiftPanel({
  title,
  subtitle,
  data,
  beforeLabel,
  afterLabel,
  summary,
}: {
  title: string;
  subtitle: string;
  data: LiftBarData[];
  beforeLabel: string;
  afterLabel: string;
  summary: string;
}) {
  if (data.length === 0) {
    return (
      <div className="border border-[color:var(--border)] bg-[color:var(--secondary)] p-6 flex items-center justify-center min-h-[200px]">
        <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--chart-4)]">
          Insufficient data
        </p>
      </div>
    );
  }

  const maxScore = Math.max(...data.flatMap((d) => [d.before, d.after]), 1);

  return (
    <div className="border border-[color:var(--border)] bg-[color:var(--card)] p-5">
      <div className="flex items-baseline justify-between mb-5">
        <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[1.2px] text-[color:var(--foreground)]">
          {title}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[1px] text-[color:var(--chart-4)]">
          {subtitle}
        </span>
      </div>

      <div className="space-y-5">
        {data.map((row) => (
          <div key={row.agent}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="font-[family-name:var(--font-display)] text-xs font-bold text-[color:var(--foreground)]">
                {AGENT_LABELS[row.agent] ?? row.agent}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[color:var(--accent)] tabular-nums">
                {row.delta > 0 ? "+" : ""}{row.delta}%
              </span>
            </div>
            <div className="space-y-1">
              <LiftBar value={row.before} max={maxScore} label={beforeLabel} color="var(--chart-4)" />
              <LiftBar value={row.after} max={maxScore} label={afterLabel} color="var(--chart-1)" />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 font-[family-name:var(--font-display)] text-[11px] italic leading-[16px] text-[color:var(--muted-foreground)]">
        {summary}
      </p>
    </div>
  );
}

export function HarnessLiftChart({ harnessData, personaData }: HarnessLiftChartProps) {
  const harnessSummary =
    harnessData.length > 0
      ? `Harness lift ranged from ${Math.min(...harnessData.map((d) => d.delta))}% to ${Math.max(...harnessData.map((d) => d.delta))}% across agents.`
      : "";

  const personaSummary =
    personaData.length > 0
      ? `Persona lift ranged from ${Math.min(...personaData.map((d) => d.delta))}% to ${Math.max(...personaData.map((d) => d.delta))}% across agents.`
      : "";

  const hasPersona = personaData.length > 0;

  return (
    <div className={`grid grid-cols-1 ${hasPersona ? "md:grid-cols-2" : ""} gap-0`}>
      <LiftPanel
        title="Harness Lift on Score"
        subtitle="base-rt → classic-de"
        data={harnessData}
        beforeLabel="base-rt"
        afterLabel="classic-de"
        summary={harnessSummary}
      />
      {hasPersona && (
        <LiftPanel
          title="Persona Lift on Score"
          subtitle="naive → savvy"
          data={personaData}
          beforeLabel="naive"
          afterLabel="savvy"
          summary={personaSummary}
        />
      )}
    </div>
  );
}
