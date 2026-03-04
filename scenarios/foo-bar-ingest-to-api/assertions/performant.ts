import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function top_products_under_200ms(): Promise<AssertionResult> {
  const start = Date.now();
  await fetch("http://localhost:3000/api/top-products");
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Top products under 200ms." : `Top products took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function funnel_under_200ms(): Promise<AssertionResult> {
  const start = Date.now();
  await fetch("http://localhost:3000/api/funnel");
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Funnel under 200ms." : `Funnel took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function hourly_under_200ms(): Promise<AssertionResult> {
  const start = Date.now();
  await fetch("http://localhost:3000/api/hourly");
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Hourly under 200ms." : `Hourly took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
