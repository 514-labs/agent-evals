import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function invalid_query_params_return_400_not_500(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const endpoints = meta.endpoints || {};

  const testCases = [
    { path: endpoints.summary, params: "?date=not-a-date" },
    { path: endpoints.daily_trend, params: "?start_date=invalid" },
    { path: endpoints.top_routes, params: "?limit=not-a-number" },
    { path: endpoints.top_routes, params: "?limit=-1" },
  ].filter((tc) => typeof tc.path === "string" && tc.path.length > 0);

  const results: Array<{ path: string; params: string; status: number; is500: boolean }> = [];
  for (const tc of testCases) {
    try {
      const resp = await fetch(`${baseUrl}${tc.path}${tc.params}`);
      results.push({ path: tc.path, params: tc.params, status: resp.status, is500: resp.status >= 500 });
    } catch {
      results.push({ path: tc.path, params: tc.params, status: 0, is500: false });
    }
  }

  const has500 = results.some((r) => r.is500);
  const passed = !has500;
  return {
    passed,
    message: passed
      ? "Invalid query parameters do not cause 500 errors."
      : "Some endpoints returned 500 on invalid query parameters (expected 400 or graceful handling).",
    details: { results },
  };
}
