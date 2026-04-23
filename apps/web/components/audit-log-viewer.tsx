"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@workspace/ui/lib/utils";

type LogRef = {
  id: string;
  label: string;
  kind: string;
  bytes: number;
};

type ChunkResponse = {
  content: string;
  totalLines: number;
  startLine: number;
  endLine: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
};

const PAGE_SIZE = 400;

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)}MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)}KB`;
  return `${value}B`;
}

// Display-only overrides. The manifest's `label` stays untouched so backend
// and file names keep their canonical naming; this is pure UI labeling.
const LOG_LABEL_OVERRIDES: Record<string, string> = {
  trace: "Raw Agent Trace",
  agent_raw: "Raw Agent Output",
};

function displayLabel(log: LogRef): string {
  return LOG_LABEL_OVERRIDES[log.id] ?? log.label;
}

const KIND_STYLES: Record<string, string> = {
  stdout:
    "bg-[color:var(--accent)] text-[color:var(--accent-foreground)] border border-[color:var(--accent)]",
  trace: "bg-blue-100 text-blue-900 border border-blue-200",
  stderr: "bg-red-100 text-red-900 border border-red-200",
  service:
    "bg-[color:var(--secondary)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]",
  system:
    "bg-[color:var(--secondary)] text-[color:var(--chart-4)] border border-[color:var(--border)]",
};

function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] px-1 py-0.5",
        KIND_STYLES[kind] ??
          "bg-[color:var(--secondary)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]",
      )}
    >
      {kind}
    </span>
  );
}

export function AuditLogViewer({
  scenario,
  runId,
  logs,
}: {
  scenario: string;
  runId: string;
  logs: LogRef[];
}) {
  const defaultLog = useMemo(() => {
    const stderrLog = logs.find((entry) => entry.kind === "stderr");
    if (stderrLog) return stderrLog;
    const stdoutLog = logs.find((entry) => entry.kind === "stdout");
    return stdoutLog ?? logs[0] ?? null;
  }, [logs]);
  const [activeLogId, setActiveLogId] = useState(defaultLog?.id ?? "");
  const [chunk, setChunk] = useState<ChunkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startLine, setStartLine] = useState(0);
  const scrollRef = useRef<HTMLPreElement>(null);

  const activeLog = useMemo(
    () => logs.find((entry) => entry.id === activeLogId) ?? logs[0] ?? null,
    [activeLogId, logs],
  );

  useEffect(() => {
    if (!activeLog && logs.length > 0) {
      setActiveLogId(logs[0]!.id);
    }
  }, [activeLog, logs]);

  useEffect(() => {
    setStartLine(0);
  }, [activeLogId]);

  useEffect(() => {
    let cancelled = false;
    if (!activeLog) {
      setChunk(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/audits/${encodeURIComponent(scenario)}/${encodeURIComponent(runId)}/logs/${encodeURIComponent(activeLog.id)}?start=${startLine}&limit=${PAGE_SIZE}`,
        );
        if (!response.ok) {
          throw new Error(`Failed to load ${activeLog.label}`);
        }
        const data = (await response.json()) as ChunkResponse;
        if (!cancelled) {
          setChunk(data);
          if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
          }
        }
      } catch (err) {
        if (!cancelled) {
          setChunk(null);
          setError(err instanceof Error ? err.message : "Unable to load logs.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeLog, runId, scenario, startLine]);

  const totalBytes = logs.reduce((sum, log) => sum + log.bytes, 0);

  if (logs.length === 0) {
    return (
      <div className="border border-[color:var(--border)] bg-[color:var(--card)] p-6">
        <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
          No logs attached for this run.
        </p>
      </div>
    );
  }

  const lines = chunk?.content.split("\n") ?? [];
  const lineNumWidth = String((chunk?.endLine ?? 0) + 1).length;

  return (
    <details
      open
      className="border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden group/debug"
    >
      <summary className="bg-[color:var(--secondary)]/60 border-b border-[color:var(--border)] px-4 py-2 flex items-center justify-between gap-3 cursor-pointer list-none select-none hover:bg-[color:var(--secondary)] transition-colors">
        <div className="flex items-center gap-3">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Debugging Output
          </p>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
            {logs.length} {logs.length === 1 ? "file" : "files"} · {formatBytes(totalBytes)}
          </span>
        </div>
        <span className="text-xl leading-none font-bold text-[color:var(--chart-4)] group-open/debug:rotate-45 transition-transform">
          +
        </span>
      </summary>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Log file"
        className="bg-[color:var(--secondary)]/40 border-b border-[color:var(--border)] px-3 py-2 flex flex-wrap items-center gap-1.5"
      >
        {logs.map((log) => {
          const isActive = log.id === activeLog?.id;
          return (
            <button
              key={log.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveLogId(log.id)}
              className={cn(
                "px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] transition-colors whitespace-nowrap border",
                isActive
                  ? "bg-[color:var(--card)] border-[color:var(--accent)] text-[color:var(--foreground)] font-bold"
                  : "bg-[color:var(--card)] border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--foreground)]",
              )}
            >
              {displayLabel(log)}
            </button>
          );
        })}
      </div>

      {/* Pagination / metadata */}
      <div className="bg-[color:var(--secondary)]/30 border-b border-[color:var(--border)] px-4 py-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)] tabular-nums shrink-0">
            {chunk
              ? `${(chunk.startLine + 1).toLocaleString()}–${(chunk.endLine + 1).toLocaleString()} of ${chunk.totalLines.toLocaleString()}`
              : "—"}
          </span>
          {activeLog && (
            <>
              <span className="text-[color:var(--border)]" aria-hidden>
                ·
              </span>
              <KindBadge kind={activeLog.kind} />
              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)] tabular-nums shrink-0">
                {formatBytes(activeLog.bytes)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {[
            { label: "Top", disabled: !chunk?.hasMoreBefore, action: () => setStartLine(0) },
            { label: "↑", disabled: !chunk?.hasMoreBefore, action: () => setStartLine(Math.max(0, startLine - PAGE_SIZE)) },
            { label: "↓", disabled: !chunk?.hasMoreAfter, action: () => setStartLine(startLine + PAGE_SIZE) },
            {
              label: "End",
              disabled: !chunk || chunk.totalLines <= PAGE_SIZE,
              action: () => chunk && setStartLine(Math.max(0, chunk.totalLines - PAGE_SIZE)),
            },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              disabled={btn.disabled}
              onClick={btn.action}
              className="px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--chart-4)] hover:text-[color:var(--foreground)] disabled:opacity-30 disabled:cursor-default"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content — fixed height to prevent layout bounce on open/close */}
      <div className="relative bg-[color:var(--card)] h-96">
        {loading && (
          <div className="absolute inset-0 bg-[color:var(--card)]/80 flex items-center justify-center z-10 backdrop-blur-[1px]">
            <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">
              Loading...
            </span>
          </div>
        )}
        {error ? (
          <div className="p-6 font-[family-name:var(--font-mono)] text-xs text-red-700">
            {error}
          </div>
        ) : (
          <pre ref={scrollRef} className="m-0 h-full overflow-auto p-0">
            <code className="font-[family-name:var(--font-mono)] text-[11px] leading-[1.6] block">
              {lines.map((line, i) => {
                const lineNum = (chunk?.startLine ?? 0) + i + 1;
                return (
                  <div
                    key={`${startLine}-${i}`}
                    className="flex hover:bg-[color:var(--secondary)]/40 group"
                  >
                    <span
                      className="select-none text-[color:var(--chart-4)]/70 text-right pr-3 pl-3 group-hover:text-[color:var(--chart-4)] shrink-0 border-r border-[color:var(--border)] tabular-nums"
                      style={{ width: `${Math.max(lineNumWidth, 4) + 2}ch` }}
                    >
                      {lineNum}
                    </span>
                    <span className="text-[color:var(--foreground)] pl-3 pr-3 whitespace-pre-wrap break-all min-w-0 flex-1">
                      {line || "\u00A0"}
                    </span>
                  </div>
                );
              })}
            </code>
          </pre>
        )}
      </div>
    </details>
  );
}
