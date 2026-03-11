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

export async function api_returns_json(ctx: AssertionContext): Promise<AssertionResult> {
  try {
    const res = await fetch("http://localhost:3000/api/metrics");
    const ct = res.headers.get("content-type") ?? "";
    const passed = ct.includes("application/json");
    return {
      passed,
      message: passed ? "API returns JSON." : `Content-Type: ${ct}.`,
      details: { contentType: ct },
    };
  } catch (e) {
    return {
      passed: false,
      message: "API did not respond.",
      details: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
