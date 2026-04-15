import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function invalid_filter_returns_400(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url;
  const endpoints: string[] = meta.endpoints ?? [];

  if (!baseUrl || endpoints.length === 0) {
    return { passed: false, message: "api_base_url or endpoints not set.", details: {} };
  }

  // Pick the first metric-specific endpoint and send an invalid filter
  const metricEndpoint = endpoints.find(
    (e) => e.includes("metric") || e.includes("fare") || e.includes("revenue"),
  );
  if (!metricEndpoint) {
    return { passed: false, message: "No metric endpoint found to test.", details: { endpoints } };
  }

  const testUrl = `${baseUrl}${metricEndpoint}?taxi_type=INVALID_TYPE_XYZ&start_date=not-a-date`;
  try {
    const resp = await fetch(testUrl);
    const status = resp.status;
    const passed = status === 400;
    return {
      passed,
      message: passed
        ? `Invalid filter correctly returned HTTP 400.`
        : `Invalid filter returned HTTP ${status}, expected 400.`,
      details: { testUrl, status },
    };
  } catch (err) {
    return { passed: false, message: `Request failed entirely: ${err}`, details: {} };
  }
}
