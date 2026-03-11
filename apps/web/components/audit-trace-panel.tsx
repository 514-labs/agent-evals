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

const KIND_COLORS: Record<string, string> = {
  system_message: "bg-zinc-700 text-white",
  tool_use: "bg-blue-600 text-white",
  tool_result: "bg-blue-900 text-blue-200",
  thinking: "bg-amber-500 text-black",
  assistant_text: "bg-[#FF10F0] text-black",
  assistant_final: "bg-[#FF10F0] text-black",
  message: "bg-black/70 text-white",
  event: "bg-black/50 text-white",
};

const FILTER_ACCENT: Record<string, string> = {
  system_message: "border-b-zinc-700",
  tool_use: "border-b-blue-600",
  tool_result: "border-b-blue-900",
  thinking: "border-b-amber-500",
  assistant_text: "border-b-[#FF10F0]",
  assistant_final: "border-b-[#FF10F0]",
  message: "border-b-black/70",
  event: "border-b-black/50",
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
  system_message: "System prompt or control instructions injected by the harness/agent runtime. Click to filter.",
  tool_use: "Requests from the agent to invoke an external tool (e.g. file read, shell command, browser action). Click to filter.",
  tool_result: "Responses returned to the agent after a tool executed. Contains the output or error from the tool invocation. Click to filter.",
  thinking: "Internal reasoning blocks where the agent planned its next action before responding. Not visible to the user during the run. Click to filter.",
  assistant_text: "Visible text output from the agent shown to the user. Includes explanations, questions, and status updates. Click to filter.",
  assistant_final: "The agent's final response at the end of a step or the entire run. Typically a summary of what was accomplished. Click to filter.",
  message: "User or system messages sent to the agent as part of the conversation. Includes the original prompt and any follow-ups. Click to filter.",
  event: "System-level events such as session start/end, context injection, or harness lifecycle hooks. Click to filter.",
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
    <section className="border-[3px] border-black">
      <div className="bg-black px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-white">
          Agent Interaction
        </span>
        <span className="text-xs uppercase tracking-[0.12em] text-white/70">
          {events.length > 0 ? `${events.length} events` : "No events"}
        </span>
      </div>

      {/* Filter bar: one button per event kind, equal width */}
      {kindCounts.length > 0 && (
        <TooltipProvider delayDuration={400}>
          <div
            className="grid gap-0 border-b border-black/10"
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
                        "px-3 py-2 border-r border-black/10 last:border-r-0 text-left transition-colors cursor-pointer hover:bg-black/4",
                        isActive && `bg-black/5 border-b-2 ${FILTER_ACCENT[item.kind] ?? "border-b-black/30"}`,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/35 truncate">
                        {item.label}
                      </p>
                      <p className="font-[family-name:var(--font-display)] text-base leading-none mt-0.5">
                        {item.count.toLocaleString()}
                      </p>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {KIND_DESCRIPTIONS[item.kind] ?? `${item.label} events in this trace. Click to filter.`}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {events.length === 0 ? (
        <div className="px-4 py-4 text-xs text-black/40">
          No structured trace events captured. View raw agent output below.
        </div>
      ) : (
        <>
          {activeKindFilter && (
            <div className="px-4 py-1.5 flex items-center gap-2 bg-black/3 border-b border-black/10">
              <span className="text-xs text-black/50">
                Showing {filteredEvents.length} of {events.length} events
              </span>
              <button
                type="button"
                onClick={() => setActiveKindFilter(null)}
                className="text-xs font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}
          <div className="divide-y divide-black/8 max-h-72 overflow-auto">
            {filteredEvents.map((event, i) => (
              <div key={event.id} className="px-4 py-2 hover:bg-black/2 transition-colors">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-black/25 font-mono w-5 shrink-0 text-right">
                    {i + 1}
                  </span>
                  <span
                    className={`text-xs font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 ${
                      KIND_COLORS[event.kind] ?? "bg-black/30 text-white"
                    }`}
                  >
                    {event.kind.replace(/_/g, " ")}
                  </span>
                  {typeof event.name === "string" && (
                    <span className="text-xs font-bold text-black/60 font-mono">
                      {event.name}
                    </span>
                  )}
                  {typeof event.role === "string" && event.role !== "assistant" && (
                    <span className="text-xs text-black/30 uppercase tracking-[0.12em]">
                      {event.role}
                    </span>
                  )}
                </div>
                <p className="text-xs text-black/60 leading-normal whitespace-pre-wrap break-words pl-7">
                  {previewValue(event.content ?? event.input ?? "")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <details className="border-t border-black/15">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black/40 hover:text-black transition-colors">
          Raw trace JSON
        </summary>
        <pre className="m-0 max-h-80 overflow-auto p-4 bg-[#0d0d0d]">
          <code className="text-xs leading-relaxed text-white/70 whitespace-pre-wrap break-words">
            {trace ? JSON.stringify(trace, null, 2) : "No trace payload."}
          </code>
        </pre>
      </details>
    </section>
  );
}
