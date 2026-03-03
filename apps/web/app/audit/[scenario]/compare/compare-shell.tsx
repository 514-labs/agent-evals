"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@workspace/ui/lib/utils";

import { AuditRunPlayer } from "@/components/audit-run-player";

type PlaybackSpeed = 1 | 2 | 4 | 8 | 16;

const SPEEDS: PlaybackSpeed[] = [1, 2, 4, 8, 16];
const BASE_INTERVAL_MS = 60;

type RunOption = {
  runId: string;
  harness: string;
  agent: string;
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
  runs: RunOption[];
}

export function CompareShell({
  scenario,
  leftRunId,
  rightRunId,
  leftLogId,
  rightLogId,
  leftLabel,
  rightLabel,
  runs,
}: CompareShellProps) {
  const router = useRouter();
  const [synced, setSynced] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(2);
  const [position, setPosition] = useState(0);
  const [maxLines, setMaxLines] = useState(0);
  const [selectingSide, setSelectingSide] = useState<"left" | "right" | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePositionChange = useCallback(
    (pos: number, total: number) => {
      if (synced) {
        setPosition(pos);
        if (total > maxLines) setMaxLines(total);
      }
    },
    [synced, maxLines],
  );

  useEffect(() => {
    if (!synced) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (playing && position < maxLines) {
      const interval = Math.max(10, BASE_INTERVAL_MS / speed);
      timerRef.current = setInterval(() => {
        setPosition((prev) => {
          if (prev >= maxLines) {
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
  }, [synced, playing, speed, position, maxLines]);

  const togglePlay = useCallback(() => {
    if (position >= maxLines && maxLines > 0) {
      setPosition(0);
    }
    setPlaying((p) => !p);
  }, [position, maxLines]);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEEDS.indexOf(prev);
      return SPEEDS[(idx + 1) % SPEEDS.length]!;
    });
  }, []);

  const jumpToStart = useCallback(() => {
    setPosition(0);
    setPlaying(false);
  }, []);

  const jumpToEnd = useCallback(() => {
    setPosition(maxLines);
    setPlaying(false);
  }, [maxLines]);

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
      setSelectingSide(null);
    },
    [scenario, leftRunId, rightRunId, router],
  );

  const progress = maxLines > 0 ? position / maxLines : 0;

  return (
    <div>
      {/* Sync controls */}
      <div className="border-[3px] border-black mb-4">
        <div className="bg-black px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
              Playback
            </span>
            <button
              type="button"
              onClick={() => setSynced((s) => !s)}
              className={cn(
                "text-[9px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 border transition-colors",
                synced
                  ? "border-[#FF10F0] bg-[#FF10F0] text-black"
                  : "border-white/30 text-white/50 hover:text-white",
              )}
            >
              {synced ? "Synced" : "Independent"}
            </button>
          </div>
          <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.12em] text-white/30">
            <button
              type="button"
              onClick={() =>
                setSelectingSide((s) => (s === "left" ? null : "left"))
              }
              className="text-white/50 hover:text-white transition-colors"
            >
              Swap Left
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectingSide((s) => (s === "right" ? null : "right"))
              }
              className="text-white/50 hover:text-white transition-colors"
            >
              Swap Right
            </button>
          </div>
        </div>

        {/* Run selector dropdown */}
        {selectingSide && (
          <div className="bg-[#111] border-t border-white/5 px-3 py-2">
            <p className="text-[8px] uppercase tracking-[0.14em] text-white/30 mb-2">
              Select {selectingSide} run:
            </p>
            <div className="flex flex-wrap gap-2">
              {runs.map((run) => {
                const isActive =
                  (selectingSide === "left" && run.runId === leftRunId) ||
                  (selectingSide === "right" && run.runId === rightRunId);
                return (
                  <button
                    key={run.runId}
                    type="button"
                    onClick={() => switchRun(selectingSide, run.runId)}
                    disabled={isActive}
                    className={cn(
                      "px-2.5 py-1.5 text-[9px] uppercase tracking-[0.1em] border transition-colors",
                      isActive
                        ? "border-[#FF10F0] bg-[#FF10F0] text-black"
                        : "border-white/20 text-white/50 hover:border-white hover:text-white",
                    )}
                  >
                    {run.harness} · {run.agent} · G{run.highestGate}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Synced playback controls */}
        {synced && (
          <div className="bg-[#0d0d0d] px-4 py-2 flex items-center gap-3 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={jumpToStart}
                className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                >
                  <rect x="0" y="1" width="2" height="8" />
                  <polygon points="10,1 10,9 3,5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className={cn(
                  "w-8 h-8 flex items-center justify-center border-[2px] transition-colors",
                  playing
                    ? "border-[#FF10F0] bg-[#FF10F0] text-black"
                    : "border-white/30 text-white/60 hover:border-white hover:text-white",
                )}
              >
                {playing ? (
                  <svg
                    width="8"
                    height="10"
                    viewBox="0 0 8 10"
                    fill="currentColor"
                  >
                    <rect x="0" y="0" width="3" height="10" />
                    <rect x="5" y="0" width="3" height="10" />
                  </svg>
                ) : (
                  <svg
                    width="8"
                    height="10"
                    viewBox="0 0 8 10"
                    fill="currentColor"
                  >
                    <polygon points="0,0 8,5 0,10" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={jumpToEnd}
                className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                >
                  <polygon points="0,1 0,9 7,5" />
                  <rect x="8" y="1" width="2" height="8" />
                </svg>
              </button>
              <button
                type="button"
                onClick={cycleSpeed}
                className="ml-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
              >
                {speed}x
              </button>
            </div>

            <input
              type="range"
              min={0}
              max={maxLines}
              value={position}
              onChange={handleSeek}
              className="flex-1 h-1 appearance-none bg-white/10 cursor-pointer accent-[#FF10F0] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#FF10F0] [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:cursor-pointer"
            />

            <span className="text-[9px] uppercase tracking-[0.1em] text-white/30 tabular-nums shrink-0">
              {position}/{maxLines}
            </span>
          </div>
        )}

        {/* Sync progress bar */}
        {synced && (
          <div className="h-[3px] bg-black relative">
            <div
              className="h-full bg-[#FF10F0] transition-all duration-75 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Split-screen players */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AuditRunPlayer
          scenario={scenario}
          runId={leftRunId}
          logId={leftLogId}
          label={leftLabel}
          compact
          externalPosition={synced ? position : null}
          externalPlaying={synced ? playing : undefined}
          externalSpeed={synced ? speed : undefined}
          onPositionChange={handlePositionChange}
        />
        <AuditRunPlayer
          scenario={scenario}
          runId={rightRunId}
          logId={rightLogId}
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
