"use client";

import { useMemo, useState } from "react";
import type { AuditTracePayload, AuditTraceSummary } from "@/data/audits";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

function previewValue(value: unknown, maxLen = 280): string {
  if (typeof value === "string") {
    return value.length > maxLen ? `${value.slice(0, maxLen)}...` : value;
  }
  if (value === null || value === undefined) return "";
  try {
    const json = JSON.stringify(value);
    return json.length > maxLen ? `${json.slice(0, maxLen)}...` : json;
  } catch {
    return String(value);
  }
}

// Kind tags use muted neutral badges so the timeline reads as a calm document
// rather than a flashing log console; the accent colour is reserved for the
// agent's own utterances (assistant_text / assistant_final) which are the
// most valuable signal on the page.
const KIND_COLORS: Record<string, string> = {
  system_message:
    "bg-[color:var(--secondary)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]",
  tool_use: "bg-blue-100 text-blue-900 border border-blue-200",
  tool_result: "bg-blue-50 text-blue-800 border border-blue-200",
  thinking: "bg-amber-100 text-amber-900 border border-amber-200",
  assistant_text:
    "bg-[color:var(--accent)]/10 text-[color:var(--accent)] border border-[color:var(--accent)]/30",
  assistant_final:
    "bg-[color:var(--accent)] text-[color:var(--accent-foreground)] border border-[color:var(--accent)]",
  message:
    "bg-[color:var(--secondary)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]",
  event:
    "bg-[color:var(--secondary)] text-[color:var(--chart-4)] border border-[color:var(--border)]",
};

const FILTER_ACCENT: Record<string, string> = {
  system_message: "border-b-[color:var(--muted-foreground)]",
  tool_use: "border-b-blue-600",
  tool_result: "border-b-blue-400",
  thinking: "border-b-amber-500",
  assistant_text: "border-b-[color:var(--accent)]",
  assistant_final: "border-b-[color:var(--accent)]",
  message: "border-b-[color:var(--muted-foreground)]",
  event: "border-b-[color:var(--chart-4)]",
};

const KIND_DISPLAY_ORDER = [
  "system_message",
  "tool_use",
  "tool_result",
  "thinking",
  "assistant_text",
  "assistant_final",
  "message",
  "event",
];

const KIND_DESCRIPTIONS: Record<string, string> = {
  system_message:
    "System prompt or control instructions injected by the harness/agent runtime. Click to filter.",
  tool_use:
    "Requests from the agent to invoke an external tool (e.g. file read, shell command, browser action). Click to filter.",
  tool_result:
    "Responses returned to the agent after a tool executed. Contains the output or error from the tool invocation. Click to filter.",
  thinking:
    "Internal reasoning blocks where the agent planned its next action before responding. Not visible to the user during the run. Click to filter.",
  assistant_text:
    "Visible text output from the agent shown to the user. Includes explanations, questions, and status updates. Click to filter.",
  assistant_final:
    "The agent's final response at the end of a step or the entire run. Typically a summary of what was accomplished. Click to filter.",
  message:
    "User or system messages sent to the agent as part of the conversation. Includes the original prompt and any follow-ups. Click to filter.",
  event:
    "System-level events such as session start/end, context injection, or harness lifecycle hooks. Click to filter.",
};

interface KindCount {
  kind: string;
  label: string;
  count: number;
}

