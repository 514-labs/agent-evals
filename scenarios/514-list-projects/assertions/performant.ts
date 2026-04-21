import type { AssertionResult } from "@dec-bench/eval-core";

export async function cli_scenario_no_perf_requirement(): Promise<AssertionResult> {
  return {
    passed: true,
    message: "Performance gate is not applicable for this CLI-only scenario.",
    details: {},
  };
}
