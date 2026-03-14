"use client"

import Link from "next/link"
import { useCallback, useState } from "react"

import type { HarnessTool, RegistryHarness } from "@/data/registry"

type HarnessWithScenarioCount = RegistryHarness & {
  scenarioCount: number
}

type HarnessShowcaseProps = {
  harnesses: HarnessWithScenarioCount[]
}

const BASE_SERVICES = ["ClickHouse", "Redpanda", "Postgres", "Python 3", "Node.js 22"]

const COMPARISON_ROWS: { label: string; key: string }[] = [
  { label: "Orchestration", key: "orchestration" },
  { label: "Transformation", key: "transformation" },
  { label: "Processing", key: "processing" },
  { label: "Framework", key: "framework" },
  { label: "Runtime", key: "runtime" },
  { label: "Network", key: "networkPolicy" },
  { label: "Scenarios", key: "scenarioCount" },
]

function getComparisonCell(harness: HarnessWithScenarioCount, key: string): string {
  if (key === "networkPolicy") return harness.networkPolicy
  if (key === "scenarioCount") return String(harness.scenarioCount)

  const tools = harness.tools.filter((t) => t.category === key)
  if (tools.length === 0) return "\u2014"
  return tools.map((t) => `${t.name} ${t.version}`).join(", ")
}

function ScriptBlock({ harnessId, script }: { harnessId: string; script: string }) {
  const [copied, setCopied] = useState(false)

  const lines = script
    ? script
        .replace(/\s*&&\s*/g, " &&\n")
        .replace(/\s*;\s*/g, ";\n")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : ["# Uses base image defaults only"]

  const handleCopy = useCallback(() => {
    if (!script.trim()) return
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [script])

  return (
    <div className="border-[3px] border-black overflow-hidden">
      <div className="flex items-center justify-between bg-black px-3 py-1.5">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-white">
          {">_ "}harnesses/{harnessId}.sh
        </span>
        {script.trim() && (
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
        )}
      </div>
      <pre className="px-4 py-3 overflow-x-auto bg-white">
        <code
          className="text-sm leading-[1.7] text-black/80"
          style={{ fontFamily: "var(--font-body), ui-monospace, monospace" }}
        >
          {lines.map((line) => `${line}\n`).join("")}
        </code>
      </pre>
    </div>
  )
}

function ToolList({ tools, isBase }: { tools: HarnessTool[]; isBase: boolean }) {
  if (isBase) {
    return (
      <p className="text-sm text-black/60">
        Base infrastructure only: {BASE_SERVICES.join(", ")}
      </p>
    )
  }

  return (
    <ul className="space-y-1">
      {tools.map((tool) => (
        <li key={tool.name} className="text-sm text-black/70">
          <span className="font-bold">{tool.name}</span>{" "}
          <span className="text-black/40">{tool.version}</span>
        </li>
      ))}
    </ul>
  )
}

function HarnessSection({ harness }: { harness: HarnessWithScenarioCount }) {
  return (
    <section className="border-t-[3px] border-black pt-6 space-y-4">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl uppercase tracking-tight leading-none">
            {harness.title}
          </h2>
          <span className="text-xs uppercase tracking-[0.2em] text-[#FF10F0] font-bold">
            {harness.tagline}
          </span>
        </div>
        <p className="mt-2 text-sm text-black/60 leading-relaxed">
          {harness.description}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-black/40">
          {harness.id === "base-rt" ? "Infrastructure" : "Installed tools"}
        </p>
        <ToolList tools={harness.tools} isBase={harness.id === "base-rt"} />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-black/40">
          Install script
        </p>
        <ScriptBlock harnessId={harness.id} script={harness.installScript} />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-black/50 uppercase tracking-[0.12em]">
        <span>Network: {harness.networkPolicy}</span>
        <span className="text-black/20">|</span>
        <Link
          href="/docs/registry/scenarios"
          className="underline decoration-black/20 hover:decoration-[#FF10F0] hover:text-black transition-colors"
        >
          {harness.scenarioCount} scenarios
        </Link>
        {harness.allowlistedEndpoints && harness.allowlistedEndpoints.length > 0 && (
          <>
            <span className="text-black/20">|</span>
            <span>Endpoints: {harness.allowlistedEndpoints.join(", ")}</span>
          </>
        )}
      </div>
    </section>
  )
}

function ComparisonTable({ harnesses }: { harnesses: HarnessWithScenarioCount[] }) {
  return (
    <section className="border-t-[3px] border-black pt-6 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-[0.1em]">
        At a Glance
      </h2>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-[2px] border-black">
              <th className="py-2 pr-4 text-xs font-bold uppercase tracking-[0.12em] text-black/40 w-[120px]" />
              {harnesses.map((h) => (
                <th
                  key={h.id}
                  className="py-2 px-3 text-xs font-bold uppercase tracking-[0.12em]"
                >
                  {h.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-black/8">
                <td className="py-2 pr-4 text-xs font-bold uppercase tracking-[0.1em] text-black/45">
                  {row.label}
                </td>
                {harnesses.map((h) => {
                  const value = getComparisonCell(h, row.key)
                  const isDash = value === "\u2014"
                  return (
                    <td
                      key={h.id}
                      className={`py-2 px-3 text-xs ${isDash ? "text-black/20" : "text-black/65"}`}
                    >
                      {value}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function HarnessShowcase({ harnesses }: HarnessShowcaseProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm text-black/60 leading-relaxed">
          Each scenario runs inside a Docker container with pre-installed tools.
          The harness controls which tools are available to the agent, so you can
          compare how agents perform with different toolkits against the same problem.
          v0.1 ships with three.
        </p>

        <div className="space-y-3 text-sm">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold">LLM</span>
            <span className="text-black/30">+</span>
            <span className="font-bold">Agent harness</span>
            <span className="text-black/30">=</span>
            <span className="font-bold border-b-[2px] border-black pb-0.5">Standard agent</span>
          </div>
          <p className="text-xs text-black/45 leading-relaxed pl-0.5">
            A model (Claude, GPT, Gemini) paired with an agent CLI (Claude Code, Cursor, Codex)
            that gives it bash, file I/O, and tool use. Standard agents can be extended
            with skills, MCPs, and hooks.
          </p>

          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold">Standard agent</span>
            <span className="text-black/30">+</span>
            <span className="font-bold text-[#FF10F0]">Harness plugins</span>
            <span className="text-black/30">=</span>
            <span className="font-bold text-[#FF10F0] border-b-[2px] border-[#FF10F0] pb-0.5">Specialized agent</span>
          </div>
          <p className="text-xs text-black/45 leading-relaxed pl-0.5">
            Skills, MCPs, and pre-installed tools (dbt, Airflow, MooseStack) that turn a
            general-purpose agent into a specialized one like data engineering.
          </p>
        </div>
      </div>

      {harnesses.map((harness) => (
        <HarnessSection key={harness.id} harness={harness} />
      ))}

      <ComparisonTable harnesses={harnesses} />

      <section className="border-t border-black/15 pt-4">
        <p className="text-xs uppercase tracking-[0.15em] text-black/40 mb-1">
          Contribute a harness
        </p>
        <p className="text-sm text-black/55 mb-2">
          Write a shell script, pin versions, and open a PR.
        </p>
        <Link
          href="/docs/add-eval/getting-started"
          className="text-sm underline decoration-black/20 hover:decoration-[#FF10F0] hover:text-black transition-colors"
        >
          Getting started guide
        </Link>
      </section>
    </div>
  )
}
