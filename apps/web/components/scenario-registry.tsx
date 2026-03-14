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
  view?: "all" | "scenarios" | "harnesses"
}

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
        "text-xs uppercase tracking-[0.15em] px-2.5 py-1 border-[2px] transition-colors",
        active
          ? "bg-[#FF10F0] border-black text-black"
          : "bg-white border-black/20 text-black/60 hover:text-black hover:border-black"
      )}
    >
      {label}
    </button>
  )
}

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
        <code className="text-sm leading-[1.7] text-black/80" style={{ fontFamily: "var(--font-body), ui-monospace, monospace" }}>
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
  const [selectedDomains, setSelectedDomains] = useState<string[]>(
    parseList(searchParams.get("domain"))
  )
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>(
    parseList(searchParams.get("competency"))
  )
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
    parseList(searchParams.get("feature"))
  )
  const [selectedTiers, setSelectedTiers] = useState<string[]>(
    parseList(searchParams.get("tier"))
  )
  const [selectedStartingStates, setSelectedStartingStates] = useState<string[]>(
    parseList(searchParams.get("state"))
  )
  const [selectedTaskCategories, setSelectedTaskCategories] = useState<string[]>(
    parseList(searchParams.get("category"))
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFilterCount =
    selectedDomains.length +
    selectedCompetencies.length +
    selectedFeatures.length +
    selectedTiers.length +
    selectedStartingStates.length +
    selectedTaskCategories.length

  useEffect(() => {
    const params = new URLSearchParams()

    if (showTabs && tab !== "scenarios") params.set("tab", tab)
    if (query) params.set("q", query)

    const setList = (key: string, values: string[]) => {
      if (values.length > 0) params.set(key, values.join(","))
    }

    setList("domain", selectedDomains)
    setList("competency", selectedCompetencies)
    setList("feature", selectedFeatures)
    setList("tier", selectedTiers)
    setList("state", selectedStartingStates)
    setList("category", selectedTaskCategories)

    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [
    pathname,
    query,
    router,
    selectedCompetencies,
    selectedDomains,
    selectedFeatures,
    selectedStartingStates,
    selectedTaskCategories,
    selectedTiers,
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

  const filteredScenarios = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return props.scenarios
      .filter((scenario) => {
        if (selectedDomains.length > 0 && !selectedDomains.includes(scenario.domain)) return false
        if (selectedTiers.length > 0 && !selectedTiers.includes(scenario.tier)) return false
        if (
          selectedStartingStates.length > 0 &&
          !selectedStartingStates.includes(scenario.startingState)
        ) {
          return false
        }
        if (
          selectedCompetencies.length > 0 &&
          !selectedCompetencies.every((slug) => scenario.competencies.includes(slug))
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
    selectedCompetencies,
    selectedDomains,
    selectedFeatures,
    selectedStartingStates,
    selectedTaskCategories,
    selectedTiers,
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

  const toggle = (values: string[], slug: string, set: (next: string[]) => void) => {
    if (values.includes(slug)) {
      set(values.filter((value) => value !== slug))
    } else {
      set([...values, slug])
    }
  }

  const clearScenarioFilters = () => {
    setSelectedDomains([])
    setSelectedCompetencies([])
    setSelectedFeatures([])
    setSelectedTiers([])
    setSelectedStartingStates([])
    setSelectedTaskCategories([])
  }

  return (
    <div className="space-y-6">
      <div className="border-[3px] border-black p-4 lg:p-5">
        {showTabs ? (
          <div className="flex flex-wrap items-center gap-2 mb-4">
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
            <div className="ml-auto text-xs uppercase tracking-[0.2em] text-black/50">
              {tab === "scenarios" ? `${filteredScenarios.length} scenarios` : `${filteredHarnesses.length} harnesses`}
            </div>
          </div>
        ) : tab === "scenarios" ? (
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-xs font-bold uppercase tracking-[0.2em]">
                {filteredScenarios.length} scenarios
              </span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-black/40">
                {props.scenarios.filter((s) => s.tier === "tier-1").length} Tier 1
                {" / "}
                {props.scenarios.filter((s) => s.tier === "tier-2").length} Tier 2
                {" / "}
                {props.scenarios.filter((s) => s.tier === "tier-3").length} Tier 3
              </span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-black/40">
                {props.scenarios.filter((s) => s.startingState === "greenfield").length} Greenfield
                {" / "}
                {props.scenarios.filter((s) => s.startingState === "broken").length} Broken
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center mb-4">
            <div className="text-xs uppercase tracking-[0.2em] text-black/50">
              {`${filteredHarnesses.length} harnesses`}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, description, tags..."
            aria-label="Search scenario and harness registry"
            className="h-9 border-[2px] border-black text-sm tracking-wide placeholder:text-black/35 focus-visible:ring-[#FF10F0]/20 focus-visible:border-[#FF10F0]"
          />

          {tab === "scenarios" && (
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-9 shrink-0 px-3 text-xs font-bold uppercase tracking-[0.2em] border-[2px] transition-colors",
                    (selectedDomains.length + selectedCompetencies.length + selectedFeatures.length + selectedTaskCategories.length) > 0
                      ? "bg-[#FF10F0] border-black text-black"
                      : "bg-white border-black text-black hover:bg-black hover:text-white"
                  )}
                >
                  More{(selectedDomains.length + selectedCompetencies.length + selectedFeatures.length + selectedTaskCategories.length) > 0 ? ` (${selectedDomains.length + selectedCompetencies.length + selectedFeatures.length + selectedTaskCategories.length})` : ""}
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="overflow-y-auto">
                <SheetHeader>
                  <div className="flex items-center justify-between pr-8">
                    <SheetTitle className="text-sm font-bold uppercase tracking-[0.2em]">
                      More Filters
                    </SheetTitle>
                    <button
                      type="button"
                      onClick={clearScenarioFilters}
                      className="text-xs uppercase tracking-[0.16em] text-black/50 hover:text-black"
                    >
                      Clear All
                    </button>
                  </div>
                </SheetHeader>

                <div className="px-4 pb-6 space-y-5">
                  <FilterSection label="Domains">
                    {props.domains.map((option) => (
                      <FilterChip
                        key={option.slug}
                        label={option.label}
                        active={selectedDomains.includes(option.slug)}
                        onClick={() => toggle(selectedDomains, option.slug, setSelectedDomains)}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection label="Competencies">
                    {props.competencies.map((option) => (
                      <FilterChip
                        key={option.slug}
                        label={option.label}
                        active={selectedCompetencies.includes(option.slug)}
                        onClick={() =>
                          toggle(selectedCompetencies, option.slug, setSelectedCompetencies)
                        }
                      />
                    ))}
                  </FilterSection>

                  <FilterSection label="Features">
                    {props.features.map((option) => (
                      <FilterChip
                        key={option.slug}
                        label={option.label}
                        active={selectedFeatures.includes(option.slug)}
                        onClick={() => toggle(selectedFeatures, option.slug, setSelectedFeatures)}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection label="Task Category">
                    {props.taskCategories.map((option) => (
                      <FilterChip
                        key={option.slug}
                        label={option.label}
                        active={selectedTaskCategories.includes(option.slug)}
                        onClick={() =>
                          toggle(selectedTaskCategories, option.slug, setSelectedTaskCategories)
                        }
                      />
                    ))}
                  </FilterSection>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>

        {tab === "scenarios" && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.15em] text-black/40 mr-1">Tier</span>
              {props.tiers.map((option) => (
                <FilterChip
                  key={option.slug}
                  label={option.label}
                  active={selectedTiers.includes(option.slug)}
                  onClick={() => toggle(selectedTiers, option.slug, setSelectedTiers)}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.15em] text-black/40 mr-1">State</span>
              {props.startingStates.map((option) => (
                <FilterChip
                  key={option.slug}
                  label={option.label}
                  active={selectedStartingStates.includes(option.slug)}
                  onClick={() =>
                    toggle(selectedStartingStates, option.slug, setSelectedStartingStates)
                  }
                />
              ))}
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearScenarioFilters}
                className="text-[10px] uppercase tracking-[0.15em] text-black/40 hover:text-black ml-auto"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {tab === "scenarios" && (
        <div className="grid gap-3">
          {filteredScenarios.map((scenario) => {
            const key = `scenario:${scenario.id}`
            const expanded = expandedId === key
            return (
              <div
                key={scenario.id}
                className="border-t border-black/10 first:border-t-0 py-4"
              >
                <Link
                  href={`/audit/${scenario.id}`}
                  className="text-sm font-bold uppercase tracking-[0.05em] hover:underline"
                >
                  {scenario.title}
                </Link>
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
                  <div className="mt-3 pl-0 space-y-2 text-xs text-black/45">
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
          })}
        </div>
      )}

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

      <div className="border-[2px] border-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-black/50 mb-2">Contribute New Scenarios</p>
        <p className="text-sm text-black/65 mb-3">
          Scaffold with <code>dec-bench create</code>, register with{" "}
          <code>dec-bench registry add</code>, then open a PR with{" "}
          <code>dec-bench registry publish</code>.
        </p>
        <Link
          href="/docs/add-eval/getting-started"
          className="inline-block text-xs font-bold uppercase tracking-[0.2em] border-[2px] border-black px-3 py-1.5 hover:bg-[#FF10F0]"
        >
          Open Getting Started
        </Link>
      </div>
    </div>
  )
}
