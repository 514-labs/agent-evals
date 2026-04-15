import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function group_by_taxi_type_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const db = meta.database_name;
  const table = meta.table_name;
  if (!db || !table) {
    return { passed: false, message: "database_name or table_name not set in assertions.json.", details: {} };
  }
  const start = Date.now();
  await ctx.clickhouse.query({
    query: `SELECT taxi_type, count() AS trips, avg(fare_amount) AS avg_fare, sum(total_amount) AS total_rev FROM ${db}.${table} GROUP BY taxi_type`,
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed
      ? `GROUP BY taxi_type aggregation completed in ${elapsed}ms (< 200ms).`
      : `GROUP BY taxi_type aggregation took ${elapsed}ms (expected < 200ms).`,
    details: { elapsedMs: elapsed },
  };
}
