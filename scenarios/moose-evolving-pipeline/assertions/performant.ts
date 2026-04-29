import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { probeEgress } from "../../_shared/assertion-helpers";

async function timeEgress(
  ctx: AssertionContext,
  name: string,
  paths: string[],
  label: string,
): Promise<AssertionResult> {
  const start = Date.now();
  const result = await probeEgress(ctx, name, { paths, timeoutMs: 2000 });
  const elapsed = Date.now() - start;
  if (!result) {
    return { passed: false, message: `${label} endpoint unreachable.`, details: { elapsedMs: elapsed } };
  }
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? `${label} under 200ms (${elapsed}ms).` : `${label} took ${elapsed}ms (>= 200ms).`,
    details: { url: result.url, elapsedMs: elapsed },
  };
}

export async function top_products_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  return timeEgress(ctx, "top-products", ["/api/top-products"], "Top products");
}

export async function revenue_by_region_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  return timeEgress(ctx, "revenue-by-region", ["/api/revenue-by-region"], "Revenue by region");
}
