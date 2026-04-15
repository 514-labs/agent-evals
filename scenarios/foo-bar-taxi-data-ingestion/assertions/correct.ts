import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function yellow_row_count_approximately_3m(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const db = meta.database_name;
  const table = meta.table_name;
  if (!db || !table) {
    return { passed: false, message: "database_name or table_name not set in assertions.json.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${db}.${table} WHERE taxi_type = 'yellow'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const expected = 2964624;
  const tolerance = expected * 0.05;
  const passed = Math.abs(count - expected) <= tolerance;
  return {
    passed,
    message: passed
      ? `Yellow row count ${count} is within 5% of expected ${expected}.`
      : `Yellow row count ${count} is outside 5% tolerance of expected ${expected}.`,
    details: { count, expected, tolerance },
  };
}

export async function green_row_count_approximately_80k(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const db = meta.database_name;
  const table = meta.table_name;
  if (!db || !table) {
    return { passed: false, message: "database_name or table_name not set in assertions.json.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${db}.${table} WHERE taxi_type = 'green'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const expected = 85046;
  const tolerance = expected * 0.05;
  const passed = Math.abs(count - expected) <= tolerance;
  return {
    passed,
    message: passed
      ? `Green row count ${count} is within 5% of expected ${expected}.`
      : `Green row count ${count} is outside 5% tolerance of expected ${expected}.`,
    details: { count, expected, tolerance },
  };
}

export async function both_taxi_types_present(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const db = meta.database_name;
  const table = meta.table_name;
  if (!db || !table) {
    return { passed: false, message: "database_name or table_name not set in assertions.json.", details: {} };
  }
  const rows = await queryRows<{ taxi_type: string }>(
    ctx,
    `SELECT DISTINCT taxi_type FROM ${db}.${table} ORDER BY taxi_type`,
  );
  const types = rows.map((r) => r.taxi_type).sort();
  const passed = types.includes("green") && types.includes("yellow");
  return {
    passed,
    message: passed
      ? "Both yellow and green taxi types are present."
      : `Expected both yellow and green, found: ${types.join(", ")}.`,
    details: { types },
  };
}
