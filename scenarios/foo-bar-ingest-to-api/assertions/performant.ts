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
    return {
      passed: false,
      message: `${label} endpoint unreachable.`,
      details: { elapsedMs: elapsed },
    };
  }
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? `${label} under 200ms.` : `${label} took ${elapsed}ms.`,
    details: { url: result.url, elapsedMs: elapsed },
  };
}

export async function top_products_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  return timeEgress(
    ctx,
    "top-products",
    ["/api/top-products", "/api/topProducts", "/top-products", "/topProducts"],
    "Top products",
  );
}

export async function funnel_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  return timeEgress(
    ctx,
    "funnel",
    ["/api/funnel", "/api/conversion-funnel", "/funnel", "/conversion-funnel"],
    "Funnel",
  );
}

export async function hourly_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  return timeEgress(
    ctx,
    "hourly",
    ["/api/hourly", "/api/hourly-activity", "/hourly", "/hourly-activity"],
    "Hourly",
  );
}
