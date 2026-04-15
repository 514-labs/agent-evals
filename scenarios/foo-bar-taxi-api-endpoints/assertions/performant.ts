import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function trips_endpoint_under_500ms(): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const baseUrl = config.api_base_url || "http://localhost:3000";
  const endpoints = config.endpoints || [];
  const tripsEp = endpoints.find((ep: any) =>
    (ep.path || "").includes("trip") && !(ep.path || "").includes("top"),
  );
  const tripsPath = tripsEp?.path || "/api/trips";

  const start = Date.now();
  await fetch(`${baseUrl}${tripsPath}?page=1&page_size=20`);
  const elapsed = Date.now() - start;
  const passed = elapsed < 500;
  return {
    passed,
    message: passed ? `Trips endpoint responded in ${elapsed}ms.` : `Trips endpoint took ${elapsed}ms (limit 500ms).`,
    details: { elapsedMs: elapsed },
  };
}

export async function fare_summary_under_500ms(): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const baseUrl = config.api_base_url || "http://localhost:3000";
  const endpoints = config.endpoints || [];
  const summaryEp = endpoints.find((ep: any) =>
    (ep.path || "").includes("fare") || (ep.description || "").toLowerCase().includes("fare summary"),
  );
  const summaryPath = summaryEp?.path || "/api/fare-summary";

  const start = Date.now();
  await fetch(`${baseUrl}${summaryPath}`);
  const elapsed = Date.now() - start;
  const passed = elapsed < 500;
  return {
    passed,
    message: passed ? `Fare summary responded in ${elapsed}ms.` : `Fare summary took ${elapsed}ms (limit 500ms).`,
    details: { elapsedMs: elapsed },
  };
}

export async function top_trips_under_500ms(): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const baseUrl = config.api_base_url || "http://localhost:3000";
  const endpoints = config.endpoints || [];
  const topEp = endpoints.find((ep: any) =>
    (ep.path || "").includes("top") || (ep.description || "").toLowerCase().includes("top trips"),
  );
  const topPath = topEp?.path || "/api/top-trips";

  const start = Date.now();
  await fetch(`${baseUrl}${topPath}`);
  const elapsed = Date.now() - start;
  const passed = elapsed < 500;
  return {
    passed,
    message: passed ? `Top trips responded in ${elapsed}ms.` : `Top trips took ${elapsed}ms (limit 500ms).`,
    details: { elapsedMs: elapsed },
  };
}
