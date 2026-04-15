import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fare_summary_matches_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const baseUrl = config.api_base_url || "http://localhost:3000";

  // Ground truth: sum fare_amount from raw yellow trips
  const rawRows = await queryRows<{ total: number }>(
    ctx,
    "SELECT sum(fare_amount) AS total FROM raw.yellow_trips_2024_01 WHERE fare_amount >= 0",
  );
  const rawTotal = Number(rawRows[0]?.total ?? 0);

  // Find the fare-summary endpoint
  const endpoints = config.endpoints || [];
  const summaryEp = endpoints.find((ep: any) =>
    (ep.path || "").includes("fare") || (ep.description || "").toLowerCase().includes("fare summary"),
  );
  const summaryPath = summaryEp?.path || "/api/fare-summary";

  let apiTotal: number;
  try {
    const data = await fetchJson(`${baseUrl}${summaryPath}?taxi_type=yellow`);
    apiTotal = Number(data.total_fare ?? data.totalFare ?? data.total_amount ?? 0);
  } catch (e) {
    return {
      passed: false,
      message: `Failed to fetch fare summary: ${e instanceof Error ? e.message : String(e)}`,
      details: { rawTotal },
    };
  }

  // Allow 5% tolerance for data cleaning differences
  const tolerance = rawTotal * 0.05;
  const passed = Math.abs(rawTotal - apiTotal) < tolerance && apiTotal > 0;
  return {
    passed,
    message: passed
      ? "Fare summary total matches raw table ground truth."
      : `Fare mismatch: raw=${rawTotal.toFixed(2)}, api=${apiTotal.toFixed(2)}.`,
    details: { rawTotal, apiTotal, tolerance },
  };
}

export async function top_trips_returns_highest_fare(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const baseUrl = config.api_base_url || "http://localhost:3000";

  // Ground truth: max fare from raw yellow
  const rawRows = await queryRows<{ maxFare: number }>(
    ctx,
    "SELECT max(fare_amount) AS maxFare FROM raw.yellow_trips_2024_01",
  );
  const rawMax = Number(rawRows[0]?.maxFare ?? 0);

  // Find the top-trips endpoint
  const endpoints = config.endpoints || [];
  const topEp = endpoints.find((ep: any) =>
    (ep.path || "").includes("top") || (ep.description || "").toLowerCase().includes("top trips"),
  );
  const topPath = topEp?.path || "/api/top-trips";

  let apiTopFare: number;
  try {
    const data = await fetchJson(`${baseUrl}${topPath}?limit=1`);
    const items = Array.isArray(data) ? data : data.data || [];
    if (items.length === 0) {
      return { passed: false, message: "Top trips returned empty array.", details: { rawMax } };
    }
    apiTopFare = Number(items[0].fare_amount ?? items[0].fare ?? items[0].total_amount ?? 0);
  } catch (e) {
    return {
      passed: false,
      message: `Failed to fetch top trips: ${e instanceof Error ? e.message : String(e)}`,
      details: { rawMax },
    };
  }

  const passed = apiTopFare === rawMax;
  return {
    passed,
    message: passed
      ? "Top-1 trip matches highest fare in raw data."
      : `Top fare mismatch: raw max=${rawMax}, api top=${apiTopFare}.`,
    details: { rawMax, apiTopFare },
  };
}
