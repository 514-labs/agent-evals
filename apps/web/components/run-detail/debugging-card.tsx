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
  stdout: "bg-accent/15 text-accent",
  trace: "bg-blue-600/10 text-blue-700",
  stderr: "bg-red-600/10 text-red-700",
  service: "bg-foreground/8 text-foreground/60",
  system: "bg-foreground/5 text-foreground/50",
};

function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      className={cn(
        "text-[8px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5",
        KIND_STYLES[kind] ?? "bg-foreground/5 text-foreground/50",
      )}
    >
      {kind}
    </span>
  );
}

interface DebuggingCardProps {
  scenario: string;
  runId: string;
  logs: LogRef[];
}

export function DebuggingCard({ scenario, runId, logs }: DebuggingCardProps) {
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
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLPreElement>(null);

  const activeLog = useMemo(
    () => logs.find((entry) => entry.id === activeLogId) ?? logs[0] ?? null,
    [activeLogId, logs],
  );

  useEffect(() => {
    if (!activeLog && logs.length > 0) setActiveLogId(logs[0]!.id);
  }, [activeLog, logs]);

  useEffect(() => { setStartLine(0); }, [activeLogId]);

  useEffect(() => {
    if (!isOpen || !activeLog) { setChunk(null); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/audits/${encodeURIComponent(scenario)}/${encodeURIComponent(runId)}/logs/${encodeURIComponent(activeLog.id)}?start=${startLine}&limit=${PAGE_SIZE}`,
        );
        if (!response.ok) throw new Error(`Failed to load ${activeLog.label}`);
        const data = (await response.json()) as ChunkResponse;
        if (!cancelled) {
          setChunk(data);
          scrollRef.current?.scrollTo(0, 0);
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
    return () => { cancelled = true; };
  }, [activeLog, runId, scenario, startLine, isOpen]);

  const totalBytes = logs.reduce((sum, log) => sum + log.bytes, 0);

  if (logs.length === 0) {
    return (
      <div className="border border-border px-4 py-6">
        <p className="text-xs text-muted-foreground">No logs attached for this run.</p>
      </div>
    );
  }

  const lines = chunk?.content.split("\n") ?? [];
  const lineNumWidth = String((chunk?.endLine ?? 0) + 1).length;

  return (
    <div className="border border-border overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Debugging output
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground/60">
            {logs.length} {logs.length === 1 ? "file" : "files"} · {formatBytes(totalBytes)}
          </span>
        </div>
        <span className={cn(
          "text-lg leading-none text-muted-foreground transition-transform",
          isOpen && "rotate-45",
        )}>
          +
        </span>
      </button>

      {isOpen && (
        <>
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 border-t border-border overflow-x-auto bg-secondary/30">
            {logs.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => setActiveLogId(log.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-[0.08em] transition-colors whitespace-nowrap font-[family-name:var(--font-mono)]",
                  log.id === activeLog?.id
                    ? "bg-card text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <KindBadge kind={log.kind} />
                <span>{log.label}</span>
                <span className="text-muted-foreground/40">{formatBytes(log.bytes)}</span>
              </button>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-1 border-t border-border bg-secondary/20">
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground/50">
              {chunk
                ? `${(chunk.startLine + 1).toLocaleString()}–${(chunk.endLine + 1).toLocaleString()} of ${chunk.totalLines.toLocaleString()}`
                : "—"}
            </span>
            <div className="flex items-center gap-0.5">
              {[
                { label: "Top", disabled: !chunk?.hasMoreBefore, action: () => setStartLine(0) },
                { label: "End", disabled: !chunk || chunk.totalLines <= PAGE_SIZE, action: () => chunk && setStartLine(Math.max(0, chunk.totalLines - PAGE_SIZE)) },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  disabled={btn.disabled}
                  onClick={btn.action}
                  className="px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-default"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Code viewer */}
          <div className="relative bg-[#0d0d0d] h-56 border-t border-border">
            {loading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                <span className="text-xs uppercase tracking-[0.2em] text-accent">Loading…</span>
              </div>
            )}
            {error ? (
              <div className="p-4 text-xs text-red-400">{error}</div>
            ) : (
              <pre ref={scrollRef} className="m-0 h-full overflow-auto p-0">
                <code className="text-xs leading-[1.6] block">
                  {lines.map((line, i) => {
                    const lineNum = (chunk?.startLine ?? 0) + i + 1;
                    return (
                      <div key={`${startLine}-${i}`} className="flex hover:bg-white/3 group">
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
        </>
      )}
    </div>
  );
}
