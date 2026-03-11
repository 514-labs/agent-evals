"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ChevronDown, Clock3, X, XIcon } from "lucide-react"
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"

type GateName = "functional" | "correct" | "robust" | "performant" | "production"

type GateResult = {
  passed: boolean
  score: number
  core: Record<string, boolean>
  scenario: Record<string, boolean>
}

type AssertionLog = {
  passed: boolean
  durationMs: number
  message?: string
  error?: string
  details?: Record<string, unknown>
}

type AssertionLogMap = Record<string, AssertionLog>

type AssertionLogOutput = Record<
  GateName,
  {
    core: AssertionLogMap
    scenario: AssertionLogMap
  }
>

const GATE_ORDER: GateName[] = ["functional", "correct", "robust", "performant", "production"]
const GATE_LABELS: Record<string, { label: string; number: string }> = {
  functional: { label: "Functional", number: "01" },
  correct: { label: "Correct", number: "02" },
  robust: { label: "Robust", number: "03" },
  performant: { label: "Performant", number: "04" },
  production: { label: "Production", number: "05" },
}

interface SelectedAssertion {
  name: string
  gate: GateName
  type: "core" | "scenario"
  passed: boolean
}

interface HighlightedSources {
  scenario: Partial<Record<GateName, string>>
  core: Partial<Record<string, string>>
}

interface AuditRubricPanelProps {
  gates: Record<GateName, GateResult>
  passedAssertions: number
  totalAssertions: number
  highlightedSources: HighlightedSources
  assertionLogs: AssertionLogOutput | null
}

function formatDuration(ms: number): string {
  if (ms < 1) return "<1ms"
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map(String).join(", ")
  return JSON.stringify(value)
}

function formatDetailKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

