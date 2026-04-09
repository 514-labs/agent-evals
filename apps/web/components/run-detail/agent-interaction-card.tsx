"use client";

import { useMemo, useState } from "react";
import type { AuditTracePayload } from "@/data/audits";

function previewValue(value: unknown, maxLen = 280): string {
  if (typeof value === "string") {
    return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
  }
  if (value === null || value === undefined) return "";
  try {
    const json = JSON.stringify(value);
    return json.length > maxLen ? `${json.slice(0, maxLen)}…` : json;
  } catch {
    return String(value);
  }
}

const KIND_DISPLAY_ORDER = [
  "tool_use", "tool_result", "thinking", "assistant_text",
  "assistant_final", "event", "user_message", "message", "system_message",
];

const KIND_BADGE_BG: Record<string, string> = {
  event: "bg-chart-4",
  system_message: "bg-chart-4",
  user_message: "bg-muted-foreground",
  message: "bg-muted-foreground",
  assistant_text: "bg-border",
  assistant_final: "bg-border",
  thinking: "bg-border",
  tool_use: "bg-[#2563eb]",
  tool_result: "bg-[#1e3a5f]",
};

const KIND_BADGE_TEXT: Record<string, string> = {
  assistant_text: "text-foreground",
  assistant_final: "text-foreground",
  thinking: "text-foreground",
};

interface AgentInteractionCardProps {
  trace: AuditTracePayload | null;
}

export function AgentInteractionCard({ trace }: AgentInteractionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const events = trace?.events ?? [];

  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
    }
    const ordered: { kind: string; label: string; count: number }[] = [];
    for (const kind of KIND_DISPLAY_ORDER) {
      const count = counts.get(kind);
      if (count) {
        ordered.push({ kind, label: kind.replace(/_/g, " "), count });
        counts.delete(kind);
      }
    }
    for (const [kind, count] of counts) {
      ordered.push({ kind, label: kind.replace(/_/g, " "), count });
    }
    return ordered;
  }, [events]);

  const displayEvents = expanded ? events : events.slice(0, 5);

  if (events.length === 0) {
    return (
      <div className="border border-secondary rounded-[3px] overflow-hidden">
        <div className="bg-secondary px-4 py-2.5">
          <span className="font-[family-name:var(--font-mono)] text-[9px] font-medium tracking-[0.72px] text-foreground">
            Agent interaction
          </span>
        </div>
        <div className="px-4 py-6 font-[family-name:var(--font-display)] text-xs text-muted-foreground">
          No structured trace events captured.
        </div>
      </div>
    );
  }

  return (
    <div className="border border-secondary rounded-[3px] overflow-hidden">
      {/* Panel header */}
      <div className="bg-secondary flex items-center justify-between px-4 py-2.5 h-9">
        <span className="font-[family-name:var(--font-mono)] text-[9px] font-medium tracking-[0.72px] text-foreground">
          Agent interaction
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.5px] text-border">
          {events.length} events
        </span>
      </div>

      {/* Kind counts row */}
      <div className="flex h-16">
        {kindCounts.map((item) => (
          <div
            key={item.kind}
            className="flex-1 min-w-0 flex flex-col gap-1 px-2 py-2.5 border-l border-b border-secondary first:border-l-0"
          >
            <span className="font-[family-name:var(--font-mono)] text-[8px] font-bold tracking-[0.48px] text-border truncate">
              {item.label}
            </span>
            <span className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
              {item.count}
            </span>
          </div>
        ))}
      </div>

      {/* Event feed */}
      <div>
        {displayEvents.map((event, i) => (
          <div
            key={event.id}
            className="flex gap-1.5 items-start px-4 pt-2.5 pb-3 border-b border-secondary"
          >
            {/* Row meta */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-chart-4 w-3 text-right tabular-nums">
                {i + 1}
              </span>
              <span
                className={`px-1.5 py-1 rounded-[2px] font-[family-name:var(--font-mono)] text-[8px] font-bold tracking-[0.5px] whitespace-nowrap ${
                  KIND_BADGE_BG[event.kind] ?? "bg-chart-4"
                } ${KIND_BADGE_TEXT[event.kind] ?? "text-card"}`}
              >
                {event.kind.replace(/_/g, " ")}
              </span>
              {typeof event.role === "string" && (
                <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold text-muted-foreground whitespace-nowrap">
                  {event.role}
                </span>
              )}
              {typeof event.name === "string" && (
                <span className="font-[family-name:var(--font-mono)] text-[9px] font-bold text-muted-foreground whitespace-nowrap">
                  {event.name}
                </span>
              )}
            </div>
            {/* Content */}
            {(event.content || event.input) && (
              <p className="font-[family-name:var(--font-display)] text-[11px] leading-[16px] text-muted-foreground min-w-0 break-words">
                {previewValue(event.content ?? event.input ?? "")}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Footer: expand + raw trace */}
      <div className="flex">
        {events.length > 5 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex-1 bg-secondary px-4 py-2.5 text-left font-[family-name:var(--font-mono)] text-[9px] font-bold tracking-[0.56px] text-border hover:text-muted-foreground transition-colors"
          >
            {expanded ? "Collapse" : `Show all ${events.length} events`}
          </button>
        )}
        <details className="flex-1">
          <summary className="bg-secondary px-4 py-2.5 font-[family-name:var(--font-mono)] text-[9px] font-bold tracking-[0.56px] text-border hover:text-muted-foreground transition-colors cursor-pointer list-none">
            Raw trace JSON
          </summary>
          <pre className="max-h-64 overflow-auto p-4 bg-[#0d0d0d]">
            <code className="text-xs leading-relaxed text-white/70 whitespace-pre-wrap break-words">
              {trace ? JSON.stringify(trace, null, 2) : "No trace payload."}
            </code>
          </pre>
        </details>
      </div>
    </div>
  );
}
