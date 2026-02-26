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

export interface EvalOutput {
  scenario: string;
  version: string;
  harness: string;
  agent: string;
  model: string;
  highest_gate: number;
  normalized_score: number;
  gates: Record<GateName, GateResult>;
  efficiency: EfficiencyMetrics;
}
