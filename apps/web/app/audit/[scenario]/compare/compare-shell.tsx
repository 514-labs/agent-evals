"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@workspace/ui/lib/utils";

import { TracePlayer } from "@/components/trace-player";

type PlaybackSpeed = 1 | 2 | 4 | 8 | 16;

const SPEEDS: PlaybackSpeed[] = [1, 2, 4, 8, 16];
const BASE_INTERVAL_MS = 400;

type RunEntry = {
  runId: string;
  harness: string;
  agent: string;
  model: string;
  timestamp: string;
  highestGate: number;
  normalizedScore: number;
};

interface CompareShellProps {
  scenario: string;
  leftRunId: string;
  rightRunId: string;
  leftLogId: string;
  rightLogId: string;
  leftLabel: string;
  rightLabel: string;
  runs: RunEntry[];
}

function formatTimestamp(raw: string): string {
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return raw || "—";
  return new Date(parsed).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function GateDots({ highestGate }: { highestGate: number }) {
  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((g) => (
        <div
          key={g}
          className={cn(
            "w-2.5 h-2.5 border-[1.5px] border-black",
            g <= highestGate ? "bg-[#FF10F0]" : "bg-transparent",
          )}
        />
      ))}
    </div>
  );
}

function RunSelector({
  side,
  currentRunId,
  runs,
  onSelect,
}: {
  side: "left" | "right";
  currentRunId: string;
  runs: RunEntry[];
  onSelect: (runId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = runs.find((r) => r.runId === currentRunId) ?? runs[0];
  if (!current) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div className="border-[3px] border-black">
        <div className="bg-black px-3 py-1.5 flex items-center justify-between">
          <span className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.2em] text-white">
            {side}
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "text-xs font-bold uppercase tracking-[0.14em] px-2 py-0.5 border transition-colors",
              open
                ? "border-[#FF10F0] bg-[#FF10F0] text-black"
                : "border-white/30 text-white/50 hover:text-white hover:border-white",
            )}
          >
            {open ? "Close" : "Change"}
          </button>
        </div>
        <div className="px-3 py-2 flex items-center gap-3">
          <GateDots highestGate={current.highestGate} />
          <span className="font-[family-name:var(--font-display)] text-2xl">
            {Math.round(current.normalizedScore * 100)}%
          </span>
        </div>
        <div className="px-3 pb-2.5 flex items-center justify-between">
          <span className="text-xs text-black/60 truncate">
            {current.agent} · {current.model.replace("claude-", "").slice(0, 16)}
          </span>
          <span className="text-xs text-black/35 shrink-0 ml-2">
            {formatTimestamp(current.timestamp)}
          </span>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 border-[3px] border-black border-t-0 bg-white max-h-64 overflow-auto">
          {runs.map((run) => {
            const isActive = run.runId === currentRunId;
            return (
              <button
                key={run.runId}
                type="button"
                disabled={isActive}
                onClick={() => {
                  onSelect(run.runId);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 border-b border-black/10 last:border-b-0 transition-colors",
                  isActive
                    ? "bg-[#FF10F0] cursor-default"
                    : "hover:border-l-[4px] hover:border-l-[#FF10F0] hover:bg-black/3",
                )}
              >
                <div className="flex items-center gap-3 mb-1">
                  <GateDots highestGate={run.highestGate} />
                  <span className="font-[family-name:var(--font-display)] text-lg">
                    {Math.round(run.normalizedScore * 100)}%
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.1em]">
                    G{run.highestGate}/5
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-black/55 truncate">
                    {run.agent} · {run.model.replace("claude-", "").slice(0, 16)}
                  </span>
                  <span className="text-xs text-black/30 shrink-0">
                    {formatTimestamp(run.timestamp)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CompareShell({
  scenario,
  leftRunId,
  rightRunId,
  leftLogId: _leftLogId,
  rightLogId: _rightLogId,
  leftLabel,
  rightLabel,
  runs,
}: CompareShellProps) {
  const router = useRouter();
  const [synced, setSynced] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(2);
  const [position, setPosition] = useState(0);
  const [maxEvents, setMaxEvents] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePositionChange = useCallback(
    (pos: number, total: number) => {
      if (synced) {
        setPosition(pos);
        if (total > maxEvents) setMaxEvents(total);
      }
    },
    [synced, maxEvents],
  );

  useEffect(() => {
    if (!synced) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (playing && position < maxEvents) {
      const interval = Math.max(30, BASE_INTERVAL_MS / speed);
      timerRef.current = setInterval(() => {
        setPosition((prev) => {
          if (prev >= maxEvents) {
            if (timerRef.current) clearInterval(timerRef.current);
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [synced, playing, speed, position, maxEvents]);

  const togglePlay = useCallback(() => {
    if (position >= maxEvents && maxEvents > 0) {
      setPosition(0);
    }
    setPlaying((p) => !p);
  }, [position, maxEvents]);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => SPEEDS[(SPEEDS.indexOf(prev) + 1) % SPEEDS.length]!);
  }, []);

  const jumpToStart = useCallback(() => {
    setPosition(0);
    setPlaying(false);
  }, []);

  const jumpToEnd = useCallback(() => {
    setPosition(maxEvents);
    setPlaying(false);
  }, [maxEvents]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPosition(Number.parseInt(e.target.value, 10));
    },
    [],
  );

  const switchRun = useCallback(
    (side: "left" | "right", runId: string) => {
      const params = new URLSearchParams();
      if (side === "left") {
        params.set("left", runId);
        params.set("right", rightRunId);
      } else {
        params.set("left", leftRunId);
        params.set("right", runId);
      }
      router.push(`/audit/${scenario}/compare?${params.toString()}`);
    },
    [scenario, leftRunId, rightRunId, router],
  );

  const progress = maxEvents > 0 ? position / maxEvents : 0;

  return (
    <div>
      {/* Run selectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <RunSelector
          side="left"
          currentRunId={leftRunId}
          runs={runs}
          onSelect={(runId) => switchRun("left", runId)}
        />
        <RunSelector
          side="right"
          currentRunId={rightRunId}
          runs={runs}
          onSelect={(runId) => switchRun("right", runId)}
        />
      </div>

      {/* Playback controls */}
      <div className="border-[3px] border-black mb-4">
        <div className="bg-black px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white">
              Trace Playback
            </span>
            <button
              type="button"
              onClick={() => setSynced((s) => !s)}
              className={cn(
                "text-xs font-bold uppercase tracking-[0.14em] px-2.5 py-1 border transition-colors",
                synced
                  ? "border-[#FF10F0] bg-[#FF10F0] text-black"
                  : "border-white/30 text-white/50 hover:text-white",
              )}
            >
              {synced ? "Synced" : "Independent"}
            </button>
          </div>
        </div>

        {synced && (
          <div className="bg-[#0d0d0d] px-4 py-2 flex items-center gap-3 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={jumpToStart}
                className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <rect x="0" y="1" width="2" height="8" />
                  <polygon points="10,1 10,9 3,5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className={cn(
                  "w-9 h-9 flex items-center justify-center border-2 transition-colors",
                  playing
                    ? "border-[#FF10F0] bg-[#FF10F0] text-black"
                    : "border-white/30 text-white/60 hover:border-white hover:text-white",
                )}
              >
                {playing ? (
                  <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor">
                    <rect x="0" y="0" width="3" height="10" />
                    <rect x="5" y="0" width="3" height="10" />
                  </svg>
                ) : (
                  <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor">
                    <polygon points="0,0 8,5 0,10" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={jumpToEnd}
                className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <polygon points="0,1 0,9 7,5" />
                  <rect x="8" y="1" width="2" height="8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={cycleSpeed}
                className="ml-1 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.1em] text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
              >
                {speed}x
              </button>
            </div>

            <input
              type="range"
              min={0}
              max={maxEvents}
              value={position}
              onChange={handleSeek}
              className="flex-1 h-1 appearance-none bg-white/10 cursor-pointer accent-[#FF10F0] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#FF10F0] [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:cursor-pointer"
            />

            <span className="text-xs uppercase tracking-[0.1em] text-white/30 tabular-nums shrink-0">
              {position}/{maxEvents}
            </span>
          </div>
        )}

        {synced && (
          <div className="h-1 bg-black relative">
            <div
              className="h-full bg-[#FF10F0] transition-all duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Split-screen trace players */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TracePlayer
          scenario={scenario}
          runId={leftRunId}
          label={leftLabel}
          compact
          externalPosition={synced ? position : null}
          externalPlaying={synced ? playing : undefined}
          externalSpeed={synced ? speed : undefined}
          onPositionChange={handlePositionChange}
        />
        <TracePlayer
          scenario={scenario}
          runId={rightRunId}
          label={rightLabel}
          compact
          externalPosition={synced ? position : null}
          externalPlaying={synced ? playing : undefined}
          externalSpeed={synced ? speed : undefined}
          onPositionChange={handlePositionChange}
        />
      </div>
    </div>
  );
}
