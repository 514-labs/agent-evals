import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function at_least_4_endpoints_respond(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const endpoints = meta.endpoints || {};

  const paths = [
    endpoints.summary,
    endpoints.daily_trend,
    endpoints.taxi_type_breakdown,
    endpoints.top_routes,
  ].filter((p: any) => typeof p === "string" && p.length > 0);

  if (paths.length < 4) {
    return {
      passed: false,
      message: `Only ${paths.length} endpoint paths defined in assertions.json (need 4).`,
      details: { endpoints },
    };
  }

  const results: Array<{ path: string; status: number }> = [];
  for (const path of paths) {
    try {
      const resp = await fetch(`${baseUrl}${path}`);
      results.push({ path, status: resp.status });
    } catch {
      results.push({ path, status: 0 });
    }
  }

  const okCount = results.filter((r) => r.status === 200).length;
  const passed = okCount >= 4;
  return {
    passed,
    message: passed
      ? `All ${okCount} endpoints responded with HTTP 200.`
      : `Only ${okCount}/4 endpoints responded with HTTP 200.`,
    details: { results },
  };
}
