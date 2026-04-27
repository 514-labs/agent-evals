import type { AssertionResult } from "@dec-bench/eval-core";

// CLI-shape scenarios do not produce a code artifact; the production gate
// is satisfied trivially. The decbench production gate elsewhere in this
// repo enforces line-count and dead-code rules on agent-authored sources;
// this scenario's surface is the agent's command sequence, not source code.
export async function no_code_artifact_required(): Promise<AssertionResult> {
  return {
    passed: true,
    message: "Scenario does not require a code artifact; production gate is N/A.",
    details: {},
  };
}
