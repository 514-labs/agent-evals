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

export async function table_accepts_zero_duration(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table} WHERE duration_ms = 0`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed
      ? `Table has ${count} rows with zero duration.`
      : "No rows with zero duration found — nullable defaults may not be handled.",
    details: { count },
  };
}

export async function no_null_event_ids(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table} WHERE event_id = '' OR event_id IS NULL`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed ? "No null/empty event IDs." : `Found ${count} null/empty event IDs.`,
    details: { count },
  };
}
