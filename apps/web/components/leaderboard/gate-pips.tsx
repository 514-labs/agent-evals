import { cn } from "@workspace/ui/lib/utils";

type GatePipsProps = {
  gate: number;
  className?: string;
};

export function GatePips({ gate, className }: GatePipsProps) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-display)] text-xs tracking-wider whitespace-nowrap",
        className,
      )}
    >
      {[1, 2, 3, 4, 5].map((g) => (
        <span
          key={g}
          className={cn(
            g <= gate ? "text-muted-foreground" : "text-accent",
          )}
        >
          {g <= gate ? "\u25A0" : "\u25A1"}
          {g < 5 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