function DetailValueCell({ value }: { value: unknown }) {
  if (typeof value === "boolean") {
    return (
      <span className={cn("font-mono text-xs", value ? "text-emerald-400" : "text-red-400")}>
        {value ? "true" : "false"}
      </span>
    )
  }
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, i) => (
          <span key={i} className="font-mono text-xs bg-white/8 px-1.5 py-0.5 text-white/80">
            {String(item)}
          </span>
        ))}
      </div>
    )
  }
  if (typeof value === "object" && value !== null) {
    return (
      <pre className="font-mono text-xs text-white/70 whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }
  return <span className="font-mono text-xs text-white/80">{formatDetailValue(value)}</span>
}

export function AuditRubricPanel({
  gates,
  passedAssertions,
  totalAssertions,
  highlightedSources,
  assertionLogs,
}: AuditRubricPanelProps) {
  const [selected, setSelected] = useState<SelectedAssertion | null>(null)
  const [sourceOpen, setSourceOpen] = useState(false)

  useEffect(() => {
    setSourceOpen(false)
  }, [selected])

  const handleAssertionClick = useCallback((assertion: SelectedAssertion) => {
    setSelected(assertion)
  }, [])

  const getHighlightedHtml = useCallback(
    (assertion: SelectedAssertion): string | null => {
      if (assertion.type === "core") {
        return highlightedSources.core[assertion.name] ?? null
      }
      return highlightedSources.scenario[assertion.gate] ?? null
    },
    [highlightedSources],
  )

  const selectedHtml = selected ? getHighlightedHtml(selected) : null
  const gateLabel = selected ? GATE_LABELS[selected.gate] : null
  const sourceFilename = selected
    ? selected.type === "scenario"
      ? `assertions/${selected.gate}.ts`
      : "eval-core/runner.ts"
    : null
  const selectedLog = selected
    ? selected.type === "core"
      ? assertionLogs?.[selected.gate]?.core?.[selected.name] ?? null
      : assertionLogs?.[selected.gate]?.scenario?.[selected.name] ?? null
    : null

  const detailEntries = selectedLog?.details ? Object.entries(selectedLog.details) : []

  return (
    <>
      <div className="border-[3px] border-black">
        <div className="bg-black px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-white">
            Rubric
          </span>
          <span className="text-xs uppercase tracking-[0.14em] text-[#FF10F0]">
            {passedAssertions}/{totalAssertions}
          </span>
        </div>
        <div className="divide-y divide-black/10">
          {GATE_ORDER.map((gate) => {
            const detail = gates[gate]
            const meta = GATE_LABELS[gate]!
            if (!detail) return null

            const allAssertions = [
              ...Object.entries(detail.core).map(([name, passed]) => ({
                name,
                passed,
                type: "core" as const,
              })),
              ...Object.entries(detail.scenario).map(([name, passed]) => ({
                name,
                passed,
                type: "scenario" as const,
              })),
            ]

            return (
              <div key={gate}>
                <div
                  className={`px-3 py-1.5 flex items-center justify-between ${
                    detail.passed ? "bg-[#FF10F0]/10" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-display)] text-base">
                      {meta.number}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.14em]">
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-black/45">
                      {(detail.score * 100).toFixed(0)}%
                    </span>
                    <span
                      className={`text-xs font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border-2 ${
                        detail.passed
                          ? "border-black bg-[#FF10F0] text-black"
                          : "border-black/20 text-black/40"
                      }`}
                    >
                      {detail.passed ? "Pass" : "Fail"}
                    </span>
                  </div>
                </div>
                {allAssertions.length > 0 && (
                  <div className="px-3 py-1.5">
                    {allAssertions.map((assertion) => {
                      const log =
                        assertion.type === "core"
                          ? assertionLogs?.[gate]?.core?.[assertion.name]
                          : assertionLogs?.[gate]?.scenario?.[assertion.name]

                      return (
                        <button
                          key={`${gate}-${assertion.type}-${assertion.name}`}
                          type="button"
                          onClick={() =>
                            handleAssertionClick({
                              name: assertion.name,
                              gate,
                              type: assertion.type,
                              passed: assertion.passed,
                            })
                          }
                          className="flex items-center justify-between py-1 w-full text-left transition-colors cursor-pointer hover:bg-black/4 -mx-1.5 px-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-xs uppercase tracking-[0.1em] px-1 shrink-0 ${
                                assertion.type === "core"
                                  ? "bg-black/8 text-black/45"
                                  : "bg-black/4 text-black/35"
                              }`}
                            >
                              {assertion.type}
                            </span>
                            <span className="text-xs truncate text-black/65">
                              {assertion.name.replace(/_/g, " ")}
                            </span>
                            {log?.durationMs != null && log.durationMs > 0 && (
                              <span className="text-[10px] text-black/25 tabular-nums shrink-0">
                                {formatDuration(log.durationMs)}
                              </span>
                            )}
                          </div>
                          {assertion.passed ? (
                            <Check size={14} strokeWidth={3} className="shrink-0 text-[#FF10F0]" />
                          ) : (
                            <X size={14} strokeWidth={3} className="shrink-0 text-black/20" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="data-[side=right]:w-[min(56rem,90vw)] data-[side=right]:sm:max-w-none p-0 gap-0 overflow-hidden flex flex-col border-l-[3px] border-black"
        >
          <SheetHeader className="p-0 gap-0 shrink-0">
            <div className="bg-black px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-1 shrink-0">
                <div className="w-2 h-2 bg-[#FF10F0]" />
                <div className="w-2 h-2 bg-white/20" />
                <div className="w-2 h-2 bg-white/10" />
              </div>

              <SheetTitle className="text-white text-xs font-bold uppercase tracking-[0.2em] truncate min-w-0">
                {selected?.name.replace(/_/g, " ")}
              </SheetTitle>

              <span
                className={`text-xs font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border-2 shrink-0 ${
                  selected?.passed
                    ? "border-white/30 bg-[#FF10F0] text-black"
                    : "border-white/20 text-white/40"
                }`}
              >
                {selected?.passed ? "Pass" : "Fail"}
              </span>

              <div className="flex items-center gap-2 ml-auto shrink-0">
                <span className="font-[family-name:var(--font-display)] text-sm text-white/60">
                  {gateLabel?.number}
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">
                  {gateLabel?.label}
                </span>
                <span
                  className={`text-xs uppercase tracking-[0.1em] px-1 ${
                    selected?.type === "core"
                      ? "bg-white/15 text-white/50"
                      : "bg-white/8 text-white/40"
                  }`}
                >
                  {selected?.type}
                </span>
                <SheetClose className="text-white/40 hover:text-white transition-colors ml-2">
                  <XIcon size={16} />
                  <span className="sr-only">Close</span>
                </SheetClose>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-auto bg-[#0d0d0d]">
            {/* Verdict block */}
            {selectedLog ? (
              <div className="border-b border-white/8">
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={cn(
                        "w-8 h-8 flex items-center justify-center shrink-0",
                        selectedLog.passed ? "bg-[#FF10F0]" : "bg-red-500/80",
                      )}
                    >
                      {selectedLog.passed ? (
                        <Check size={18} strokeWidth={3} className="text-black" />
                      ) : (
                        <X size={18} strokeWidth={3} className="text-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white/90 leading-snug">
                        {selectedLog.message ?? "No message provided."}
                      </p>
                      {selectedLog.durationMs > 0 && (
                        <p className="text-xs text-white/35 mt-0.5 flex items-center gap-1">
                          <Clock3 size={10} />
                          {formatDuration(selectedLog.durationMs)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error block */}
                {selectedLog.error && (
                  <div className="px-5 pb-4">
                    <div className="border border-red-500/40 bg-red-950/30">
                      <div className="px-3 py-1.5 border-b border-red-500/20">
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-red-300/80">
                          Error
                        </span>
                      </div>
                      <pre className="px-3 py-2.5 text-xs text-red-200/80 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                        {selectedLog.error}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Evidence table */}
                {detailEntries.length > 0 && (
                  <div className="px-5 pb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/30 mb-2">
                      Evidence
                    </p>
                    <div className="border border-white/10">
                      {detailEntries.map(([key, value], i) => (
                        <div
                          key={key}
                          className={cn(
                            "grid grid-cols-[minmax(8rem,auto)_1fr] items-baseline",
                            i < detailEntries.length - 1 && "border-b border-white/6",
                          )}
                        >
                          <div className="px-3 py-2 bg-white/3 text-xs font-bold uppercase tracking-[0.1em] text-white/45 self-stretch flex items-center">
                            {formatDetailKey(key)}
                          </div>
                          <div className="px-3 py-2">
                            <DetailValueCell value={value} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-8 border-b border-white/8">
                <p className="text-xs uppercase tracking-[0.14em] text-white/30">
                  No assertion log available. Re-run the eval to generate logs.
                </p>
              </div>
            )}

            {/* Source code — collapsible */}
            {selectedHtml && (
              <div className="border-t border-white/8">
                <button
                  type="button"
                  onClick={() => setSourceOpen(!sourceOpen)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/3 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/30">
                      Source
                    </span>
                    <span className="text-xs font-mono text-white/20">
                      {sourceFilename}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-white/30 transition-transform",
                      sourceOpen && "rotate-180",
                    )}
                  />
                </button>
                {sourceOpen && (
                  <div className="dec-code-dark border-t border-white/6">
                    <CodeBlock keepBackground data-line-numbers>
                      <Pre>
                        <div dangerouslySetInnerHTML={{ __html: selectedHtml }} />
                      </Pre>
                    </CodeBlock>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
