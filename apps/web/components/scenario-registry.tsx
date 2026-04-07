"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"

type StartingState = "broken" | "greenfield"

type RegistryScenario = {
  id: string
  title: string
  description: string
  tier: "tier-1" | "tier-2" | "tier-3"
  domain: string
  startingState: StartingState
  competencies: string[]
  features: string[]
  taskCategories: string[]
  harnesses: string[]
  taskCount: number
  services: string[]
  tags: string[]
}

type RegistryHarness = {
  id: string
  title: string
  description: string
  installScript: string
  networkPolicy: "open" | "restricted"
  allowlistedEndpoints?: string[]
}

type TaxonomyOption = {
  slug: string
  label: string
}

type ScenarioRegistryProps = {
  scenarios: RegistryScenario[]
  harnesses: RegistryHarness[]
  domains: TaxonomyOption[]
  competencies: TaxonomyOption[]
  features: TaxonomyOption[]
  taskCategories: TaxonomyOption[]
  tiers: TaxonomyOption[]
  startingStates: TaxonomyOption[]
  scenariosWithResults: string[]
  view?: "all" | "scenarios" | "harnesses"
}

const TIER_PILLS = [
  { slug: "tier-1", label: "T1" },
  { slug: "tier-2", label: "T2" },
  { slug: "tier-3", label: "T3" },
]

const STATE_PILLS = [
  { slug: "broken", label: "Broken" },
  { slug: "greenfield", label: "Greenfield" },
]

const SERVICE_PILLS = [
  { slug: "postgres", label: "Postgres" },
  { slug: "clickhouse", label: "ClickHouse" },
  { slug: "redpanda", label: "Redpanda" },
]

const SCRIPT_PREVIEW_LINE_LIMIT = 6

function parseList(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function includesText(haystack: string[], needle: string): boolean {
  if (!needle) return true
  return haystack.some((value) => value.toLowerCase().includes(needle))
}

function formatInstallScriptPreview(rawScript: string): { lines: string[]; truncated: boolean } {
  if (!rawScript.trim()) {
    return { lines: ["# Uses base image defaults only"], truncated: false }
  }

  const normalized = rawScript
    .replace(/\s*&&\s*/g, " &&\n")
    .replace(/\s*;\s*/g, ";\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const truncated = normalized.length > SCRIPT_PREVIEW_LINE_LIMIT
  const lines = truncated ? normalized.slice(0, SCRIPT_PREVIEW_LINE_LIMIT) : normalized
  return { lines, truncated }
}

// ─── Mono-caps label used throughout the filter bar ────────────────────────
function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-black/40"
      style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
    >
      {children}
    </span>
  )
}

// ─── Pill toggle chip ───────────────────────────────────────────────────────
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 border-[2px] transition-colors leading-none",
        active
          ? "bg-[#B91C1C] border-[#B91C1C] text-white"
          : "bg-white border-black/25 text-black/55 hover:text-black hover:border-black"
      )}
    >
      {label}
    </button>
  )
}

// ─── Styled native select ───────────────────────────────────────────────────
function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (val: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "appearance-none border-[2px] bg-white pl-2.5 pr-6 py-1 cursor-pointer transition-colors",
          "text-[11px] uppercase tracking-[0.12em] leading-none",
          value
            ? "border-[#B91C1C] text-black"
            : "border-black/25 text-black/55 hover:border-black hover:text-black"
        )}
        style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-1.5 text-[9px] text-black/40">▾</span>
    </div>
  )
}

// ─── Has-Results toggle ─────────────────────────────────────────────────────
function HasResultsToggle({
  active,
  disabled,
  onClick,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 border-[2px] transition-colors leading-none",
        "text-[11px] uppercase tracking-[0.14em]",
        disabled
          ? "border-black/10 text-black/25 cursor-not-allowed"
          : active
          ? "bg-[#B91C1C] border-[#B91C1C] text-white"
          : "bg-white border-black/25 text-black/55 hover:text-black hover:border-black"
      )}
    >
      {/* Toggle switch pill */}
      <span
        className={cn(
          "relative inline-block w-6 h-3 border transition-colors shrink-0",
          disabled
            ? "border-black/15 bg-transparent"
            : active
            ? "border-white/50 bg-white/20"
            : "border-black/30 bg-transparent"
        )}
      >
        <span
          className={cn(
            "absolute top-0 h-full w-2.5 border transition-all",
            disabled
              ? "border-black/15 bg-black/10 left-0"
              : active
              ? "border-white/60 bg-white right-0"
              : "border-black/30 bg-black/20 left-0"
          )}
        />
      </span>
      Has Results
    </button>
  )
}

