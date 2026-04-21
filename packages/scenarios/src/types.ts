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
  | "foo-bar"
  | "b2b-saas"
  | "b2c-saas"
  | "ugc"
  | "e-commerce"
  | "advertising"
  | "consumption-based-infra";

// Built-in harnesses plus custom user harness names.
export type BuiltInHarness = "base-rt" | "classic-de" | "olap-for-swe";
export type Harness = BuiltInHarness | "custom";

// Agent planning mode
export type PlanMode = "plan" | "no-plan";

// Agent persona: baseline (minimal context) or informed (domain-specific guidance).
// Prompt files live at scenarios/{id}/harnesses/{harness}/prompts/{persona}.md —
// the harness-scenario pair owns the prompt, not the scenario root.
export type Persona = "baseline" | "informed";

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

export interface ScenarioInfrastructure {
  services: string[];
  description?: string;
}

export interface ScenarioProductionChecks {
  maxExpectedLines?: number;
  maxFileLines?: number;
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
  harnesses: BuiltInHarness[];
  datasetPath?: string;
  schemaPath?: string;
  infrastructure?: ScenarioInfrastructure;
  productionChecks?: ScenarioProductionChecks;
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
