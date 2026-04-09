import { cn } from "@workspace/ui/lib/utils";

interface StandingEntry {
  rank: number;
  agent: string;
  model: string;
  score: number;
  highestGate: number;
  isCurrentRun?: boolean;
}

interface AgentStandingsProps {
  entries: StandingEntry[];
}

function GatePips({ gate }: { gate: number }) {
  return (
    <span className="font-[family-name:var(--font-display)] text-xs tracking-wider whitespace-nowrap text-muted-foreground">
      {[1, 2, 3, 4, 5].map((g) => (
        <span key={g} className={g <= gate ? "text-muted-foreground" : "text-border"}>
          {g <= gate ? "\u25A0" : "\u25A1"}
          {g < 5 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

export function AgentStandings({ entries }: AgentStandingsProps) {
  if (entries.length === 0) return null;

  return (
    <div className="border border-background rounded-[3px] overflow-hidden">
      <div className="bg-secondary px-3 py-[7px] border-b border-background">
        <span className="font-[family-name:var(--font-mono)] text-[8.5px] leading-none uppercase tracking-[1.02px] text-muted-foreground">
          Agent standings
        </span>
      </div>
      <div className="px-3 py-3">
        {entries.map((entry) => (
          <div
            key={`${entry.agent}-${entry.model}-${entry.rank}`}
            className={cn(
              "flex items-center gap-2 py-2 border-b border-background last:border-b-0",
              entry.isCurrentRun && "bg-accent/5 -mx-3 px-3",
            )}
          >
            <GatePips gate={entry.highestGate} />
            <span className="font-[family-name:var(--font-mono)] text-[9px] text-muted-foreground truncate flex-1 min-w-0">
              {entry.agent} · {entry.model}
            </span>
            <span
              className={cn(
                "font-[family-name:var(--font-mono)] text-[10px] font-medium tabular-nums shrink-0",
                entry.score < 0.2 ? "text-accent" : "text-foreground",
              )}
            >
              {entry.score.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
