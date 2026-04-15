import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function stats_endpoint_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const apiEndpoints = meta.api_endpoints || [];
  const baseUrl = "http://localhost:3000";

  // Find stats-like endpoint
  const statsPath = apiEndpoints.find((e: string) => /stat/i.test(e)) || apiEndpoints[0];
  if (!statsPath) {
    return { passed: false, message: "No stats endpoint found in api_endpoints.", details: {} };
  }

  try {
    const start = Date.now();
    const resp = await fetch(`${baseUrl}${statsPath}`);
    await resp.json();
    const elapsed = Date.now() - start;
    const passed = elapsed < 200;
    return {
      passed,
      message: passed
        ? `Stats endpoint responded in ${elapsed}ms (< 200ms, MVs likely in use).`
        : `Stats endpoint took ${elapsed}ms (expected < 200ms -- materialized views needed).`,
      details: { elapsedMs: elapsed, endpoint: statsPath },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}
