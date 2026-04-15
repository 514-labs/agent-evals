import { readFileSync, existsSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function total_revenue_matches_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const baseUrl = meta.api_base_url;
  const endpoints: string[] = meta.endpoints ?? [];

  // Compute ground truth from raw tables
  const rawRows = await queryRows<{ total: number }>(
    ctx,
    "SELECT sum(total_amount) AS total FROM raw.yellow_trips_2024_01",
  );
  const groundTruth = Number(rawRows[0]?.total ?? 0);

  if (!baseUrl) {
    return { passed: false, message: "api_base_url not set.", details: {} };
  }

  // Try to find a revenue endpoint
  const revenueEndpoint = endpoints.find(
    (e) => e.includes("total_revenue") || e.includes("revenue"),
  );
  if (!revenueEndpoint) {
    return { passed: false, message: "No revenue endpoint found in assertions.json endpoints.", details: { endpoints } };
  }

  try {
    const resp = await fetch(`${baseUrl}${revenueEndpoint}`);
    const body = await resp.json();
    const apiValue = Number(body.value ?? body.total_revenue ?? body.result ?? 0);
    const tolerance = groundTruth * 0.01; // 1% tolerance
    const passed = Math.abs(apiValue - groundTruth) <= tolerance;
    return {
      passed,
      message: passed
        ? `total_revenue API value ${apiValue} matches ground truth ${groundTruth} (within 1%).`
        : `total_revenue API value ${apiValue} does not match ground truth ${groundTruth} (outside 1% tolerance).`,
      details: { apiValue, groundTruth, tolerance },
    };
  } catch (err) {
    return { passed: false, message: `Failed to call revenue endpoint: ${err}`, details: {} };
  }
}

export async function at_least_four_metrics_defined(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const metricNames: string[] = meta.metric_names ?? [];
  const passed = metricNames.length >= 4;
  return {
    passed,
    message: passed
      ? `${metricNames.length} metrics defined (>= 4 required).`
      : `Only ${metricNames.length} metrics defined, expected >= 4.`,
    details: { metricNames },
  };
}

export async function definition_file_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const defFile = meta.definition_file;
  if (!defFile || typeof defFile !== "string") {
    return { passed: false, message: "definition_file not set in assertions.json.", details: {} };
  }
  const passed = existsSync(defFile);
  return {
    passed,
    message: passed
      ? `Metric definition file exists at ${defFile}.`
      : `Metric definition file not found at ${defFile}.`,
    details: { defFile },
  };
}
