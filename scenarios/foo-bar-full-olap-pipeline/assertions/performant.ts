import type { AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries } from "../../_shared/assertion-helpers";

async function measureEndpoint(paths: string[]): Promise<{ elapsedMs: number; ok: boolean } | null> {
  for (const port of [3000, 4000, 8080]) {
    for (const p of paths) {
      try {
        const start = Date.now();
        const response = await fetch(`http://localhost:${port}${p}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          await response.text();
          return { elapsedMs: Date.now() - start, ok: true };
        }
      } catch {}
    }
  }
  return null;
}

export async function top_products_under_200ms(): Promise<AssertionResult> {
  const result = await measureEndpoint(["/api/top-products", "/api/topProducts"]);
  if (!result) {
    return { passed: false, message: "Top products endpoint did not respond.", details: {} };
  }
  const passed = result.elapsedMs < 200;
  return {
    passed,
    message: passed ? `Top products responded in ${result.elapsedMs}ms.` : `Top products took ${result.elapsedMs}ms (limit 200ms).`,
    details: { elapsedMs: result.elapsedMs },
  };
}

export async function funnel_under_200ms(): Promise<AssertionResult> {
  const result = await measureEndpoint(["/api/funnel", "/api/conversion-funnel"]);
  if (!result) {
    return { passed: false, message: "Funnel endpoint did not respond.", details: {} };
  }
  const passed = result.elapsedMs < 200;
  return {
    passed,
    message: passed ? `Funnel responded in ${result.elapsedMs}ms.` : `Funnel took ${result.elapsedMs}ms (limit 200ms).`,
    details: { elapsedMs: result.elapsedMs },
  };
}

export async function hourly_under_200ms(): Promise<AssertionResult> {
  const result = await measureEndpoint(["/api/hourly", "/api/hourly-activity"]);
  if (!result) {
    return { passed: false, message: "Hourly endpoint did not respond.", details: {} };
  }
  const passed = result.elapsedMs < 200;
  return {
    passed,
    message: passed ? `Hourly responded in ${result.elapsedMs}ms.` : `Hourly took ${result.elapsedMs}ms (limit 200ms).`,
    details: { elapsedMs: result.elapsedMs },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
