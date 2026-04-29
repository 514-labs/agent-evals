import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, probeEgress } from "../../_shared/assertion-helpers";

async function measureEndpoint(
  ctx: AssertionContext,
  name: string,
  paths: string[],
): Promise<{ url: string; elapsedMs: number; ok: boolean } | null> {
  const start = Date.now();
  const result = await probeEgress(ctx, name, { paths, timeoutMs: 3000 });
  if (!result || !result.response.ok) return null;
  await result.response.text();
  return { url: result.url, elapsedMs: Date.now() - start, ok: true };
}

export async function top_products_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await measureEndpoint(ctx, "top-products", [
    "/api/top-products",
    "/api/topProducts",
    "/top-products",
    "/topProducts",
  ]);
  if (!result) {
    return { passed: false, message: "Top products endpoint did not respond.", details: {} };
  }
  const passed = result.elapsedMs < 200;
  return {
    passed,
    message: passed ? `Top products responded in ${result.elapsedMs}ms.` : `Top products took ${result.elapsedMs}ms (limit 200ms).`,
    details: { url: result.url, elapsedMs: result.elapsedMs },
  };
}

export async function funnel_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await measureEndpoint(ctx, "funnel", [
    "/api/funnel",
    "/api/conversion-funnel",
    "/funnel",
    "/conversion-funnel",
  ]);
  if (!result) {
    return { passed: false, message: "Funnel endpoint did not respond.", details: {} };
  }
  const passed = result.elapsedMs < 200;
  return {
    passed,
    message: passed ? `Funnel responded in ${result.elapsedMs}ms.` : `Funnel took ${result.elapsedMs}ms (limit 200ms).`,
    details: { url: result.url, elapsedMs: result.elapsedMs },
  };
}

export async function hourly_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await measureEndpoint(ctx, "hourly", [
    "/api/hourly",
    "/api/hourly-activity",
    "/hourly",
    "/hourly-activity",
  ]);
  if (!result) {
    return { passed: false, message: "Hourly endpoint did not respond.", details: {} };
  }
  const passed = result.elapsedMs < 200;
  return {
    passed,
    message: passed ? `Hourly responded in ${result.elapsedMs}ms.` : `Hourly took ${result.elapsedMs}ms (limit 200ms).`,
    details: { url: result.url, elapsedMs: result.elapsedMs },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
