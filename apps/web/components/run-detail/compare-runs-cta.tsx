import Link from "next/link";

interface CompareRunsCtaProps {
  href: string;
}

export function CompareRunsCta({ href }: CompareRunsCtaProps) {
  return (
    <div className="border border-background rounded-[3px] p-3 space-y-3">
      <p className="font-[family-name:var(--font-mono)] text-[8px] uppercase tracking-[0.96px] text-border">
        Compare runs
      </p>
      <p className="font-[family-name:var(--font-display)] text-[11.2px] italic leading-[16.8px] text-muted-foreground">
        Watch two agents tackle this scenario side by side, gate by gate.
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 bg-foreground text-card px-4 py-1.5 font-[family-name:var(--font-display)] text-[11px] font-bold hover:bg-muted-foreground transition-colors"
      >
        Open Standoff
        <span className="text-sm">→</span>
      </Link>
    </div>
  );
}
