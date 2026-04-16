import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findEventsTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function target_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  const passed = found !== null;
  return {
    passed,
    message: passed
      ? `Target table exists at ${found!.database}.${found!.table}.`
      : "Events table not found in any database.",
    details: { found },
  };
}

export async function table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? `Table has ${count} rows.` : "Table is empty.",
    details: { count, location: `${found.database}.${found.table}` },
  };
}
