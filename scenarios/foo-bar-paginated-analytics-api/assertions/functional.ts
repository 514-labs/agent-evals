import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function api_responds(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const res = await fetch("http://localhost:3000/api/events?limit=10&offset=0");
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

export async function returns_data_array(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const res = await fetch("http://localhost:3000/api/events?limit=5&offset=0");
    const data = await res.json();
    const arr = data?.data ?? data?.events ?? data;
    const passed = Array.isArray(arr);
    return {
      passed,
      message: passed ? "Returns data array." : "Response missing data array.",
      details: { hasArray: passed },
    };
  } catch (e) {
    return {
      passed: false,
      message: "API did not respond.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
