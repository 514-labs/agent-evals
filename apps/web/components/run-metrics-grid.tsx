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
    <TooltipProvider>
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-0">
        {metrics.map((metric) => (
          <Tooltip key={metric.label}>
            <TooltipTrigger asChild>
              <div
                className={`p-2.5 border-r border-black/10 last:border-r-0 border-b lg:border-b-0 cursor-default ${
                  metric.dividerAfter ? "lg:border-r-2 lg:border-r-black/20" : ""
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">
                  {metric.label}
                </p>
                <p
                  className={`font-[family-name:var(--font-display)] text-lg mt-0.5 ${
                    metric.accent ? "text-[#FF10F0]" : ""
                  }`}
                >
                  {metric.value}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {metric.description}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
