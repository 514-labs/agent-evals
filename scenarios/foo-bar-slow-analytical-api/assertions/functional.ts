import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function api_metrics_responds(): Promise<AssertionResult> {
  try {
    const response = await fetch("http://localhost:3000/api/metrics");
    const passed = response.ok;
    return {
      passed,
      message: passed ? "API metrics responds." : `API returned status ${response.status}.`,
      details: { status: response.status },
    };
  } catch (e) {
    return {
      passed: false,
      message: "API metrics did not respond.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

export async function api_breakdown_responds(): Promise<AssertionResult> {
  try {
    const response = await fetch("http://localhost:3000/api/breakdown");
    const passed = response.ok;
    return {
      passed,
      message: passed ? "API breakdown responds." : `API returned status ${response.status}.`,
      details: { status: response.status },
    };
  } catch (e) {
    return {
      passed: false,
      message: "API breakdown did not respond.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
