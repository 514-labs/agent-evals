import { cn } from "@workspace/ui/lib/utils";

const KIND_COLORS: Record<string, string> = {
  system_message: "bg-muted text-muted-foreground",
  tool_use: "bg-blue-600/10 text-blue-700",
  tool_result: "bg-blue-900/10 text-blue-900",
  thinking: "bg-amber-500/10 text-amber-700",
  assistant_text: "bg-accent/10 text-accent",
  assistant_final: "bg-accent/10 text-accent",
  message: "bg-foreground/8 text-foreground/70",
  event: "bg-foreground/5 text-foreground/50",
  user_message: "bg-foreground/8 text-foreground/70",
};

interface EventBadgeProps {
  kind: string;
  className?: string;
}

export function EventBadge({ kind, className }: EventBadgeProps) {
  const label = kind.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]",
        KIND_COLORS[kind] ?? "bg-foreground/5 text-foreground/50",
        className,
      )}
    >
      {label}
    </span>
  );
}
