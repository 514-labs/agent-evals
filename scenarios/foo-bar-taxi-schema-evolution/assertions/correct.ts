import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function row_count_matches_both_months(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.migrated_table_name;
  if (!tableName) {
    return { passed: false, message: "migrated_table_name not set.", details: {} };
  }

  const parts = tableName.split(".");
  const db = parts.length === 2 ? parts[0] : "analytics";
  const table = parts.length === 2 ? parts[1] : parts[0];

  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${db}.${table}`);
  const count = Number(rows[0]?.n ?? 0);
  // Jan 2024 yellow: ~2.96M, Feb 2024 yellow: ~2.94M → combined ~5.9M
  const passed = count >= 5_000_000 && count <= 7_000_000;
  return {
    passed,
    message: passed
      ? `Row count ${count} is in expected range (5M-7M).`
      : `Row count ${count} outside expected range (5M-7M).`,
    details: { count },
  };
}

export async function old_rows_have_default_congestion_surcharge(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.migrated_table_name;
  if (!tableName) {
    return { passed: false, message: "migrated_table_name not set.", details: {} };
  }

  const parts = tableName.split(".");
  const db = parts.length === 2 ? parts[0] : "analytics";
  const table = parts.length === 2 ? parts[1] : parts[0];

  // Jan 2024 data has pickup dates in January
  const rows = await queryRows<{ non_zero: number }>(
    ctx,
    `SELECT count() AS non_zero FROM ${db}.${table}
     WHERE toMonth(tpep_pickup_datetime) = 1 AND toYear(tpep_pickup_datetime) = 2024
       AND congestion_surcharge != 0`,
  );
  const nonZeroCount = Number(rows[0]?.non_zero ?? 0);
  const passed = nonZeroCount === 0;
  return {
    passed,
    message: passed
      ? "All January rows have congestion_surcharge = 0 (correct backfill)."
      : `${nonZeroCount} January rows have non-zero congestion_surcharge.`,
    details: { nonZeroCount },
  };
}

export async function payment_type_is_string(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.migrated_table_name;
  if (!tableName) {
    return { passed: false, message: "migrated_table_name not set.", details: {} };
  }

  const parts = tableName.split(".");
  const db = parts.length === 2 ? parts[0] : "analytics";
  const table = parts.length === 2 ? parts[1] : parts[0];

  const rows = await queryRows<{ type: string }>(
    ctx,
    `SELECT type FROM system.columns WHERE database = '${db}' AND table = '${table}' AND name = 'payment_type'`,
  );
  const colType = rows[0]?.type ?? "NOT_FOUND";
  const passed = colType.toLowerCase().includes("string");
  return {
    passed,
    message: passed
      ? `payment_type is ${colType} (String type confirmed).`
      : `payment_type is ${colType} (expected String).`,
    details: { colType },
  };
}
