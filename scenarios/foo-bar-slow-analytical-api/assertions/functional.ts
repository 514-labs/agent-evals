import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { probeEgress } from "../../_shared/assertion-helpers";

export async function api_metrics_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await probeEgress(ctx, "metrics", { paths: ["/api/metrics"] });
  if (!result) {
    return { passed: false, message: "API metrics did not respond.", details: {} };
  }
  const passed = result.response.ok;
  return {
    passed,
    message: passed ? "API metrics responds." : `API returned status ${result.response.status}.`,
    details: { url: result.url, status: result.response.status },
  };
}

export async function api_breakdown_responds(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await probeEgress(ctx, "breakdown", { paths: ["/api/breakdown"] });
  if (!result) {
    return { passed: false, message: "API breakdown did not respond.", details: {} };
  }
  const passed = result.response.ok;
  return {
    passed,
    message: passed ? "API breakdown responds." : `API returned status ${result.response.status}.`,
    details: { url: result.url, status: result.response.status },
  };
}
