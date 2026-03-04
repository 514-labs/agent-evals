import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function api_returns_json(): Promise<AssertionResult> {
  const res = await fetch("http://localhost:3000/api/metrics");
  const ct = res.headers.get("content-type") ?? "";
  const passed = ct.includes("application/json");
  return {
    passed,
    message: passed ? "API returns JSON." : `Content-Type: ${ct}.`,
    details: { contentType: ct },
  };
}
