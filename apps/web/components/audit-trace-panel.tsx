import type { AuditTracePayload, AuditTraceSummary } from "@/data/audits";

function coalesceSummary(
  provided: AuditTraceSummary | undefined,
  trace: AuditTracePayload | null,
): AuditTraceSummary {
  if (provided) return provided;
  const events = trace?.events ?? [];
  return {
    agentSteps: 0,
    toolCallCount: events.filter((event) => event.kind === "tool_use").length,
    thinkingCount: events.filter((event) => event.kind === "thinking").length,
    eventCount: events.length,
  };
}

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
  tool_use: "bg-blue-600 text-white",
  tool_result: "bg-blue-900 text-blue-200",
  thinking: "bg-amber-500 text-black",
  assistant_text: "bg-[#FF10F0] text-black",
  assistant_final: "bg-[#FF10F0] text-black",
  message: "bg-black/70 text-white",
  event: "bg-black/50 text-white",
};

export function AuditTracePanel({
  summary: providedSummary,
  trace,
}: {
  summary?: AuditTraceSummary;
  trace: AuditTracePayload | null;
}) {
  const summary = coalesceSummary(providedSummary, trace);
  const events = trace?.events ?? [];
  const usage = trace?.usage;

  return (
    <section className="border-[3px] border-black">
      <div className="bg-black px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-white">
          Agent Interaction
        </span>
        <span className="text-xs uppercase tracking-[0.12em] text-white/40">
          {events.length > 0 ? `${events.length} events` : "Summary only"}
        </span>
      </div>

      {/* Compact stat strip */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-0 border-b border-black/10">
        {[
          { label: "Steps", value: summary.agentSteps },
          { label: "Events", value: summary.eventCount },
          { label: "Tool Calls", value: summary.toolCallCount },
          { label: "Thinking", value: summary.thinkingCount },
          ...(usage
            ? [
                { label: "In Tokens", value: usage.inputTokens ?? 0 },
                { label: "Out Tokens", value: usage.outputTokens ?? 0 },
                { label: "Cache Read", value: usage.cacheReadTokens ?? 0 },
                { label: "Cost", value: usage.totalCostUsd ? `$${usage.totalCostUsd.toFixed(2)}` : "—" },
              ]
            : []),
        ].map((item) => (
          <div
            key={item.label}
            className="px-2.5 py-2 border-r border-black/10 last:border-r-0 border-b md:border-b-0"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">
              {item.label}
            </p>
            <p className="font-[family-name:var(--font-display)] text-base leading-none mt-0.5">
              {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Event list */}
      {events.length === 0 ? (
        <div className="px-4 py-4 text-xs text-black/40">
          No structured trace events captured. View raw agent output below.
        </div>
      ) : (
        <div className="divide-y divide-black/8 max-h-72 overflow-auto">
          {events.map((event, i) => (
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
      )}

      {/* Expandable raw */}
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
