import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { probeEgress } from "../../_shared/assertion-helpers";

const METRICS_PATHS = ["/api/metrics"];

export async function api_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await probeEgress(ctx, "metrics", { paths: METRICS_PATHS });
  if (!result) {
    return { passed: false, message: "API did not respond.", details: {} };
  }
  const passed = result.response.ok;
  return {
    passed,
    message: passed ? "API responds." : `API returned status ${result.response.status}.`,
    details: { url: result.url, status: result.response.status },
  };
}

export async function api_returns_json(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await probeEgress(ctx, "metrics", { paths: METRICS_PATHS });
  if (!result) {
    return { passed: false, message: "API did not respond.", details: {} };
  }
  const ct = result.response.headers.get("content-type") ?? "";
  const passed = ct.includes("application/json");
  return {
    passed,
    message: passed ? "API returns JSON." : `Content-Type: ${ct}.`,
    details: { url: result.url, contentType: ct },
  };
}