// ─── Inline vertical rule between filter groups ─────────────────────────────
function VRule() {
  return <span className="hidden sm:block w-px h-4 bg-black/15 shrink-0" />
}

// ─── Filter section in the "More" sheet ─────────────────────────────────────
function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.16em] text-black/45">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function ScriptBlock({ harnessId, script }: { harnessId: string; script: string }) {
  const [copied, setCopied] = useState(false)
  const preview = formatInstallScriptPreview(script)
  const filename = `harnesses/${harnessId}.sh`

  const handleCopy = useCallback(() => {
    if (!script.trim()) return
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [script])

  return (
    <div className="border-[3px] border-black overflow-hidden">
      <div className="flex items-center justify-between bg-black px-3 py-1.5 border-b-[3px] border-black">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-white">
          {">_ "}{filename}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-white/60 hover:text-white transition-opacity"
          aria-label="Copy script"
        >
          {copied ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="0" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
          )}
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto bg-white">
        <code className="text-sm leading-[1.7] text-black/80" style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}>
          {preview.lines.map((line) => `${line}\n`).join("")}{scriptPreviewSuffix(preview.truncated)}
        </code>
      </pre>
    </div>
  )
}

function scriptPreviewSuffix(truncated: boolean): string {
  return truncated ? "# ...\n" : ""
}

