import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { probeEgress } from "../../_shared/assertion-helpers";

async function timeEndpoint(
  ctx: AssertionContext,
  name: string,
  paths: string[],
  label: string,
): Promise<AssertionResult> {
  const start = Date.now();
  const result = await probeEgress(ctx, name, { paths, timeoutMs: 3000 });
  const elapsed = Date.now() - start;
  if (!result) {
    return { passed: false, message: `${label} endpoint unreachable.`, details: { elapsedMs: elapsed } };
  }
  await result.response.text();
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? `${label} under 200ms.` : `${label} took ${elapsed}ms.`,
    details: { url: result.url, elapsedMs: elapsed },
  };
}

export async function metrics_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  return timeEndpoint(ctx, "metrics", ["/api/metrics"], "Metrics");
}

export async function breakdown_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  return timeEndpoint(ctx, "breakdown", ["/api/breakdown"], "Breakdown");
}
