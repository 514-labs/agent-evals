"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@workspace/ui/lib/utils";

type LogLine = {
  num: number;
  text: string;
};

type ChunkResponse = {
  content: string;
  totalLines: number;
  startLine: number;
  endLine: number;
};

type PlaybackSpeed = 1 | 2 | 4 | 8 | 16;

const SPEEDS: PlaybackSpeed[] = [1, 2, 4, 8, 16];
const BASE_INTERVAL_MS = 60;
const FULL_LOG_LIMIT = 50000;

interface AuditRunPlayerProps {
  scenario: string;
  runId: string;
  logId: string;
  label?: string;
  compact?: boolean;
  externalPosition?: number | null;
  onPositionChange?: (position: number, total: number) => void;
  externalPlaying?: boolean;
  externalSpeed?: PlaybackSpeed;
}

export function AuditRunPlayer({
  scenario,
  runId,
  logId,
  label,
  compact = false,
  externalPosition = null,
  onPositionChange,
  externalPlaying,
  externalSpeed,
}: AuditRunPlayerProps) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(2);
  const scrollRef = useRef<HTMLPreElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectivePlaying = externalPlaying ?? playing;
  const effectiveSpeed = externalSpeed ?? speed;
  const isSynced = externalPosition !== null;

  // Notify parent of position changes *after* render, not during
  const positionRef = useRef(position);
  positionRef.current = position;
  const linesLenRef = useRef(lines.length);
  linesLenRef.current = lines.length;

  useEffect(() => {
    onPositionChange?.(position, lines.length);
  }, [position, lines.length, onPositionChange]);

  // Load log data
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/audits/${encodeURIComponent(scenario)}/${encodeURIComponent(runId)}/logs/${encodeURIComponent(logId)}?start=0&limit=${FULL_LOG_LIMIT}`,
        );
        if (!response.ok) throw new Error("Failed to load log");
        const data = (await response.json()) as ChunkResponse;
        if (!cancelled) {
          const parsed = data.content.split("\n").map((text, i) => ({
            num: data.startLine + i + 1,
            text,
          }));
          setLines(parsed);
          setPosition(0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [scenario, runId, logId]);

  // Sync position from parent when externally controlled
  useEffect(() => {
    if (externalPosition !== null && externalPosition !== positionRef.current) {
      setPosition(Math.min(externalPosition, linesLenRef.current));
    }
  }, [externalPosition]);

  // Playback interval — only runs in standalone (non-synced) mode.
  // When synced, the parent drives position via externalPosition.
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isSynced) return;

    if (effectivePlaying && position < lines.length && !loading) {
      const interval = Math.max(10, BASE_INTERVAL_MS / effectiveSpeed);
      timerRef.current = setInterval(() => {
        setPosition((prev) => {
          if (prev >= linesLenRef.current) {
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
  }, [effectivePlaying, effectiveSpeed, position, lines.length, loading, isSynced]);

  // Auto-scroll during playback
  useEffect(() => {
    if (scrollRef.current && effectivePlaying) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [position, effectivePlaying]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPosition(Number.parseInt(e.target.value, 10));
    },
    [],
  );

  const togglePlay = useCallback(() => {
    if (positionRef.current >= linesLenRef.current) {
      setPosition(0);
    }
    setPlaying((prev) => !prev);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEEDS.indexOf(prev);
      return SPEEDS[(idx + 1) % SPEEDS.length]!;
    });
  }, []);

  const jumpToEnd = useCallback(() => {
    setPosition(linesLenRef.current);
    setPlaying(false);
  }, []);

  const jumpToStart = useCallback(() => {
    setPosition(0);
  }, []);

  const progress = lines.length > 0 ? position / lines.length : 0;
  const lineNumWidth = String(lines.length).length;
  const visibleLines = lines.slice(0, position);

  if (error) {
    return (
      <div className="border-[3px] border-black bg-[#0d0d0d] p-6">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="border-[3px] border-black overflow-hidden flex flex-col">
      {/* Chrome bar */}
      <div className="bg-black px-3 py-2 flex items-center justify-between gap-2 border-b-[3px] border-black shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-[8px] h-[8px] bg-[#FF10F0]" />
            <div className="w-[8px] h-[8px] bg-white/20" />
            <div className="w-[8px] h-[8px] bg-white/10" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white truncate">
            {label || `${runId}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading && (
            <span className="text-xs uppercase tracking-[0.14em] text-[#FF10F0] animate-pulse">
              Loading...
            </span>
          )}
          <span className="text-xs uppercase tracking-[0.1em] text-white/30">
            {position}/{lines.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] bg-black/80 relative shrink-0">
        <div
          className="h-full bg-[#FF10F0] transition-all duration-75 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Controls */}
      {!isSynced && (
        <div className="bg-[#111] px-3 py-1.5 flex items-center justify-between gap-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={jumpToStart}
              className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              aria-label="Jump to start"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect x="0" y="1" width="2" height="8" />
                <polygon points="10,1 10,9 3,5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={togglePlay}
              disabled={loading}
              className={cn(
                "w-7 h-7 flex items-center justify-center border-[2px] transition-colors",
                effectivePlaying
                  ? "border-[#FF10F0] bg-[#FF10F0] text-black"
                  : "border-white/30 text-white/60 hover:border-white hover:text-white",
              )}
              aria-label={effectivePlaying ? "Pause" : "Play"}
            >
              {effectivePlaying ? (
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
              className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              aria-label="Jump to end"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <polygon points="0,1 0,9 7,5" />
                <rect x="8" y="1" width="2" height="8" />
              </svg>
            </button>
            <button
              type="button"
              onClick={cycleSpeed}
              className="ml-1 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
            >
              {effectiveSpeed}x
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={lines.length}
            value={position}
            onChange={handleSeek}
            className="flex-1 h-1 appearance-none bg-white/10 cursor-pointer accent-[#FF10F0] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#FF10F0] [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>
      )}

      {/* Terminal output */}
      <pre
        ref={scrollRef}
        className={cn(
          "m-0 overflow-auto bg-[#0d0d0d] flex-1",
          compact ? "max-h-[28rem]" : "max-h-[36rem]",
        )}
      >
        <code className="text-sm leading-[1.6] block">
          {visibleLines.map((line, i) => (
            <div
              key={line.num}
              className={cn(
                "flex hover:bg-white/[0.03] group",
                i === visibleLines.length - 1 && effectivePlaying
                  ? "animate-[fadeIn_150ms_ease-out]"
                  : "",
              )}
            >
              <span
                className="select-none text-white/15 text-right pr-4 pl-3 group-hover:text-white/25 shrink-0 border-r border-white/5"
                style={{ width: `${Math.max(lineNumWidth, 4) + 2.5}ch` }}
              >
                {line.num}
              </span>
              <span className="text-white/75 pl-4 pr-4 whitespace-pre-wrap break-all min-w-0 flex-1">
                {line.text || "\u00A0"}
              </span>
            </div>
          ))}
          {position === 0 && !loading && lines.length > 0 && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs uppercase tracking-[0.16em] text-white/20">
                Press play to start
              </span>
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs uppercase tracking-[0.16em] text-[#FF10F0] animate-pulse">
                Loading log data...
              </span>
            </div>
          )}
        </code>
      </pre>
    </div>
  );
}
