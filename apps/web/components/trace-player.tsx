"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@workspace/ui/lib/utils";

export interface TraceEvent {
  id: string;
  kind: string;
  role?: string;
  name?: string;
  model?: string;
  timestamp?: string;
  content?: string;
  input?: unknown;
  isError?: boolean;
  toolName?: string;
  toolUseId?: string;
  [key: string]: unknown;
}

interface TracePlayerProps {
  scenario: string;
  runId: string;
  label?: string;
  compact?: boolean;
  externalPosition?: number | null;
  onPositionChange?: (position: number, total: number) => void;
  externalPlaying?: boolean;
  externalSpeed?: number;
}

type PlaybackSpeed = 1 | 2 | 4 | 8 | 16;
const SPEEDS: PlaybackSpeed[] = [1, 2, 4, 8, 16];
const BASE_INTERVAL_MS = 400;

const KIND_CONFIG: Record<
  string,
  { label: string; color: string; border: string; bg: string; icon: string }
> = {
  system_message: {
    label: "SYSTEM",
    color: "text-zinc-300",
    border: "border-l-zinc-500",
    bg: "bg-zinc-500/10",
    icon: "⚙",
  },
  thinking: {
    label: "THINKING",
    color: "text-amber-300",
    border: "border-l-amber-400",
    bg: "bg-amber-400/8",
    icon: "💭",
  },
  tool_use: {
    label: "TOOL",
    color: "text-blue-300",
    border: "border-l-blue-500",
    bg: "bg-blue-500/8",
    icon: "⚡",
  },
  tool_result: {
    label: "RESULT",
    color: "text-emerald-300",
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/8",
    icon: "↩",
  },
  assistant_text: {
    label: "REPLY",
    color: "text-[#FF10F0]",
    border: "border-l-[#FF10F0]",
    bg: "bg-[#FF10F0]/8",
    icon: "▸",
  },
  assistant_final: {
    label: "FINAL",
    color: "text-[#FF10F0]",
    border: "border-l-[#FF10F0]",
    bg: "bg-[#FF10F0]/10",
    icon: "◆",
  },
  user_message: {
    label: "USER",
    color: "text-white/70",
    border: "border-l-white/40",
    bg: "bg-white/5",
    icon: "→",
  },
  summary: {
    label: "SUMMARY",
    color: "text-white/50",
    border: "border-l-white/20",
    bg: "bg-white/3",
    icon: "∎",
  },
};

const DEFAULT_KIND = {
  label: "EVENT",
  color: "text-white/50",
  border: "border-l-white/20",
  bg: "bg-white/3",
  icon: "·",
};

function truncate(value: unknown, max = 300): string {
  if (typeof value === "string") {
    return value.length > max ? `${value.slice(0, max)}...` : value;
  }
  if (value === null || value === undefined) return "";
  try {
    const json = JSON.stringify(value);
    return json.length > max ? `${json.slice(0, max)}...` : json;
  } catch {
    return String(value);
  }
}

function EventCard({
  event,
  index,
  isLatest,
}: {
  event: TraceEvent;
  index: number;
  isLatest: boolean;
}) {
  const config = KIND_CONFIG[event.kind] ?? DEFAULT_KIND;

  return (
    <div
      className={cn(
        "border-l-[4px] px-3 py-2 transition-colors duration-150",
        config.border,
        isLatest ? config.bg : "hover:bg-white/3",
        isLatest && "ring-1 ring-inset ring-white/10",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono text-white/20 w-6 text-right shrink-0">
          {index + 1}
        </span>
        <span className="text-sm shrink-0">{config.icon}</span>
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-[0.14em]",
            config.color,
          )}
        >
          {config.label}
        </span>
        {event.name && (
          <span className="text-xs font-mono text-white/60">{event.name}</span>
        )}
        {event.toolName && !event.name && (
          <span className="text-xs font-mono text-white/40">
            {event.toolName}
          </span>
        )}
        {event.isError && (
          <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
            Error
          </span>
        )}
      </div>
      <div className="pl-8">
        <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap break-words font-mono">
          {truncate(event.content ?? event.input ?? "")}
        </p>
      </div>
    </div>
  );
}

