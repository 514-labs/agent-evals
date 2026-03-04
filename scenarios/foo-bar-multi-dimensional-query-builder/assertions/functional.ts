import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function api_responds(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const res = await fetch("http://localhost:3000/api/metrics");
    const passed = res.ok;
    return {
      passed,
      message: passed ? "API responds." : `API returned status ${res.status}.`,
      details: { status: res.status },
    };
  } catch (e) {
    return {
      passed: false,
      message: "API did not respond.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

export async function returns_metrics_shape(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const res = await fetch("http://localhost:3000/api/metrics");
    const data = await res.json();
    const hasTotal = typeof (data?.total_value ?? data?.totalValue ?? data?.sum) === "number";
    const hasCount = typeof (data?.event_count ?? data?.eventCount ?? data?.count) === "number";
    const passed = hasTotal || hasCount;
    return {
      passed,
      message: passed ? "Returns metrics shape." : "Response missing total_value or event_count.",
      details: { hasTotal, hasCount },
    };
  } catch (e) {
    return {
      passed: false,
      message: "API did not respond.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
