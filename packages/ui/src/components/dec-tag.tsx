import * as React from "react";
import { cn } from "@workspace/ui/lib/utils";

interface DecTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function DecTag({ children, className, ...props }: DecTagProps) {
  return (
    <span
      className={cn(
        "bg-card border border-secondary px-3 py-1.5 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase text-chart-4 tracking-[1px] whitespace-nowrap",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
