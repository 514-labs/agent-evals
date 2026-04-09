import { cn } from "@workspace/ui/lib/utils";

interface StatCellProps {
  label: string;
  value: string | number;
  className?: string;
}

export function StatCell({ label, value, className }: StatCellProps) {
  return (
    <div className={cn("px-2 py-2.5", className)}>
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="font-[family-name:var(--font-display)] text-lg leading-tight mt-0.5">
        {value}
      </p>
    </div>
  );
}
