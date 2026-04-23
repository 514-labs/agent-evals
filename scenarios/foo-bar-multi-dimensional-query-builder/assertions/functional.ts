import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { fetchEgressJson, probeEgress } from "../../_shared/assertion-helpers";

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

export async function returns_metrics_shape(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await fetchEgressJson<any>(ctx, "metrics", { paths: METRICS_PATHS });
  const data = result?.data;
  if (data === undefined) {
    return { passed: false, message: "API did not return JSON.", details: { url: result?.url } };
  }
  const hasTotal = typeof (data?.total_value ?? data?.totalValue ?? data?.sum) === "number";
  const hasCount = typeof (data?.event_count ?? data?.eventCount ?? data?.count) === "number";
  const passed = hasTotal || hasCount;
  return {
    passed,
    message: passed ? "Returns metrics shape." : "Response missing total_value or event_count.",
    details: { url: result?.url, hasTotal, hasCount },
  };
}
