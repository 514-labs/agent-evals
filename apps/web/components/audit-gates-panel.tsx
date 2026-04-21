"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ChevronDown, Clock3, Minus, X, XIcon } from "lucide-react"
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

type AssertionStatus = "passed" | "failed" | "not_run"

interface SelectedAssertion {
  name: string
  gate: GateName
  type: "core" | "scenario"
  status: AssertionStatus
}

interface HighlightedSources {
  scenario: Partial<Record<GateName, string>>
  core: Partial<Record<string, string>>
}

interface AssertionCatalog {
  core: Record<GateName, string[]>
  scenario: Record<GateName, string[]>
}

interface AuditGatesPanelProps {
  gates: Record<GateName, GateResult>
  passedAssertions: number
  totalAssertions: number
  highlightedSources: HighlightedSources
  assertionLogs: AssertionLogOutput | null
  assertionCatalog?: AssertionCatalog
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
      <span className={cn("font-mono text-xs", value ? "text-emerald-700" : "text-red-700")}>
        {value ? "true" : "false"}
      </span>
    )
  }
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, i) => (
          <span
            key={i}
            className="font-mono text-xs bg-[color:var(--secondary)]/60 border border-[color:var(--border)] px-1.5 py-0.5 text-[color:var(--foreground)]"
          >
            {String(item)}
          </span>
        ))}
      </div>
    )
  }
  if (typeof value === "object" && value !== null) {
    return (
      <pre className="font-mono text-xs text-[color:var(--muted-foreground)] whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }
  return (
    <span className="font-mono text-xs text-[color:var(--foreground)]">
      {formatDetailValue(value)}
    </span>
  )
}

export function AuditGatesPanel({
  gates,
  passedAssertions,
  totalAssertions,
  highlightedSources,
  assertionLogs,
  assertionCatalog,
}: AuditGatesPanelProps) {
  const [selected, setSelected] = useState<SelectedAssertion | null>(null)
  const [sourceOpen, setSourceOpen] = useState(false)

  useEffect(() => {
    setSourceOpen(selected?.status === "not_run")
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
      <div className="border border-[color:var(--border)] bg-[color:var(--card)]">
        <div className="bg-[color:var(--secondary)]/60 border-b border-[color:var(--border)] px-4 py-2 flex items-center justify-between">
          <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Gates
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--chart-4)]">
            {passedAssertions}/{totalAssertions}
          </span>
        </div>
        <div className="divide-y divide-[color:var(--border)]">
          {GATE_ORDER.map((gate) => {
            const detail = gates[gate]
            const meta = GATE_LABELS[gate]!
            if (!detail) return null

            const runCoreNames = Object.keys(detail.core)
            const runScenarioNames = Object.keys(detail.scenario)
            const hasRunData = runCoreNames.length > 0 || runScenarioNames.length > 0
            const isSkipped = !detail.passed && !hasRunData

            const catalogCore = assertionCatalog?.core[gate] ?? []
            const catalogScenario = assertionCatalog?.scenario[gate] ?? []

            const mergedCore = Array.from(new Set([...runCoreNames, ...catalogCore])).sort()
            const mergedScenario = Array.from(
              new Set([...runScenarioNames, ...catalogScenario]),
            ).sort()

            const allAssertions: {
              name: string
              type: "core" | "scenario"
              status: AssertionStatus
            }[] = [
              ...mergedCore.map((name) => {
                const ran = name in detail.core
                return {
                  name,
                  type: "core" as const,
                  status: ran
                    ? detail.core[name]
                      ? ("passed" as const)
                      : ("failed" as const)
                    : ("not_run" as const),
                }
              }),
              ...mergedScenario.map((name) => {
                const ran = name in detail.scenario
                return {
                  name,
                  type: "scenario" as const,
                  status: ran
                    ? detail.scenario[name]
                      ? ("passed" as const)
                      : ("failed" as const)
                    : ("not_run" as const),
                }
              }),
            ]

            return (
              <div key={gate}>
                <div
                  className={`px-4 py-2 flex items-center justify-between ${
                    detail.passed ? "bg-[color:var(--accent)]/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-[family-name:var(--font-display)] text-base text-[color:var(--foreground)]">
                      {meta.number}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--foreground)]">
                      {meta.label}
                    </span>
                    {isSkipped && (
                      <span
                        className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)] truncate"
                        title="Gates are evaluated sequentially — the run stopped after the first failing gate, so this gate was not evaluated."
                      >
                        · skipped after upstream gate failed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[color:var(--chart-4)] tabular-nums">
                      {(detail.score * 100).toFixed(0)}%
                    </span>
                    <span
                      className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border ${
                        detail.passed
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"
                          : "border-[color:var(--border)] text-[color:var(--chart-4)]"
                      }`}
                    >
                      {detail.passed ? "Pass" : "Fail"}
                    </span>
                  </div>
                </div>
                {allAssertions.length > 0 && (
                  <div className="px-4 py-1.5">
                    {allAssertions.map((assertion) => {
                      const log =
                        assertion.type === "core"
                          ? assertionLogs?.[gate]?.core?.[assertion.name]
                          : assertionLogs?.[gate]?.scenario?.[assertion.name]

                      const isNotRun = assertion.status === "not_run"
                      const isPassed = assertion.status === "passed"

                      return (
                        <button
                          key={`${gate}-${assertion.type}-${assertion.name}`}
                          type="button"
                          onClick={() =>
                            handleAssertionClick({
                              name: assertion.name,
                              gate,
                              type: assertion.type,
                              status: assertion.status,
                            })
                          }
                          className="flex items-center justify-between py-1 w-full text-left transition-colors cursor-pointer hover:bg-[color:var(--secondary)]/60 -mx-1.5 px-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] px-1 shrink-0 border ${
                                assertion.type === "core"
                                  ? "bg-[color:var(--secondary)] text-[color:var(--muted-foreground)] border-[color:var(--border)]"
                                  : "bg-transparent text-[color:var(--chart-4)] border-[color:var(--border)]"
                              } ${isNotRun ? "opacity-60" : ""}`}
                            >
                              {assertion.type}
                            </span>
                            <span
                              className={`font-[family-name:var(--font-mono)] text-[11px] truncate ${
                                isNotRun
                                  ? "text-[color:var(--muted-foreground)]/60"
                                  : "text-[color:var(--muted-foreground)]"
                              }`}
                            >
                              {assertion.name.replace(/_/g, " ")}
                            </span>
                            {isNotRun && (
                              <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]/70 shrink-0 border border-[color:var(--border)] px-1">
                                not run
                              </span>
                            )}
                            {!isNotRun && log?.durationMs != null && log.durationMs > 0 && (
                              <span className="text-[10px] text-[color:var(--chart-4)] tabular-nums shrink-0">
                                {formatDuration(log.durationMs)}
                              </span>
                            )}
                          </div>
                          {isNotRun ? (
                            <Minus
                              size={14}
                              strokeWidth={3}
                              className="shrink-0 text-[color:var(--muted-foreground)]/60"
                            />
                          ) : isPassed ? (
                            <Check
                              size={14}
                              strokeWidth={3}
                              className="shrink-0 text-[color:var(--accent)]"
                            />
                          ) : (
                            <X
                              size={14}
                              strokeWidth={3}
                              className="shrink-0 text-[color:var(--chart-4)]"
                            />
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
          overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-0"
          className="data-[side=right]:w-[min(44rem,92vw)] data-[side=right]:sm:max-w-none p-0 gap-0 overflow-hidden flex flex-col border-l border-[color:var(--border)] bg-[color:var(--card)] shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.18)]"
        >
          <SheetHeader className="p-0 gap-0 shrink-0">
            <div className="bg-[color:var(--secondary)]/60 border-b border-[color:var(--border)] px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-1 shrink-0">
                <div className="w-2 h-2 bg-[color:var(--accent)]" />
                <div className="w-2 h-2 bg-[color:var(--border)]" />
                <div className="w-2 h-2 bg-[color:var(--muted)]" />
              </div>

              <SheetTitle className="text-[color:var(--foreground)] font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] truncate min-w-0">
                {selected?.name.replace(/_/g, " ")}
              </SheetTitle>

              <span
                className={`font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border shrink-0 ${
                  selected?.status === "passed"
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"
                    : selected?.status === "failed"
                    ? "border-[color:var(--border)] text-[color:var(--chart-4)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"
                }`}
              >
                {selected?.status === "passed"
                  ? "Pass"
                  : selected?.status === "failed"
                  ? "Fail"
                  : "Not run"}
              </span>

              <div className="flex items-center gap-2 ml-auto shrink-0">
                <span className="font-[family-name:var(--font-display)] text-sm text-[color:var(--muted-foreground)]">
                  {gateLabel?.number}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                  {gateLabel?.label}
                </span>
                <span
                  className={`font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.1em] px-1 border border-[color:var(--border)] ${
                    selected?.type === "core"
                      ? "bg-[color:var(--secondary)] text-[color:var(--muted-foreground)]"
                      : "bg-transparent text-[color:var(--chart-4)]"
                  }`}
                >
                  {selected?.type}
                </span>
                <SheetClose className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors ml-2">
                  <XIcon size={16} />
                  <span className="sr-only">Close</span>
                </SheetClose>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-auto bg-[color:var(--card)]">
            {/* Verdict block */}
            {selectedLog ? (
              <div className="border-b border-[color:var(--border)]">
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={cn(
                        "w-8 h-8 flex items-center justify-center shrink-0",
                        selectedLog.passed
                          ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"
                          : "bg-[color:var(--chart-4)] text-white",
                      )}
                    >
                      {selectedLog.passed ? (
                        <Check size={18} strokeWidth={3} />
                      ) : (
                        <X size={18} strokeWidth={3} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[color:var(--foreground)] leading-snug">
                        {selectedLog.message ?? "No message provided."}
                      </p>
                      {selectedLog.durationMs > 0 && (
                        <p className="font-[family-name:var(--font-mono)] text-xs text-[color:var(--muted-foreground)] mt-0.5 flex items-center gap-1">
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
                    <div className="border border-red-300 bg-red-50">
                      <div className="px-3 py-1.5 border-b border-red-200">
                        <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-red-800">
                          Error
                        </span>
                      </div>
                      <pre className="px-3 py-2.5 text-xs text-red-900 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                        {selectedLog.error}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Evidence table */}
                {detailEntries.length > 0 && (
                  <div className="px-5 pb-4">
                    <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)] mb-2">
                      Evidence
                    </p>
                    <div className="border border-[color:var(--border)]">
                      {detailEntries.map(([key, value], i) => (
                        <div
                          key={key}
                          className={cn(
                            "grid grid-cols-[minmax(8rem,auto)_1fr] items-baseline",
                            i < detailEntries.length - 1 && "border-b border-[color:var(--border)]",
                          )}
                        >
                          <div className="px-3 py-2 bg-[color:var(--secondary)]/50 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--muted-foreground)] self-stretch flex items-center">
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
              <div className="px-5 py-8 border-b border-[color:var(--border)]">
                <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                  {selected?.status === "not_run"
                    ? "Not run — this gate was skipped after an upstream gate failed. Source shown below for reference."
                    : "No assertion log available. Re-run the eval to generate logs."}
                </p>
              </div>
            )}

            {/* Source code — collapsible */}
            {selectedHtml && (
              <div className="border-t border-[color:var(--border)]">
                <button
                  type="button"
                  onClick={() => setSourceOpen(!sourceOpen)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-[color:var(--secondary)]/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                      Source
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[color:var(--muted-foreground)]/70">
                      {sourceFilename}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-[color:var(--muted-foreground)] transition-transform",
                      sourceOpen && "rotate-180",
                    )}
                  />
                </button>
                {sourceOpen && (
                  <div className="border-t border-[color:var(--border)]">
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
