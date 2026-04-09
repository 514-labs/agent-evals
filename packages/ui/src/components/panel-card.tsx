import * as React from "react";
import { cn } from "@workspace/ui/lib/utils";

interface PanelCardProps {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PanelCard({ title, trailing, children, className }: PanelCardProps) {
  return (
    <div className={cn("border border-secondary rounded-[3px] overflow-hidden", className)}>
      <div className="bg-secondary flex items-center justify-between px-4 py-2.5 h-9">
        <span className="font-[family-name:var(--font-mono)] text-[9px] font-medium tracking-[0.72px] text-foreground">
          {title}
        </span>
        {trailing && (
          <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.5px] text-border">
            {trailing}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
