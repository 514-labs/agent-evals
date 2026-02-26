import type { EvalOutput, GateName, GateResult } from "./types.js";

export interface EvalOutputInput {
  scenario: string;
  version: string;
  harness: string;
  agent: string;
  model: string;
  gates: Record<GateName, GateResult>;
  highestGate: number;
  normalizedScore: number;
  efficiency: EvalOutput["efficiency"];
}

export function createEvalOutput(input: EvalOutputInput): EvalOutput {
  return {
    scenario: input.scenario,
    version: input.version,
    harness: input.harness,
    agent: input.agent,
    model: input.model,
    highest_gate: input.highestGate,
    normalized_score: input.normalizedScore,
    gates: input.gates,
    efficiency: input.efficiency,
  };
}