export function TracePlayer({
  scenario,
  runId,
  label,
  compact = false,
  externalPosition = null,
  onPositionChange,
  externalPlaying,
  externalSpeed,
}: TracePlayerProps) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(2);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestRef = useRef<HTMLDivElement>(null);

  const effectivePlaying = externalPlaying ?? playing;
  const effectiveSpeed = (externalSpeed ?? speed) as PlaybackSpeed;
  const isSynced = externalPosition !== null;

  const posRef = useRef(position);
  posRef.current = position;
  const evtLenRef = useRef(events.length);
  evtLenRef.current = events.length;

  useEffect(() => {
    onPositionChange?.(position, events.length);
  }, [position, events.length, onPositionChange]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/audits/${encodeURIComponent(scenario)}/${encodeURIComponent(runId)}/trace`,
        );
        if (!response.ok) throw new Error("Failed to load trace");
        const data = await response.json();
        if (!cancelled) {
          setEvents(data.events ?? []);
          setPosition(0);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [scenario, runId]);

  useEffect(() => {
    if (externalPosition !== null && externalPosition !== posRef.current) {
      setPosition(Math.min(externalPosition, evtLenRef.current));
    }
  }, [externalPosition]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isSynced) return;
    if (effectivePlaying && position < events.length && !loading) {
      const interval = Math.max(30, BASE_INTERVAL_MS / effectiveSpeed);
      timerRef.current = setInterval(() => {
        setPosition((prev) => {
          if (prev >= evtLenRef.current) {
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
  }, [effectivePlaying, effectiveSpeed, position, events.length, loading, isSynced]);

  useEffect(() => {
    if (!effectivePlaying || !latestRef.current) return;
    latestRef.current.scrollIntoView({
      block: "end",
      behavior: effectiveSpeed > 2 ? "instant" : "smooth",
    });
  }, [position, effectivePlaying, effectiveSpeed]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPosition(Number.parseInt(e.target.value, 10));
    },
    [],
  );

  const togglePlay = useCallback(() => {
    if (posRef.current >= evtLenRef.current) setPosition(0);
    setPlaying((prev) => !prev);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => SPEEDS[(SPEEDS.indexOf(prev) + 1) % SPEEDS.length]!);
  }, []);

  const jumpToStart = useCallback(() => {
    setPosition(0);
    setPlaying(false);
  }, []);
  const jumpToEnd = useCallback(() => {
    setPosition(evtLenRef.current);
    setPlaying(false);
  }, []);

  const progress = events.length > 0 ? position / events.length : 0;
  const visibleEvents = useMemo(
    () => events.slice(0, position),
    [events, position],
  );

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const evt of visibleEvents) {
      counts[evt.kind] = (counts[evt.kind] ?? 0) + 1;
    }
    return counts;
  }, [visibleEvents]);

  if (error) {
    return (
      <div className="border-[3px] border-black bg-[#0d0d0d] p-6">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="border-[3px] border-black overflow-hidden flex flex-col">
      {/* Chrome */}
      <div className="bg-black px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex gap-1 shrink-0">
            <div className="w-2.5 h-2.5 bg-[#FF10F0]" />
            <div className="w-2.5 h-2.5 bg-white/20" />
            <div className="w-2.5 h-2.5 bg-white/10" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white truncate">
            {label || runId}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {loading && (
            <span className="text-xs uppercase tracking-[0.14em] text-[#FF10F0] animate-pulse">
              Loading...
            </span>
          )}
          <span className="text-xs uppercase tracking-[0.1em] text-white/30 tabular-nums">
            {position}/{events.length}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 bg-black/80 relative shrink-0">
        <div
          className="h-full bg-[#FF10F0] transition-all duration-100 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Kind counts ticker */}
      <div className="bg-[#111] px-3 py-1 flex items-center gap-3 border-b border-white/5 shrink-0 overflow-x-auto">
        {Object.entries(kindCounts).map(([kind, count]) => {
          const config = KIND_CONFIG[kind] ?? DEFAULT_KIND;
          return (
            <span
              key={kind}
              className={cn(
                "text-xs uppercase tracking-[0.1em] tabular-nums whitespace-nowrap",
                config.color,
              )}
            >
              {config.icon} {count}
            </span>
          );
        })}
        {Object.keys(kindCounts).length === 0 && (
          <span className="text-xs text-white/20">No events yet</span>
        )}
      </div>

      {/* Controls (standalone only) */}
      {!isSynced && (
        <div className="bg-[#0a0a0a] px-3 py-1.5 flex items-center justify-between gap-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={jumpToStart}
              className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors"
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
                "w-8 h-8 flex items-center justify-center border-2 transition-colors",
                effectivePlaying
                  ? "border-[#FF10F0] bg-[#FF10F0] text-black"
                  : "border-white/30 text-white/60 hover:border-white hover:text-white",
              )}
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
            max={events.length}
            value={position}
            onChange={handleSeek}
            className="flex-1 h-1 appearance-none bg-white/10 cursor-pointer accent-[#FF10F0] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#FF10F0] [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>
      )}

      {/* Event stream */}
      <div
        ref={scrollRef}
        className={cn(
          "overflow-auto bg-[#0d0d0d] flex-1",
          compact ? "max-h-[32rem]" : "max-h-[40rem]",
        )}
      >
        {visibleEvents.map((event, i) => (
          <div
            key={event.id}
            ref={i === visibleEvents.length - 1 ? latestRef : undefined}
          >
            <EventCard
              event={event}
              index={i}
              isLatest={i === visibleEvents.length - 1 && effectivePlaying}
            />
          </div>
        ))}
        {position === 0 && !loading && events.length > 0 && (
          <div className="flex items-center justify-center py-12">
            <span className="text-xs uppercase tracking-[0.16em] text-white/20">
              Press play to start trace playback
            </span>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-xs uppercase tracking-[0.16em] text-[#FF10F0] animate-pulse">
              Loading trace data...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
