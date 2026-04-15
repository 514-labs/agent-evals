import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function all_endpoints_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const endpoints = meta.endpoints || {};

  const paths = [
    { name: "summary", path: endpoints.summary },
    { name: "daily_trend", path: endpoints.daily_trend },
    { name: "taxi_type_breakdown", path: endpoints.taxi_type_breakdown },
    { name: "top_routes", path: endpoints.top_routes },
  ].filter((p) => typeof p.path === "string" && p.path.length > 0);

  const results: Array<{ name: string; path: string; elapsedMs: number; ok: boolean }> = [];
  for (const { name, path } of paths) {
    try {
      const start = Date.now();
      const resp = await fetch(`${baseUrl}${path}`);
      await resp.json();
      const elapsed = Date.now() - start;
      results.push({ name, path, elapsedMs: elapsed, ok: elapsed < 200 });
    } catch {
      results.push({ name, path, elapsedMs: -1, ok: false });
    }
  }

  const allUnder200 = results.every((r) => r.ok);
  const passed = allUnder200;
  return {
    passed,
    message: passed
      ? `All ${results.length} endpoints responded under 200ms (materialized views likely in use).`
      : `Some endpoints exceeded 200ms -- materialized views may be needed for 3M+ row performance.`,
    details: { results },
  };
}
