import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function summary_total_trips_matches_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const summaryPath = meta.endpoints?.summary;

  if (!summaryPath) {
    return { passed: false, message: "summary endpoint not defined in assertions.json.", details: {} };
  }

  try {
    const resp = await fetch(`${baseUrl}${summaryPath}`);
    if (!resp.ok) {
      return { passed: false, message: `Summary endpoint returned HTTP ${resp.status}.`, details: {} };
    }
    const data = await resp.json() as any;
    const totalTrips = data.total_trips || data.totalTrips || data.count || 0;
    const expected = 3049670; // 2964624 yellow + 85046 green
    const tolerance = expected * 0.05;
    const passed = Math.abs(totalTrips - expected) <= tolerance;
    return {
      passed,
      message: passed
        ? `Summary total_trips ${totalTrips} is within 5% of expected ${expected}.`
        : `Summary total_trips ${totalTrips} deviates from expected ${expected}.`,
      details: { totalTrips, expected, tolerance },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}

export async function summary_total_revenue_matches(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const summaryPath = meta.endpoints?.summary;

  if (!summaryPath) {
    return { passed: false, message: "summary endpoint not defined in assertions.json.", details: {} };
  }

  // Get ground truth from ClickHouse
  const yellowRev = await queryRows<{ rev: number }>(
    ctx,
    `SELECT sum(total_amount) AS rev FROM raw.yellow_trips_2024_01`,
  );
  const greenRev = await queryRows<{ rev: number }>(
    ctx,
    `SELECT sum(total_amount) AS rev FROM raw.green_trips_2024_01`,
  );
  const groundTruth = Number(yellowRev[0]?.rev ?? 0) + Number(greenRev[0]?.rev ?? 0);

  try {
    const resp = await fetch(`${baseUrl}${summaryPath}`);
    if (!resp.ok) {
      return { passed: false, message: `Summary endpoint returned HTTP ${resp.status}.`, details: {} };
    }
    const data = await resp.json() as any;
    const totalRevenue = data.total_revenue || data.totalRevenue || data.revenue || 0;
    const tolerance = groundTruth * 0.05;
    const passed = Math.abs(totalRevenue - groundTruth) <= tolerance;
    return {
      passed,
      message: passed
        ? `Summary total_revenue ${totalRevenue} is within 5% of ground truth ${groundTruth.toFixed(2)}.`
        : `Summary total_revenue ${totalRevenue} deviates from ground truth ${groundTruth.toFixed(2)}.`,
      details: { totalRevenue, groundTruth, tolerance },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}

export async function taxi_type_breakdown_has_two_entries(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url || "http://localhost:3000";
  const breakdownPath = meta.endpoints?.taxi_type_breakdown;

  if (!breakdownPath) {
    return { passed: false, message: "taxi_type_breakdown endpoint not defined in assertions.json.", details: {} };
  }

  try {
    const resp = await fetch(`${baseUrl}${breakdownPath}`);
    if (!resp.ok) {
      return { passed: false, message: `Breakdown endpoint returned HTTP ${resp.status}.`, details: {} };
    }
    const data = await resp.json() as any;
    const rows = Array.isArray(data) ? data : (data.data || data.breakdown || data.rows || []);
    const types = rows.map((r: any) => r.taxi_type || r.type).sort();
    const passed = rows.length === 2 && types.includes("green") && types.includes("yellow");
    return {
      passed,
      message: passed
        ? "Taxi type breakdown returns exactly 2 entries (yellow and green)."
        : `Taxi type breakdown returned ${rows.length} entries with types: ${types.join(", ")}.`,
      details: { count: rows.length, types },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}
