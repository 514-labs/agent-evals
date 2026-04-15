import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function findTable(ctx: AssertionContext): Promise<{ database: string; table: string } | null> {
  const rows = await queryRows<{ database: string; name: string }>(
    ctx,
    "SELECT database, name FROM system.tables WHERE name = 'user_activity' AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')",
  );
  return rows.length > 0 ? { database: rows[0].database, table: rows[0].name } : null;
}

export async function target_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx);
  const passed = found !== null;
  return {
    passed,
    message: passed
      ? `Target table exists at ${found!.database}.${found!.table}.`
      : "Table user_activity not found in any database.",
    details: { found },
  };
}

export async function table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
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
