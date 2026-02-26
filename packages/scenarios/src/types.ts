// Difficulty tiers for benchmark scenarios
export type DifficultyTier = "tier-1" | "tier-2" | "tier-3";

// Task categories aligned with ClickHouse data engineering workflows
export type TaskCategory =
  | "schema-design"
  | "query-optimization"
  | "ingestion"
  | "migration"
  | "debugging"
  | "materialized-views"
  | "partitioning"
  | "replication"
  | "compression"
  | "monitoring";

// Business domains used by scenario registry entries.
export type BusinessDomain =
  | "b2b-saas"
  | "b2c-saas"
  | "ugc"
  | "e-commerce"
  | "advertising"
  | "consumption-based-infra"
  | "foo-bar";

// Built-in harnesses plus custom user harness names.
export type BuiltInHarness = "bare" | "dbt" | "full" | "mcp-postgres" | "web-search";
export type Harness = BuiltInHarness | "custom";

// Agent planning mode
export type PlanMode = "plan" | "no-plan";

// Agent persona reflecting ClickHouse expertise level
export type Persona = "naive" | "savvy";

// Baseline metrics before agent intervention
export interface BaselineMetrics {
  queryLatencyMs: number;
  storageBytes: number;
  costPerQueryUsd: number;
  compressionRatio?: number;
}

// Reference (optimal) metrics representing best achievable outcome
export interface ReferenceMetrics {
  queryLatencyMs: number;
  storageBytes: number;
  costPerQueryUsd: number;
  compressionRatio?: number;
}

// Persona-specific system prompts for the agent
export interface PersonaPrompts {
  naive: string;
  savvy: string;
}

// An individual evaluation task within a scenario
export interface Task {
  id: string;
  description: string;
  category: TaskCategory;
  expectedOutputSchema?: Record<string, unknown>;
  verificationQuery?: string;
}

// A complete benchmark scenario
export interface Scenario {
  id: string;
  title: string;
  description: string;
  tier: DifficultyTier;
  domain: BusinessDomain;
  tasks: Task[];
  baselineMetrics: BaselineMetrics;
  referenceMetrics: ReferenceMetrics;
  personaPrompts: PersonaPrompts;
  harness: Harness;
  datasetPath?: string;
  schemaPath?: string;
  tags: string[];
}

// Registry metadata shown by the website and list command.
export interface RegistryScenario {
  id: string;
  title: string;
  description: string;
  tier: DifficultyTier;
  domain: BusinessDomain;
  startingState: "broken" | "greenfield";
  competencies: string[];
  features: string[];
  taskCategories: TaskCategory[];
  harnesses: BuiltInHarness[];
  taskCount: number;
  services: string[];
  tags: string[];
}

// Observed metrics from an agent's completed run
export interface ObservedMetrics {
  queryLatencyMs: number;
  storageBytes: number;
  costPerQueryUsd: number;
  compressionRatio?: number;
  tasksCompleted: number;
  totalTasks: number;
}

// Complete result of a single eval run
export interface EvalResult {
  scenarioId: string;
  persona: Persona;
  mode: PlanMode;
  harness: Harness;
  runId: string;
  startedAt: string;
  completedAt: string;
  observed: ObservedMetrics;
  score?: number;
  notes?: string;
}
