export type GateName =
  | "functional"
  | "correct"
  | "robust"
  | "performant"
  | "production";

export type AssertionResultMap = Record<string, boolean>;

export interface AssertionResult {
  passed: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export interface AssertionLog {
  passed: boolean;
  durationMs: number;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export type AssertionLogMap = Record<string, AssertionLog>;

export type AssertionLogOutput = Record<
  GateName,
  {
    core: AssertionLogMap;
    scenario: AssertionLogMap;
  }
>;

export interface GateResult {
  passed: boolean;
  score: number;
  core: AssertionResultMap;
  scenario: AssertionResultMap;
}

export interface EfficiencyMetrics {
  wallClockSeconds: number;
  agentSteps: number;
  tokensUsed: number;
  llmApiCostUsd: number;
  llmApiCostSource?: "agent-reported" | "derived-from-published-pricing";
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface RunMetadata {
  persona: string;
  planMode: string;
  promptPath: string;
  promptSha256: string;
  promptContent: string;
  promptPreview?: string;
}

export interface CompositeScoreBreakdown {
  total: number;
  components: {
    taskCompletion: number;
    latency: number;
    cost: number;
    storage: number;
  };
}

export interface EvalOutput {
  scenario: string;
  version: string;
  harness: string;
  agent: string;
  model: string;
  run_metadata?: RunMetadata;
  highest_gate: number;
  normalized_score: number;
  composite_score?: CompositeScoreBreakdown;
  gates: Record<GateName, GateResult>;
  efficiency: EfficiencyMetrics;
}
