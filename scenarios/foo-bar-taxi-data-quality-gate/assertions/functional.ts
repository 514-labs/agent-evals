import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { readFileSync } from "node:fs";

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function valid_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.valid_table_name;
  if (!tableName) {
    return { passed: false, message: "valid_table_name not set in assertions.json.", details: {} };
  }

  const parts = tableName.includes(".") ? tableName.split(".") : ["default", tableName];
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM system.tables WHERE database = '${parts[0]}' AND name = '${parts[1]}'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Valid trips table exists." : `Valid trips table '${tableName}' not found.`,
    details: { tableName, count },
  };
}

export async function rejected_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.rejected_table_name;
  if (!tableName) {
    return { passed: false, message: "rejected_table_name not set in assertions.json.", details: {} };
  }

  const parts = tableName.includes(".") ? tableName.split(".") : ["default", tableName];
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM system.tables WHERE database = '${parts[0]}' AND name = '${parts[1]}'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? "Rejected trips table exists." : `Rejected trips table '${tableName}' not found.`,
    details: { tableName, count },
  };
}

export async function valid_table_has_millions_of_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.valid_table_name;
  if (!tableName) {
    return { passed: false, message: "valid_table_name not set in assertions.json.", details: {} };
  }

  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM ${tableName}`);
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 1000000;
  return {
    passed,
    message: passed ? `Valid table has ${count} rows.` : `Expected >1M rows, got ${count}.`,
    details: { count },
  };
}
