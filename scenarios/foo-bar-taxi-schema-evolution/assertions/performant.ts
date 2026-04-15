import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function count_query_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.migrated_table_name;
  if (!tableName) {
    return { passed: false, message: "migrated_table_name not set.", details: {} };
  }

  const parts = tableName.split(".");
  const db = parts.length === 2 ? parts[0] : "analytics";
  const table = parts.length === 2 ? parts[1] : parts[0];

  const start = Date.now();
  await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${db}.${table}`);
  const elapsed = Date.now() - start;
  const passed = elapsed < 500;
  return {
    passed,
    message: passed
      ? `Count query completed in ${elapsed}ms (< 500ms).`
      : `Count query took ${elapsed}ms (expected < 500ms).`,
    details: { elapsedMs: elapsed },
  };
}

export async function aggregation_query_under_2s(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.migrated_table_name;
  if (!tableName) {
    return { passed: false, message: "migrated_table_name not set.", details: {} };
  }

  const parts = tableName.split(".");
  const db = parts.length === 2 ? parts[0] : "analytics";
  const table = parts.length === 2 ? parts[1] : parts[0];

  const start = Date.now();
  await queryRows<{ avg_fare: number }>(
    ctx,
    `SELECT payment_type, round(avg(fare_amount), 2) AS avg_fare
     FROM ${db}.${table}
     GROUP BY payment_type
     ORDER BY avg_fare DESC`,
  );
  const elapsed = Date.now() - start;
  const passed = elapsed < 2000;
  return {
    passed,
    message: passed
      ? `Aggregation query completed in ${elapsed}ms (< 2s).`
      : `Aggregation query took ${elapsed}ms (expected < 2s).`,
    details: { elapsedMs: elapsed },
  };
}
