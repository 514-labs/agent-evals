import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function readAssertionsJson(): Record<string, any> {
  return JSON.parse(readFileSync("/workspace/assertions.json", "utf8"));
}

export async function no_null_primary_keys(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const db = meta.database_name;
  const table = meta.table_name;
  if (!db || !table) {
    return { passed: false, message: "database_name or table_name not set in assertions.json.", details: {} };
  }
  // Check that pickup_datetime (the most likely primary key component) is never the zero-value
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${db}.${table} WHERE pickup_datetime = '1970-01-01 00:00:00' OR pickup_datetime IS NULL`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed
      ? "No null or zero-value primary key columns found."
      : `Found ${count} rows with null/zero pickup_datetime.`,
    details: { count },
  };
}

export async function negative_fares_handled(ctx: AssertionContext): Promise<AssertionResult> {
  const meta = readAssertionsJson();
  const db = meta.database_name;
  const table = meta.table_name;
  if (!db || !table) {
    return { passed: false, message: "database_name or table_name not set in assertions.json.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${db}.${table} WHERE fare_amount < 0`,
  );
  const count = Number(rows[0]?.n ?? 0);
  // Negative fares should be excluded or at least flagged in some way.
  // If the agent excluded them, count will be 0.
  // If the agent kept them but flagged them (e.g. a quality column), we still pass
  // as long as the raw negative count is 0 in the final table.
  const passed = count === 0;
  return {
    passed,
    message: passed
      ? "No negative fare amounts in the loaded data."
      : `Found ${count} rows with negative fare_amount -- these should be excluded or flagged.`,
    details: { negativeCount: count },
  };
}
