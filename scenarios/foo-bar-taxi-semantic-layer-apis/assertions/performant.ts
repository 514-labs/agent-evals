import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function rollup_backed_endpoint_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url;
  const endpoints: string[] = meta.endpoints ?? [];

  if (!baseUrl || endpoints.length === 0) {
    return { passed: false, message: "api_base_url or endpoints not set.", details: {} };
  }

  // Test multiple endpoints and check that at least one is under 100ms
  const timings: Array<{ endpoint: string; elapsedMs: number }> = [];
  for (const endpoint of endpoints.slice(0, 5)) {
    const url = `${baseUrl}${endpoint}`;
    try {
      const start = Date.now();
      await fetch(url);
      const elapsed = Date.now() - start;
      timings.push({ endpoint, elapsedMs: elapsed });
    } catch {
      // skip failed endpoints for timing purposes
    }
  }

  const allUnder100 = timings.length > 0 && timings.every((t) => t.elapsedMs < 100);
  const someUnder100 = timings.some((t) => t.elapsedMs < 100);
  const passed = someUnder100;
  return {
    passed,
    message: passed
      ? allUnder100
        ? `All ${timings.length} tested endpoints responded under 100ms.`
        : `At least one endpoint responded under 100ms.`
      : `No endpoints responded under 100ms.`,
    details: { timings },
  };
}
