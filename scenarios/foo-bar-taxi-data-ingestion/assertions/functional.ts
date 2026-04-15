import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function assertions_json_filled(ctx: AssertionContext): Promise<AssertionResult> {
  let meta: Record<string, any>;
  try {
    meta = readAssertionsJson();
  } catch (err) {
    return { passed: false, message: "Could not read /workspace/assertions.json.", details: { error: String(err) } };
  }
  const hasTable = typeof meta.table_name === "string" && meta.table_name.length > 0;
  const hasDb = typeof meta.database_name === "string" && meta.database_name.length > 0;
  const hasCount = typeof meta.total_row_count === "number" && meta.total_row_count > 0;
  const passed = hasTable && hasDb && hasCount;
  return {
    passed,
    message: passed
      ? "assertions.json is filled with table_name, database_name, and total_row_count."
      : "assertions.json is missing or has empty fields.",
    details: { table_name: meta.table_name, database_name: meta.database_name, total_row_count: meta.total_row_count },
  };
}

export async function declared_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  let meta: Record<string, any>;
  try {
    meta = readAssertionsJson();
  } catch {
    return { passed: false, message: "Could not read assertions.json to discover table name.", details: {} };
  }
  const db = meta.database_name;
  const table = meta.table_name;
  if (!db || !table) {
    return { passed: false, message: "database_name or table_name not set in assertions.json.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM system.tables WHERE database = '${db}' AND name = '${table}'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? `Table ${db}.${table} exists.` : `Table ${db}.${table} not found.`,
    details: { database: db, table, count },
  };
}
