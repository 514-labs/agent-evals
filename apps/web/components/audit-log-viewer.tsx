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

function KindBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    stdout: "bg-[#FF10F0] text-black",
    stderr: "bg-red-600 text-white",
    service: "bg-black/80 text-white",
    system: "bg-black/60 text-white",
  };
  return (
    <span
      className={cn(
        "text-[8px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5",
        colors[kind] ?? "bg-black/40 text-white",
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
  const [activeLogId, setActiveLogId] = useState(logs[0]?.id ?? "");
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
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">
          No logs attached for this run.
        </p>
      </div>
    );
  }

  const lines = chunk?.content.split("\n") ?? [];
  const lineNumWidth = String((chunk?.endLine ?? 0) + 1).length;

  return (
    <div className="border-[3px] border-black overflow-hidden">
      {/* Terminal chrome bar */}
      <div className="bg-black px-4 py-2.5 flex items-center justify-between gap-3 border-b-[3px] border-black">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-[10px] h-[10px] bg-[#FF10F0]" />
            <div className="w-[10px] h-[10px] bg-white/20" />
            <div className="w-[10px] h-[10px] bg-white/10" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
            Run Output
          </p>
        </div>
        {chunk && (
          <span className="text-[9px] uppercase tracking-[0.14em] text-white/35">
            {chunk.totalLines.toLocaleString()} lines
          </span>
        )}
      </div>

      {/* Log tab selector */}
      <div className="bg-[#111] px-3 py-2 flex items-center gap-2 border-b border-white/10 overflow-x-auto">
        {logs.map((log) => (
          <button
            key={log.id}
            type="button"
            onClick={() => setActiveLogId(log.id)}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors whitespace-nowrap",
              log.id === activeLog?.id
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/70",
            )}
          >
            <KindBadge kind={log.kind} />
            <span>{log.label}</span>
            <span className="text-white/25">{formatBytes(log.bytes)}</span>
          </button>
        ))}
      </div>

      {/* Pagination bar */}
      <div className="bg-[#0a0a0a] px-4 py-1.5 flex items-center justify-between border-b border-white/5">
        <span className="text-[9px] uppercase tracking-[0.14em] text-white/30">
          {chunk
            ? `Lines ${(chunk.startLine + 1).toLocaleString()}–${(chunk.endLine + 1).toLocaleString()} of ${chunk.totalLines.toLocaleString()}`
            : "—"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setStartLine(0)}
            disabled={!chunk?.hasMoreBefore}
            className="px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-default"
          >
            Top
          </button>
          <button
            type="button"
            disabled={!chunk?.hasMoreBefore}
            onClick={() => setStartLine(Math.max(0, startLine - PAGE_SIZE))}
            className="px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-default"
          >
            ↑ Prev
          </button>
          <button
            type="button"
            disabled={!chunk?.hasMoreAfter}
            onClick={() => setStartLine(startLine + PAGE_SIZE)}
            className="px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-default"
          >
            Next ↓
          </button>
          <button
            type="button"
            disabled={!chunk || chunk.totalLines <= PAGE_SIZE}
            onClick={() => {
              if (!chunk) return;
              setStartLine(Math.max(0, chunk.totalLines - PAGE_SIZE));
            }}
            className="px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-default"
          >
            Bottom
          </button>
        </div>
      </div>

      {/* Log content */}
      <div className="relative bg-[#0d0d0d]">
        {loading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#FF10F0]">
              Loading...
            </span>
          </div>
        )}
        {error ? (
          <div className="p-6 text-[11px] text-red-400">{error}</div>
        ) : (
          <pre
            ref={scrollRef}
            className="m-0 max-h-[36rem] overflow-auto p-0"
          >
            <code className="text-[12px] leading-[1.65] block">
              {lines.map((line, i) => {
                const lineNum = (chunk?.startLine ?? 0) + i + 1;
                return (
                  <div
                    key={`${startLine}-${i}`}
                    className="flex hover:bg-white/[0.03] group"
                  >
                    <span
                      className="select-none text-white/15 text-right pr-4 pl-4 group-hover:text-white/25 shrink-0 border-r border-white/5"
                      style={{ width: `${Math.max(lineNumWidth, 4) + 3}ch` }}
                    >
                      {lineNum}
                    </span>
                    <span className="text-white/75 pl-4 pr-4 whitespace-pre-wrap break-all min-w-0 flex-1">
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
