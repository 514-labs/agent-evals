import { existsSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function orders_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx, { concepts: ["order"] });
  const passed = found !== null && found.table.toLowerCase().includes("order");
  return {
    passed,
    message: passed
      ? `Orders table exists at ${found!.database}.${found!.table}.`
      : "Orders table not found in any user database — has the Moose project been wiped?",
    details: { found },
  };
}

export async function orders_table_has_three_million_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx, { concepts: ["order"] });
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM \`${found.database}\`.\`${found.table}\``,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 3000000;
  return {
    passed,
    message: passed
      ? `Orders has 3,000,000 rows.`
      : `Expected 3,000,000 rows in ${found.database}.${found.table}, got ${count}.`,
    details: { expected: 3000000, actual: count, location: `${found.database}.${found.table}` },
  };
}

export async function slow_query_file_present(): Promise<AssertionResult> {
  const path = "/workspace/queries/top_orders_by_sku.sql";
  const passed = existsSync(path);
  return {
    passed,
    message: passed
      ? `Planted slow query is present at ${path}.`
      : `Expected planted slow query at ${path} but it is missing — did the agent delete or move it?`,
    details: { path, exists: passed },
  };
}
