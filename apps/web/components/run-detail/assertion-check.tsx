import { Check, X } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

interface AssertionCheckProps {
  name: string;
  passed: boolean;
  className?: string;
}

export function AssertionCheck({ name, passed, className }: AssertionCheckProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1 px-1",
        className,
      )}
    >
      <span
        className={cn(
          "font-[family-name:var(--font-mono)] text-[11px] leading-snug",
          passed ? "text-foreground/70" : "text-foreground/40 line-through decoration-foreground/15",
        )}
      >
        {name.replace(/_/g, " ")}
      </span>
      {passed ? (
        <Check size={12} strokeWidth={3} className="shrink-0 text-accent" />
      ) : (
        <X size={12} strokeWidth={3} className="shrink-0 text-foreground/20" />
      )}
    </div>
  );
}
