import type { ReactNode } from "react";

interface SplitCtaPanel {
  kicker: string;
  title: string;
  body: string;
  actions: ReactNode;
}

interface SplitCtaProps {
  left: SplitCtaPanel;
  right: SplitCtaPanel;
}

export function SplitCta({ left, right }: SplitCtaProps) {
  return (
    <div className="flex flex-col md:flex-row">
      <div className="flex-1 min-w-0 flex flex-col gap-2.5 border border-[color:var(--sidebar)] bg-[color:var(--sidebar)] p-8">
        <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[1px] text-[color:var(--muted-foreground)]">
          {left.kicker}
        </span>
        <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-[29px] text-[color:var(--foreground)] w-full">
          {left.title}
        </h3>
        <p className="font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--muted-foreground)]">
          {left.body}
        </p>
        <div className="mt-auto pt-3 flex flex-wrap gap-3">{left.actions}</div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2.5 border border-[color:var(--sidebar)] bg-[color:var(--foreground)] p-8">
        <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[1px] text-[color:var(--border)]">
          {right.kicker}
        </span>
        <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-[29px] text-[color:var(--border)] w-full">
          {right.title}
        </h3>
        <p className="font-[family-name:var(--font-display)] text-sm leading-[1.4] text-[color:var(--chart-4)]">
          {right.body}
        </p>
        <div className="mt-auto pt-3 flex flex-wrap gap-3">{right.actions}</div>
      </div>
    </div>
  );
}
