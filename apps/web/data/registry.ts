import "server-only"

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type StartingState = "broken" | "greenfield"

export type RegistryScenario = {
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

export type HarnessTool = {
  name: string
  version: string
  category: string
}

export type RegistryHarness = {
  id: string
  title: string
  tagline: string
  description: string
  installScript: string
  networkPolicy: "open" | "restricted"
  allowlistedEndpoints?: string[]
  tools: HarnessTool[]
}

export type TaxonomyOption = {
  slug: string
  label: string
}

export const domains: TaxonomyOption[] = [
  { slug: "foo-bar", label: "Foo Bar (Dummy)" },
  { slug: "b2b-saas", label: "B2B SaaS" },
  { slug: "b2c-saas", label: "B2C SaaS" },
  { slug: "ugc", label: "UGC" },
  { slug: "e-commerce", label: "E-commerce" },
  { slug: "advertising", label: "Advertising" },
  { slug: "consumption-based-infra", label: "Consumption-Based Infra" },
]

export const competencies: TaxonomyOption[] = [
  { slug: "environment-setup", label: "Environment Setup" },
  { slug: "data-modeling-and-schema-design", label: "Data Modeling and Schema Design" },
  { slug: "data-ingestion-and-integration", label: "Data Ingestion and Integration" },
  { slug: "transformation-and-semantic-modeling", label: "Transformation and Semantic Modeling" },
  { slug: "storage-and-data-layout", label: "Storage and Data Layout" },
  { slug: "orchestration-and-dataops", label: "Orchestration and DataOps" },
  { slug: "data-quality-and-observability", label: "Data Quality and Observability" },
  { slug: "reliability-and-fault-tolerance", label: "Reliability and Fault Tolerance" },
  { slug: "distributed-systems-and-consistency", label: "Distributed Systems and Consistency" },
  { slug: "scalability-and-performance-engineering", label: "Scalability and Performance Engineering" },
  { slug: "security-privacy-and-governance", label: "Security, Privacy, and Governance" },
  { slug: "technology-selection-and-architecture-tradeoffs", label: "Technology Selection and Architecture Tradeoffs" },
]

export const features: TaxonomyOption[] = [
  { slug: "performance-dashboards", label: "Performance Dashboards" },
  { slug: "reporting-metrics-layers", label: "Reporting Metrics Layers" },
  { slug: "exported-reports", label: "Exported Reports" },
  { slug: "realtime-feeds", label: "Realtime Feeds" },
  { slug: "analytical-chat", label: "Analytical Chat" },
]

export const taskCategories: TaxonomyOption[] = [
  { slug: "schema-design", label: "Schema Design" },
  { slug: "query-optimization", label: "Query Optimization" },
  { slug: "ingestion", label: "Ingestion" },
  { slug: "migration", label: "Migration" },
  { slug: "debugging", label: "Debugging" },
  { slug: "materialized-views", label: "Materialized Views" },
  { slug: "partitioning", label: "Partitioning" },
  { slug: "replication", label: "Replication" },
  { slug: "compression", label: "Compression" },
  { slug: "monitoring", label: "Monitoring" },
]

export const tiers: TaxonomyOption[] = [
  { slug: "tier-1", label: "Tier 1" },
  { slug: "tier-2", label: "Tier 2" },
  { slug: "tier-3", label: "Tier 3" },
]

export const startingStates: TaxonomyOption[] = [
  { slug: "broken", label: "Broken / Incomplete" },
  { slug: "greenfield", label: "Clean / Greenfield" },
]

function resolveDataDir(dirName: string): string {
  const localDir = join(process.cwd(), "data", dirName)
  if (existsSync(localDir)) return localDir

  return join(process.cwd(), "apps", "web", "data", dirName)
}

function readRegistryDirectory<T>(dir: string): T[] {
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  return files.map((fileName) => {
    const filePath = join(dir, fileName)
    const raw = readFileSync(filePath, "utf8")
    return JSON.parse(raw) as T
  })
}

export const scenarios = readRegistryDirectory<RegistryScenario>(
  resolveDataDir("scenarios")
)

export const harnesses = readRegistryDirectory<RegistryHarness>(
  resolveDataDir("harnesses")
)
