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

const KIND_STYLES: Record<string, string> = {
  stdout: "bg-[#FF10F0] text-black",
  trace: "bg-blue-600 text-white",
  stderr: "bg-red-600 text-white",
  service: "bg-black/70 text-white",
  system: "bg-black/50 text-white",
};

function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      className={cn(
        "text-xs font-bold uppercase tracking-[0.16em] px-1 py-0.5",
        KIND_STYLES[kind] ?? "bg-black/30 text-white",
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
  const [showSystemLogs, setShowSystemLogs] = useState(false);
  const defaultLog = useMemo(() => {
    const interaction = logs.find((entry) => entry.kind === "stdout" || entry.kind === "trace");
    return interaction ?? logs[0] ?? null;
  }, [logs]);
  const [activeLogId, setActiveLogId] = useState(defaultLog?.id ?? "");
  const [chunk, setChunk] = useState<ChunkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startLine, setStartLine] = useState(0);
  const scrollRef = useRef<HTMLPreElement>(null);

  const visibleLogs = useMemo(() => {
    if (showSystemLogs) return logs;
    return logs.filter((entry) => entry.kind === "stdout" || entry.kind === "trace");
  }, [logs, showSystemLogs]);

  const activeLog = useMemo(
    () => visibleLogs.find((entry) => entry.id === activeLogId) ?? visibleLogs[0] ?? null,
    [activeLogId, visibleLogs],
  );

  useEffect(() => {
    if (!activeLog && visibleLogs.length > 0) {
      setActiveLogId(visibleLogs[0]!.id);
    }
  }, [activeLog, visibleLogs]);

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

  if (logs.length === 0) {
    return (
      <div className="border-[3px] border-black bg-black p-6">
        <p className="text-xs uppercase tracking-[0.14em] text-white/40">
          No logs attached for this run.
        </p>
      </div>
    );
  }

  const lines = chunk?.content.split("\n") ?? [];
  const lineNumWidth = String((chunk?.endLine ?? 0) + 1).length;
  const hasSystemLogs = logs.some(
    (log) => log.kind === "system" || log.kind === "stderr" || log.kind === "service",
  );

  return (
    <div className="border-[3px] border-black overflow-hidden">
      {/* Terminal chrome */}
      <div className="bg-black px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-[#FF10F0]" />
            <div className="w-2 h-2 bg-white/20" />
            <div className="w-2 h-2 bg-white/10" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white">
            Agent Output
          </p>
        </div>
        {chunk && (
          <span className="text-xs uppercase tracking-[0.14em] text-white/30">
            {chunk.totalLines.toLocaleString()} lines
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="bg-[#111] px-3 py-1.5 flex items-center gap-1.5 border-b border-white/10 overflow-x-auto">
        {visibleLogs.map((log) => (
          <button
            key={log.id}
            type="button"
            onClick={() => setActiveLogId(log.id)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 text-xs uppercase tracking-[0.12em] transition-colors whitespace-nowrap",
              log.id === activeLog?.id
                ? "bg-white/10 text-white"
                : "text-white/35 hover:text-white/65",
            )}
          >
            <KindBadge kind={log.kind} />
            <span>{log.label}</span>
            <span className="text-white/20">{formatBytes(log.bytes)}</span>
          </button>
        ))}
        {hasSystemLogs && (
          <button
            type="button"
            onClick={() => setShowSystemLogs((current) => !current)}
            className={cn(
              "ml-auto px-2 py-1 text-xs uppercase tracking-[0.14em] border border-white/25 transition-colors",
              showSystemLogs
                ? "text-white bg-white/15"
                : "text-white/55 hover:text-white/80",
            )}
          >
            {showSystemLogs ? "Hide System" : "System Logs"}
          </button>
        )}
      </div>

      {/* Pagination */}
      <div className="bg-[#0a0a0a] px-4 py-1 flex items-center justify-between border-b border-white/5">
        <span className="text-xs uppercase tracking-[0.14em] text-white/25">
          {chunk
            ? `${(chunk.startLine + 1).toLocaleString()}–${(chunk.endLine + 1).toLocaleString()} of ${chunk.totalLines.toLocaleString()}`
            : "—"}
        </span>
        <div className="flex items-center gap-0.5">
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
              className="px-1.5 py-0.5 text-xs uppercase tracking-[0.12em] text-white/35 hover:text-white disabled:opacity-15 disabled:cursor-default"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative bg-[#0d0d0d]">
        {loading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <span className="text-xs uppercase tracking-[0.2em] text-[#FF10F0]">
              Loading...
            </span>
          </div>
        )}
        {error ? (
          <div className="p-6 text-xs text-red-400">{error}</div>
        ) : (
          <pre
            ref={scrollRef}
            className="m-0 max-h-144 overflow-auto p-0"
          >
            <code className="text-xs leading-[1.6] block">
              {lines.map((line, i) => {
                const lineNum = (chunk?.startLine ?? 0) + i + 1;
                return (
                  <div
                    key={`${startLine}-${i}`}
                    className="flex hover:bg-white/3 group"
                  >
                    <span
                      className="select-none text-white/12 text-right pr-3 pl-3 group-hover:text-white/20 shrink-0 border-r border-white/5"
                      style={{ width: `${Math.max(lineNumWidth, 4) + 2}ch` }}
                    >
                      {lineNum}
                    </span>
                    <span className="text-white/70 pl-3 pr-3 whitespace-pre-wrap break-all min-w-0 flex-1">
                      {line || "\u00A0"}
                    </span>
                  </div>
                );
              })}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
