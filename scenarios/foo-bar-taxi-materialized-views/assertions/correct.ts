import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function daily_revenue_matches_ground_truth(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const targetTables = config.target_table_names || [];

  // Find the daily revenue target table
  const revenueTable = targetTables.find((t: string) => t.toLowerCase().includes("daily") || t.toLowerCase().includes("revenue"));
  if (!revenueTable) {
    return { passed: false, message: "No daily revenue target table found in assertions.json.", details: { targetTables } };
  }

  // Pick a known date — 2024-01-15 should have data
  const testDate = "2024-01-15";

  // Ground truth from source table
  const sourceRows = await queryRows<{ total: number }>(
    ctx,
    `SELECT sum(fare_amount) AS total FROM analytics.taxi_trips WHERE toDate(pickup_datetime) = '${testDate}' AND taxi_type = 'yellow'`,
  );
  const sourceTotal = Number(sourceRows[0]?.total ?? 0);

  // MV target table
  const mvRows = await queryRows<{ total: number }>(
    ctx,
    `SELECT sum(total_fare) AS total FROM ${revenueTable} WHERE pickup_date = '${testDate}' AND taxi_type = 'yellow'`,
  );
  const mvTotal = Number(mvRows[0]?.total ?? 0);

  const passed = sourceTotal > 0 && Math.abs(sourceTotal - mvTotal) < 0.01;
  return {
    passed,
    message: passed
      ? `Daily revenue for yellow on ${testDate} matches: ${mvTotal.toFixed(2)}.`
      : `Daily revenue mismatch on ${testDate}: source=${sourceTotal.toFixed(2)}, mv=${mvTotal.toFixed(2)}.`,
    details: { testDate, sourceTotal, mvTotal },
  };
}

export async function fare_buckets_sum_matches_total(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const targetTables = config.target_table_names || [];

  // Find the fare buckets target table
  const bucketsTable = targetTables.find((t: string) => t.toLowerCase().includes("bucket") || t.toLowerCase().includes("fare") || t.toLowerCase().includes("dist"));
  if (!bucketsTable) {
    return { passed: false, message: "No fare buckets target table found in assertions.json.", details: { targetTables } };
  }

  // Total rows in source
  const sourceRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.taxi_trips",
  );
  const sourceCount = Number(sourceRows[0]?.n ?? 0);

  // Sum of bucket counts
  const bucketRows = await queryRows<{ total: number }>(
    ctx,
    `SELECT sum(trip_count) AS total FROM ${bucketsTable}`,
  );
  const bucketTotal = Number(bucketRows[0]?.total ?? 0);

  const passed = sourceCount > 0 && sourceCount === bucketTotal;
  return {
    passed,
    message: passed
      ? `Fare bucket counts sum (${bucketTotal}) matches source total (${sourceCount}).`
      : `Fare bucket sum mismatch: source=${sourceCount}, buckets=${bucketTotal}.`,
    details: { sourceCount, bucketTotal },
  };
}

export async function hourly_counts_sum_matches_total(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const targetTables = config.target_table_names || [];

  // Find the hourly counts target table
  const hourlyTable = targetTables.find((t: string) => t.toLowerCase().includes("hourly") || t.toLowerCase().includes("hour"));
  if (!hourlyTable) {
    return { passed: false, message: "No hourly counts target table found in assertions.json.", details: { targetTables } };
  }

  // Total rows in source
  const sourceRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.taxi_trips",
  );
  const sourceCount = Number(sourceRows[0]?.n ?? 0);

  // Sum of hourly counts
  const hourlyRows = await queryRows<{ total: number }>(
    ctx,
    `SELECT sum(trip_count) AS total FROM ${hourlyTable}`,
  );
  const hourlyTotal = Number(hourlyRows[0]?.total ?? 0);

  const passed = sourceCount > 0 && sourceCount === hourlyTotal;
  return {
    passed,
    message: passed
      ? `Hourly counts sum (${hourlyTotal}) matches source total (${sourceCount}).`
      : `Hourly counts sum mismatch: source=${sourceCount}, hourly=${hourlyTotal}.`,
    details: { sourceCount, hourlyTotal },
  };
}