export function AuditTracePanel({
  trace,
}: {
  summary?: AuditTraceSummary;
  trace: AuditTracePayload | null;
}) {
  const [activeKindFilter, setActiveKindFilter] = useState<string | null>(null);

  const events = trace?.events ?? [];

  const kindCounts = useMemo<KindCount[]>(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
    }
    const ordered: KindCount[] = [];
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

  const filteredEvents = activeKindFilter
    ? events.filter((e) => e.kind === activeKindFilter)
    : events;

  return (
    <section className="border border-[color:var(--border)] bg-[color:var(--card)]">
      <div className="bg-[color:var(--secondary)]/60 border-b border-[color:var(--border)] px-4 py-2 flex items-center justify-between">
        <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Normalized Trace
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
          {events.length > 0 ? `${events.length} events` : "No events"}
        </span>
      </div>

      {/* Filter bar: one button per event kind, equal width */}
      {kindCounts.length > 0 && (
        <TooltipProvider delayDuration={400}>
          <div
            className="grid border-b border-[color:var(--border)]"
            style={{ gridTemplateColumns: `repeat(${kindCounts.length}, 1fr)` }}
          >
            {kindCounts.map((item) => {
              const isActive = activeKindFilter === item.kind;
              return (
                <Tooltip key={item.kind}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveKindFilter((prev) =>
                          prev === item.kind ? null : item.kind,
                        )
                      }
                      className={[
                        "px-3 py-2 border-r border-[color:var(--border)] last:border-r-0 text-left transition-colors cursor-pointer hover:bg-[color:var(--secondary)]/60",
                        isActive &&
                          `bg-[color:var(--secondary)] border-b-2 ${FILTER_ACCENT[item.kind] ?? "border-b-[color:var(--muted-foreground)]"}`,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--chart-4)] truncate">
                        {item.label}
                      </p>
                      <p className="font-[family-name:var(--font-display)] text-base leading-none mt-0.5 text-[color:var(--foreground)]">
                        {item.count.toLocaleString()}
                      </p>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {KIND_DESCRIPTIONS[item.kind] ??
                      `${item.label} events in this trace. Click to filter.`}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {events.length === 0 ? (
        <div className="px-4 py-4 text-xs text-[color:var(--chart-4)]">
          No structured trace events captured. View raw agent output below.
        </div>
      ) : (
        <>
          {activeKindFilter && (
            <div className="px-4 py-1.5 flex items-center gap-2 bg-[color:var(--secondary)]/60 border-b border-[color:var(--border)]">
              <span className="text-xs text-[color:var(--muted-foreground)]">
                Showing {filteredEvents.length} of {events.length} events
              </span>
              <button
                type="button"
                onClick={() => setActiveKindFilter(null)}
                className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[color:var(--chart-4)] hover:text-[color:var(--foreground)] transition-colors cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}
          <div className="divide-y divide-[color:var(--border)] max-h-[28rem] overflow-auto">
            {filteredEvents.map((event, i) => (
              <div
                key={event.id}
                className="px-4 py-2.5 hover:bg-[color:var(--secondary)]/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-[color:var(--chart-4)] w-6 shrink-0 text-right">
                    {i + 1}
                  </span>
                  <span
                    className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 ${
                      KIND_COLORS[event.kind] ??
                      "bg-[color:var(--secondary)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]"
                    }`}
                  >
                    {event.kind.replace(/_/g, " ")}
                  </span>
                  {typeof event.name === "string" && (
                    <span className="text-xs font-bold text-[color:var(--foreground)] font-mono">
                      {event.name}
                    </span>
                  )}
                  {typeof event.role === "string" && event.role !== "assistant" && (
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--chart-4)] uppercase tracking-[0.12em]">
                      {event.role}
                    </span>
                  )}
                </div>
                <pre className="m-0 font-[family-name:var(--font-mono)] text-[11px] leading-[1.55] text-[color:var(--muted-foreground)] whitespace-pre-wrap break-words pl-8">
                  {previewValue(event.content ?? event.input ?? "")}
                </pre>
              </div>
            ))}
          </div>
        </>
      )}

      <details className="border-t border-[color:var(--border)]">
        <summary className="cursor-pointer list-none px-4 py-2 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--chart-4)] hover:text-[color:var(--foreground)] transition-colors">
          Raw trace JSON
        </summary>
        <pre className="m-0 max-h-80 overflow-auto p-4 bg-[color:var(--secondary)]/40 border-t border-[color:var(--border)]">
          <code className="font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[color:var(--foreground)] whitespace-pre-wrap break-words">
            {trace ? JSON.stringify(trace, null, 2) : "No trace payload."}
          </code>
        </pre>
      </details>
    </section>
  );
}
