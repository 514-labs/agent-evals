import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function metrics_under_200ms(): Promise<AssertionResult> {
  const start = Date.now();
  await fetch("http://localhost:3000/api/metrics");
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Metrics under 200ms." : `Metrics took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function breakdown_under_200ms(): Promise<AssertionResult> {
  const start = Date.now();
  await fetch("http://localhost:3000/api/breakdown");
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Breakdown under 200ms." : `Breakdown took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
