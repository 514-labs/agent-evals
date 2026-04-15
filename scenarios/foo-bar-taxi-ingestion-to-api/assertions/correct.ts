import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function ingested_row_count_approximately_3m(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const sourceTable = meta.source_table;

  if (!sourceTable) {
    return { passed: false, message: "source_table not defined in assertions.json.", details: {} };
  }

  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${sourceTable}`);
  const count = Number(rows[0]?.n ?? 0);
  const expected = 3049670;
  const tolerance = expected * 0.05;
  const passed = Math.abs(count - expected) <= tolerance;
  return {
    passed,
    message: passed
      ? `Ingested ${count} rows (within 5% of expected ${expected}).`
      : `Ingested ${count} rows (expected ~${expected}, outside 5% tolerance).`,
    details: { count, expected, tolerance },
  };
}

export async function stats_endpoint_matches_ground_truth_revenue(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const apiEndpoints = meta.api_endpoints || [];
  const baseUrl = "http://localhost:3000";
  const sourceTable = meta.source_table;

  // Find stats-like endpoint
  const statsPath = apiEndpoints.find((e: string) => /stat/i.test(e)) || apiEndpoints[0];
  if (!statsPath) {
    return { passed: false, message: "No stats endpoint found in api_endpoints.", details: {} };
  }

  if (!sourceTable) {
    return { passed: false, message: "source_table not defined in assertions.json.", details: {} };
  }

  // Get ground truth from ClickHouse
  const groundTruthRows = await queryRows<{ rev: number }>(
    ctx,
    `SELECT sum(total_amount) AS rev FROM ${sourceTable}`,
  );
  const groundTruth = Number(groundTruthRows[0]?.rev ?? 0);

  try {
    const resp = await fetch(`${baseUrl}${statsPath}`);
    if (!resp.ok) {
      return { passed: false, message: `Stats endpoint returned HTTP ${resp.status}.`, details: {} };
    }
    const data = await resp.json() as any;
    const revenue = data.total_revenue || data.totalRevenue || data.revenue || 0;
    const tolerance = groundTruth * 0.05;
    const passed = Math.abs(revenue - groundTruth) <= tolerance;
    return {
      passed,
      message: passed
        ? `Stats revenue ${revenue} matches ground truth ${groundTruth.toFixed(2)} (within 5%).`
        : `Stats revenue ${revenue} deviates from ground truth ${groundTruth.toFixed(2)}.`,
      details: { revenue, groundTruth, tolerance },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}

export async function trips_endpoint_supports_taxi_type_filter(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const apiEndpoints = meta.api_endpoints || [];
  const baseUrl = "http://localhost:3000";

  // Find trips-like endpoint
  const tripsPath = apiEndpoints.find((e: string) => /trip/i.test(e)) || apiEndpoints[apiEndpoints.length - 1];
  if (!tripsPath) {
    return { passed: false, message: "No trips endpoint found in api_endpoints.", details: {} };
  }

  try {
    const resp = await fetch(`${baseUrl}${tripsPath}?taxi_type=green&limit=10`);
    if (!resp.ok) {
      return { passed: false, message: `Trips endpoint with filter returned HTTP ${resp.status}.`, details: {} };
    }
    const data = await resp.json() as any;
    const rows = Array.isArray(data) ? data : (data.data || data.trips || data.rows || []);
    const allGreen = rows.length > 0 && rows.every((r: any) => r.taxi_type === "green");
    const passed = allGreen;
    return {
      passed,
      message: passed
        ? `Trips endpoint correctly filters by taxi_type=green (${rows.length} rows, all green).`
        : rows.length === 0
          ? "Trips endpoint returned 0 rows for taxi_type=green filter."
          : `Trips endpoint returned non-green rows when filtering by taxi_type=green.`,
      details: { rowCount: rows.length, allGreen },
    };
  } catch (err) {
    return { passed: false, message: `Request failed: ${String(err)}`, details: {} };
  }
}