export function ScenarioRegistry({ view = "all", ...props }: ScenarioRegistryProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const showTabs = view === "all"
  const [tab, setTab] = useState<"scenarios" | "harnesses">(
    view !== "all"
      ? view
      : searchParams.get("tab") === "harnesses" ? "harnesses" : "scenarios"
  )
  const [query, setQuery] = useState(searchParams.get("q") ?? "")

  // Single-select dropdowns
  const [selectedDomain, setSelectedDomain] = useState(
    parseList(searchParams.get("domain"))[0] ?? ""
  )
  const [selectedCompetency, setSelectedCompetency] = useState(
    parseList(searchParams.get("competency"))[0] ?? ""
  )

  // Multi-select pills
  const [selectedTiers, setSelectedTiers] = useState<string[]>(
    parseList(searchParams.get("tier"))
  )
  const [selectedStartingStates, setSelectedStartingStates] = useState<string[]>(
    parseList(searchParams.get("state"))
  )
  const [selectedServices, setSelectedServices] = useState<string[]>(
    parseList(searchParams.get("services"))
  )

  // Has Results toggle — defaults to true when there are any results
  const hasAnyResults = props.scenariosWithResults.length > 0
  const [hasResults, setHasResults] = useState(
    hasAnyResults && searchParams.get("results") !== "0"
  )

  // "More" filters (sheet)
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
    parseList(searchParams.get("feature"))
  )
  const [selectedTaskCategories, setSelectedTaskCategories] = useState<string[]>(
    parseList(searchParams.get("category"))
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const moreFilterCount = selectedFeatures.length + selectedTaskCategories.length

  // Count active "primary" filters for Clear All visibility
  const activeFilterCount =
    (selectedDomain ? 1 : 0) +
    (selectedCompetency ? 1 : 0) +
    selectedTiers.length +
    selectedStartingStates.length +
    selectedServices.length +
    moreFilterCount

  useEffect(() => {
    const params = new URLSearchParams()

    if (showTabs && tab !== "scenarios") params.set("tab", tab)
    if (query) params.set("q", query)
    if (selectedDomain) params.set("domain", selectedDomain)
    if (selectedCompetency) params.set("competency", selectedCompetency)

    const setList = (key: string, values: string[]) => {
      if (values.length > 0) params.set(key, values.join(","))
    }

    setList("tier", selectedTiers)
    setList("state", selectedStartingStates)
    setList("services", selectedServices)
    setList("feature", selectedFeatures)
    setList("category", selectedTaskCategories)

    // Only write results=0 when explicitly turned off; absence means "on" (default)
    if (hasAnyResults && !hasResults) params.set("results", "0")

    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [
    pathname,
    query,
    router,
    selectedDomain,
    selectedCompetency,
    selectedTiers,
    selectedStartingStates,
    selectedServices,
    selectedFeatures,
    selectedTaskCategories,
    hasResults,
    hasAnyResults,
    showTabs,
    tab,
  ])

  const scenarioCountByHarness = useMemo(() => {
    const counts = new Map<string, number>()
    for (const scenario of props.scenarios) {
      for (const harness of scenario.harnesses) {
        counts.set(harness, (counts.get(harness) ?? 0) + 1)
      }
    }
    return counts
  }, [props.scenarios])

  const resultsSet = useMemo(
    () => new Set(props.scenariosWithResults),
    [props.scenariosWithResults]
  )

  const filteredScenarios = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return props.scenarios
      .filter((scenario) => {
        if (hasResults && hasAnyResults && !resultsSet.has(scenario.id)) return false
        if (selectedDomain && scenario.domain !== selectedDomain) return false
        if (selectedTiers.length > 0 && !selectedTiers.includes(scenario.tier)) return false
        if (
          selectedStartingStates.length > 0 &&
          !selectedStartingStates.includes(scenario.startingState)
        ) {
          return false
        }
        if (
          selectedCompetency &&
          !scenario.competencies.includes(selectedCompetency)
        ) {
          return false
        }
        if (
          selectedServices.length > 0 &&
          !selectedServices.some((svc) => scenario.services.includes(svc))
        ) {
          return false
        }
        if (
          selectedFeatures.length > 0 &&
          !selectedFeatures.every((slug) => scenario.features.includes(slug))
        ) {
          return false
        }
        if (
          selectedTaskCategories.length > 0 &&
          !selectedTaskCategories.every((slug) => scenario.taskCategories.includes(slug))
        ) {
          return false
        }
        if (
          !includesText(
            [scenario.id, scenario.title, scenario.description, ...scenario.tags],
            needle
          )
        ) {
          return false
        }
        return true
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [
    props.scenarios,
    query,
    hasResults,
    hasAnyResults,
    resultsSet,
    selectedDomain,
    selectedCompetency,
    selectedTiers,
    selectedStartingStates,
    selectedServices,
    selectedFeatures,
    selectedTaskCategories,
  ])

  const filteredHarnesses = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return props.harnesses
      .filter((harness) =>
        includesText([harness.id, harness.title, harness.description, harness.installScript], needle)
      )
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [props.harnesses, query])

  const optionLabel = (options: TaxonomyOption[], slug: string) =>
    options.find((option) => option.slug === slug)?.label ?? slug

  const toggleList = (values: string[], slug: string, set: (next: string[]) => void) => {
    if (values.includes(slug)) {
      set(values.filter((v) => v !== slug))
    } else {
      set([...values, slug])
    }
  }

  const clearScenarioFilters = () => {
    setSelectedDomain("")
    setSelectedCompetency("")
    setSelectedTiers([])
    setSelectedStartingStates([])
    setSelectedServices([])
    setSelectedFeatures([])
    setSelectedTaskCategories([])
  }

  return (
    <div className="space-y-6">
      {/* ── Tab switcher (when view="all") ────────────────────────── */}
      {showTabs && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("scenarios")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] border-[2px]",
              tab === "scenarios" ? "bg-black text-white border-black" : "bg-white border-black text-black"
            )}
          >
            Scenarios
          </button>
          <button
            type="button"
            onClick={() => setTab("harnesses")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] border-[2px]",
              tab === "harnesses" ? "bg-black text-white border-black" : "bg-white border-black text-black"
            )}
          >
            Harnesses
          </button>
        </div>
      )}

      {/* ── Filter bar ────────────────────────────────────────────── */}
      {tab === "scenarios" && (
        <div className="border-[3px] border-black">

          {/* Row 1 — Search + count */}
          <div className="flex items-center gap-2 p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, description, tags…"
              aria-label="Search scenarios"
              className="h-8 border-[2px] border-black/25 text-sm tracking-wide placeholder:text-black/30 focus-visible:border-black focus-visible:ring-0"
            />
            <span
              className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-black/40 whitespace-nowrap"
              style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
            >
              {filteredScenarios.length}&thinsp;/&thinsp;{props.scenarios.length}
            </span>
          </div>

          {/* Rule */}
          <div className="border-t border-black/15" />

          {/* Row 2 — Has Results + Domain + Competency + More sheet */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <HasResultsToggle
              active={hasResults}
              disabled={!hasAnyResults}
              onClick={() => setHasResults((v) => !v)}
            />

            <VRule />

            <div className="flex items-center gap-2">
              <FilterLabel>Domain</FilterLabel>
              <FilterSelect value={selectedDomain} onChange={setSelectedDomain}>
                <option value="">All</option>
                {props.domains.map((d) => (
                  <option key={d.slug} value={d.slug}>{d.label}</option>
                ))}
              </FilterSelect>
            </div>

            <VRule />

            <div className="flex items-center gap-2">
              <FilterLabel>Competency</FilterLabel>
              <FilterSelect value={selectedCompetency} onChange={setSelectedCompetency}>
                <option value="">All</option>
                {props.competencies.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
              </FilterSelect>
            </div>

            {/* More filters (Features + Task Categories) */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "ml-auto h-7 shrink-0 px-2.5 text-[11px] uppercase tracking-[0.14em] border-[2px] transition-colors leading-none",
                    moreFilterCount > 0
                      ? "bg-[#B91C1C] border-[#B91C1C] text-white"
                      : "bg-white border-black/25 text-black/50 hover:border-black hover:text-black"
                  )}
                >
                  More{moreFilterCount > 0 ? ` (${moreFilterCount})` : ""}
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="overflow-y-auto">
                <SheetHeader>
                  <div className="flex items-center justify-between pr-8">
                    <SheetTitle className="text-sm font-bold uppercase tracking-[0.2em]">
                      More Filters
                    </SheetTitle>
                    {moreFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFeatures([])
                          setSelectedTaskCategories([])
                        }}
                        className="text-xs uppercase tracking-[0.16em] text-black/50 hover:text-black"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </SheetHeader>
                <div className="px-4 pb-6 space-y-5">
                  <FilterSection label="Features">
                    {props.features.map((option) => (
                      <FilterChip
                        key={option.slug}
                        label={option.label}
                        active={selectedFeatures.includes(option.slug)}
                        onClick={() => toggleList(selectedFeatures, option.slug, setSelectedFeatures)}
                      />
                    ))}
                  </FilterSection>
                  <FilterSection label="Task Category">
                    {props.taskCategories.map((option) => (
                      <FilterChip
                        key={option.slug}
                        label={option.label}
                        active={selectedTaskCategories.includes(option.slug)}
                        onClick={() => toggleList(selectedTaskCategories, option.slug, setSelectedTaskCategories)}
                      />
                    ))}
                  </FilterSection>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Rule */}
          <div className="border-t border-black/15" />

          {/* Row 3 — Tier · State · Services pills */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <FilterLabel>Tier</FilterLabel>
              {TIER_PILLS.map((pill) => (
                <FilterChip
                  key={pill.slug}
                  label={pill.label}
                  active={selectedTiers.includes(pill.slug)}
                  onClick={() => toggleList(selectedTiers, pill.slug, setSelectedTiers)}
                />
              ))}
            </div>

            <VRule />

            <div className="flex items-center gap-1.5">
              <FilterLabel>State</FilterLabel>
              {STATE_PILLS.map((pill) => (
                <FilterChip
                  key={pill.slug}
                  label={pill.label}
                  active={selectedStartingStates.includes(pill.slug)}
                  onClick={() => toggleList(selectedStartingStates, pill.slug, setSelectedStartingStates)}
                />
              ))}
            </div>

            <VRule />

            <div className="flex items-center gap-1.5">
              <FilterLabel>Services</FilterLabel>
              {SERVICE_PILLS.map((pill) => (
                <FilterChip
                  key={pill.slug}
                  label={pill.label}
                  active={selectedServices.includes(pill.slug)}
                  onClick={() => toggleList(selectedServices, pill.slug, setSelectedServices)}
                />
              ))}
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearScenarioFilters}
                className="ml-auto text-[10px] uppercase tracking-[0.15em] text-black/35 hover:text-black transition-colors"
                style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
              >
                Clear all ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Harness search (no filter bar needed) ─────────────────── */}
      {tab === "harnesses" && (
        <div className="border-[3px] border-black p-3">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search harnesses…"
              aria-label="Search harness registry"
              className="h-8 border-[2px] border-black/25 text-sm tracking-wide placeholder:text-black/30 focus-visible:border-black focus-visible:ring-0"
            />
            <span
              className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-black/40 whitespace-nowrap"
              style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
            >
              {filteredHarnesses.length}&thinsp;/&thinsp;{props.harnesses.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Scenario list ─────────────────────────────────────────── */}
      {tab === "scenarios" && (
        <div className="grid gap-0 divide-y divide-black/10">
          {filteredScenarios.length === 0 ? (
            <p
              className="py-10 text-center text-xs uppercase tracking-[0.18em] text-black/35"
              style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
            >
              No scenarios match the current filters
            </p>
          ) : (
            filteredScenarios.map((scenario) => {
              const key = `scenario:${scenario.id}`
              const expanded = expandedId === key
              const hasAuditData = resultsSet.has(scenario.id)
              return (
                <div key={scenario.id} className="py-4">
                  <div className="flex items-start gap-2">
                    <Link
                      href={`/audit/${scenario.id}`}
                      className="text-sm font-bold uppercase tracking-[0.05em] hover:underline leading-tight"
                    >
                      {scenario.title}
                    </Link>
                    {hasAuditData && (
                      <span className="shrink-0 mt-0.5 inline-block w-1.5 h-1.5 rounded-full bg-[#B91C1C]" title="Has results" />
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-black/50">
                    {scenario.description}
                  </p>
                  <p className="mt-1.5 text-xs text-black/35">
                    {optionLabel(props.tiers, scenario.tier)}
                    {" · "}
                    {scenario.startingState === "broken" ? "Starts broken" : "Starts clean"}
                    {" · "}
                    {scenario.taskCount} {scenario.taskCount === 1 ? "task" : "tasks"}
                    {" · "}
                    {scenario.services.join(", ")}
                    {" · "}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : key)}
                      className="underline decoration-black/20 hover:decoration-black hover:text-black transition-colors"
                    >
                      {expanded ? "hide details" : "details"}
                    </button>
                  </p>

                  {expanded && (
                    <div className="mt-3 space-y-2 text-xs text-black/45">
                      <p>
                        <span className="text-black/30">Competencies: </span>
                        {scenario.competencies.map((slug, i) => (
                          <span key={slug}>
                            {i > 0 && ", "}
                            <Link
                              href={`/docs/evals/competencies/${slug}`}
                              className="underline decoration-black/15 hover:decoration-black hover:text-black transition-colors"
                            >
                              {optionLabel(props.competencies, slug)}
                            </Link>
                          </span>
                        ))}
                      </p>
                      {scenario.features.length > 0 && (
                        <p>
                          <span className="text-black/30">Features: </span>
                          {scenario.features.map((slug, i) => (
                            <span key={slug}>
                              {i > 0 && ", "}
                              <Link
                                href={`/docs/evals/features/${slug}`}
                                className="underline decoration-black/15 hover:decoration-black hover:text-black transition-colors"
                              >
                                {optionLabel(props.features, slug)}
                              </Link>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Harness list ──────────────────────────────────────────── */}
      {tab === "harnesses" && (
        <div className="grid gap-3">
          {filteredHarnesses.map((harness) => {
            const key = `harness:${harness.id}`
            const expanded = expandedId === key
            return (
              <Card key={harness.id} className="border-[2px] border-black/20 rounded-none shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-bold uppercase tracking-[0.05em]">
                        {harness.title}
                      </CardTitle>
                      <CardDescription className="mt-1 text-sm leading-relaxed text-black/60 max-w-2xl">
                        {harness.description}
                      </CardDescription>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : key)}
                      className="text-xs font-bold uppercase tracking-[0.2em] border-[2px] border-black px-2 py-1 hover:bg-black hover:text-white"
                    >
                      {expanded ? "Close" : "Details"}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{harness.networkPolicy}</Badge>
                    <Badge variant="outline">
                      {scenarioCountByHarness.get(harness.id) ?? 0} scenarios
                    </Badge>
                  </div>

                  <ScriptBlock harnessId={harness.id} script={harness.installScript} />

                  {expanded && (
                    <div className="pt-2 border-t border-black/10 space-y-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-black/45">
                        Allowlisted Endpoints
                      </p>
                      <div className="text-sm text-black/65">
                        {harness.allowlistedEndpoints && harness.allowlistedEndpoints.length > 0
                          ? harness.allowlistedEndpoints.join(", ")
                          : "none"}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Contribute CTA ────────────────────────────────────────── */}
      <div className="border-[2px] border-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-black/50 mb-2">Contribute New Scenarios</p>
        <p className="text-sm text-black/65 mb-3">
          Scaffold with <code>dec-bench create</code>, register with{" "}
          <code>dec-bench registry add</code>, then open a PR with{" "}
          <code>dec-bench registry publish</code>.
        </p>
        <Link
          href="/docs/add-eval/getting-started"
          className="inline-block text-xs font-bold uppercase tracking-[0.2em] border-[2px] border-black px-3 py-1.5 hover:bg-[#B91C1C]"
        >
          Open Getting Started
        </Link>
      </div>
    </div>
  )
}
