import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function mvs_auto_populate_on_insert(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const targetTables = config.target_table_names || [];

  if (targetTables.length === 0) {
    return { passed: false, message: "No target tables listed in assertions.json.", details: {} };
  }

  // Find the hourly counts target table
  const hourlyTable = targetTables.find((t: string) => t.toLowerCase().includes("hourly") || t.toLowerCase().includes("hour"));
  if (!hourlyTable) {
    return { passed: false, message: "No hourly counts target table found.", details: { targetTables } };
  }

  // Use a far-future date to avoid collision with existing data
  const testDatetime = "2026-06-15 14:00:00";
  const testHour = "2026-06-15 14:00:00";

  // Check count before insert
  const beforeRows = await queryRows<{ n: number }>(
    ctx,
    `SELECT sum(trip_count) AS n FROM ${hourlyTable} WHERE pickup_hour = '${testHour}' AND taxi_type = 'yellow'`,
  );
  const beforeCount = Number(beforeRows[0]?.n ?? 0);

  // Insert a test row into the source table
  await ctx.clickhouse.command({
    query: `INSERT INTO analytics.taxi_trips VALUES ('yellow', '${testDatetime}', '${testDatetime}', 1, 5.0, 15.0, 3.0, 20.0, 1, 100, 200)`,
  });

  // Check count after insert
  const afterRows = await queryRows<{ n: number }>(
    ctx,
    `SELECT sum(trip_count) AS n FROM ${hourlyTable} WHERE pickup_hour = '${testHour}' AND taxi_type = 'yellow'`,
  );
  const afterCount = Number(afterRows[0]?.n ?? 0);

  const passed = afterCount > beforeCount;
  return {
    passed,
    message: passed
      ? "MVs auto-populate when new rows are inserted."
      : `MV did not update after insert: before=${beforeCount}, after=${afterCount}.`,
    details: { beforeCount, afterCount, hourlyTable },
  };
}
