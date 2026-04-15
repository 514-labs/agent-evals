import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";
import { readFileSync } from "node:fs";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function assertions_json_filled(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const hasTable = typeof config.migrated_table_name === "string" && config.migrated_table_name.length > 0;
  const hasColumns = Array.isArray(config.new_columns) && config.new_columns.length > 0;
  const hasRows = typeof config.total_rows_after_migration === "number" && config.total_rows_after_migration > 0;
  const passed = hasTable && hasColumns && hasRows;
  return {
    passed,
    message: passed
      ? "assertions.json is filled with valid values."
      : "assertions.json is missing or has empty fields.",
    details: { hasTable, hasColumns, hasRows, config },
  };
}

export async function migrated_table_exists_with_data(ctx: AssertionContext): Promise<AssertionResult> {
  const config = readAssertionsJson();
  const tableName = config.migrated_table_name;
  if (!tableName) {
    return { passed: false, message: "migrated_table_name not set in assertions.json.", details: {} };
  }

  // Split database.table
  const parts = tableName.split(".");
  const db = parts.length === 2 ? parts[0] : "analytics";
  const table = parts.length === 2 ? parts[1] : parts[0];

  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${db}.${table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  // Expect both months: Jan (~3M) + Feb (~3M) ≈ ~6M
  const passed = count > 4_000_000;
  return {
    passed,
    message: passed
      ? `Migrated table has ${count} rows (both months loaded).`
      : `Migrated table has only ${count} rows (expected > 4M for both months).`,
    details: { count, tableName },
  };
}
