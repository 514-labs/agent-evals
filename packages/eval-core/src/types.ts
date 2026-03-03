export type GateName =
  | "functional"
  | "correct"
  | "robust"
  | "performant"
  | "production";

export type AssertionResultMap = Record<string, boolean>;

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
