import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function hourly_counts_query_under_50ms(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const targetTables = config.target_table_names || [];
  const hourlyTable = targetTables.find((t: string) => t.toLowerCase().includes("hourly") || t.toLowerCase().includes("hour"));
  if (!hourlyTable) {
    return { passed: false, message: "No hourly counts target table found.", details: { targetTables } };
  }

  const start = Date.now();
  await queryRows(ctx, `SELECT pickup_hour, taxi_type, trip_count FROM ${hourlyTable} ORDER BY pickup_hour DESC LIMIT 24`);
  const elapsed = Date.now() - start;
  const passed = elapsed < 50;
  return {
    passed,
    message: passed ? `Hourly counts query took ${elapsed}ms.` : `Hourly counts query took ${elapsed}ms (limit 50ms).`,
    details: { elapsedMs: elapsed },
  };
}

export async function daily_revenue_query_under_50ms(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const targetTables = config.target_table_names || [];
  const revenueTable = targetTables.find((t: string) => t.toLowerCase().includes("daily") || t.toLowerCase().includes("revenue"));
  if (!revenueTable) {
    return { passed: false, message: "No daily revenue target table found.", details: { targetTables } };
  }

  const start = Date.now();
  await queryRows(ctx, `SELECT pickup_date, taxi_type, total_fare FROM ${revenueTable} ORDER BY pickup_date DESC LIMIT 30`);
  const elapsed = Date.now() - start;
  const passed = elapsed < 50;
  return {
    passed,
    message: passed ? `Daily revenue query took ${elapsed}ms.` : `Daily revenue query took ${elapsed}ms (limit 50ms).`,
    details: { elapsedMs: elapsed },
  };
}

export async function fare_buckets_query_under_50ms(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const targetTables = config.target_table_names || [];
  const bucketsTable = targetTables.find((t: string) => t.toLowerCase().includes("bucket") || t.toLowerCase().includes("fare") || t.toLowerCase().includes("dist"));
  if (!bucketsTable) {
    return { passed: false, message: "No fare buckets target table found.", details: { targetTables } };
  }

  const start = Date.now();
  await queryRows(ctx, `SELECT fare_bucket, trip_count FROM ${bucketsTable} ORDER BY fare_bucket`);
  const elapsed = Date.now() - start;
  const passed = elapsed < 50;
  return {
    passed,
    message: passed ? `Fare buckets query took ${elapsed}ms.` : `Fare buckets query took ${elapsed}ms (limit 50ms).`,
    details: { elapsedMs: elapsed },
  };
}
