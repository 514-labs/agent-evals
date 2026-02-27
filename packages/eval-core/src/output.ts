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
  compositeScore?: EvalOutput["composite_score"];
  efficiency: EvalOutput["efficiency"];
}

export function createEvalOutput(input: EvalOutputInput): EvalOutput {
  const output: EvalOutput = {
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

  if (input.compositeScore) {
    output.composite_score = input.compositeScore;
  }

  return output;
}
