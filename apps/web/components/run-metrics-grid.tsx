"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

interface MetricItem {
  label: string;
  value: string;
  accent: boolean;
  description: string;
  dividerAfter?: boolean;
}

export function RunMetricsGrid({ metrics }: { metrics: MetricItem[] }) {
  return (
    <TooltipProvider delayDuration={400}>
      <div className="grid grid-cols-4 lg:grid-cols-7">
        {metrics.map((metric) => (
          <Tooltip key={metric.label}>
            <TooltipTrigger asChild>
              <div
                className={`p-3 border-r border-[color:var(--border)] last:border-r-0 border-b lg:border-b-0 border-b-[color:var(--border)] cursor-default ${
                  metric.dividerAfter
                    ? "lg:border-r-2 lg:border-r-[color:var(--border)]"
                    : ""
                }`}
              >
                <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--chart-4)]">
                  {metric.label}
                </p>
                <p
                  className={`font-[family-name:var(--font-display)] text-lg mt-0.5 ${
                    metric.accent
                      ? "text-[color:var(--accent)]"
                      : "text-[color:var(--foreground)]"
                  }`}
                >
                  {metric.value}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">{metric.description}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
