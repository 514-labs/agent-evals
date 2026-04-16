import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findUserActivityTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function base_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  const passed = found !== null;
  return {
    passed,
    message: passed
      ? `Base table exists at ${found!.database}.${found!.table}.`
      : "User activity base table not found in any database.",
    details: { found },
  };
}

export async function base_table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Base table not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 10;
  return {
    passed,
    message: passed ? `Base table has ${count} rows.` : `Expected at least 10 rows, got ${count}.`,
    details: { count },
  };
}

export async function at_least_one_materialized_view_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    `SELECT name FROM system.tables
     WHERE engine LIKE '%MergeTree%'
       AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
       AND name != (SELECT name FROM system.tables WHERE lower(name) LIKE '%user_activity%' OR lower(name) LIKE '%useractivity%' LIMIT 1)`,
  );
  // Also check for actual MV objects
  const mvRows = await queryRows<{ name: string }>(
    ctx,
    `SELECT name FROM system.tables
     WHERE engine = 'MaterializedView'
       AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')`,
  );
  const allTargets = [...new Set([...rows.map((r) => r.name), ...mvRows.map((r) => r.name)])];
  const passed = allTargets.length >= 1;
  return {
    passed,
    message: passed
      ? `Found ${allTargets.length} MV target(s): ${allTargets.join(", ")}.`
      : "No materialized view targets found.",
    details: { tables: allTargets },
  };
}
