import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findUserActivityTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function resolveColumn(
  ctx: AssertionContext,
  database: string,
  table: string,
  ...candidates: string[]
): Promise<string | null> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    `SELECT name FROM system.columns WHERE database = '${database}' AND table = '${table}' AND lower(name) IN (${candidates.map((c) => `'${c.toLowerCase()}'`).join(",")})`,
  );
  return rows.length > 0 ? rows[0].name : null;
}

export async function table_accepts_zero_duration(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const col = await resolveColumn(ctx, found.database, found.table, "duration_ms", "durationms", "durationMs");
  if (!col) {
    return { passed: false, message: "No duration column found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table} WHERE \`${col}\` = 0`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed
      ? `Table has ${count} rows with zero duration.`
      : "No rows with zero duration found — nullable defaults may not be handled.",
    details: { count, column: col },
  };
}

export async function no_null_event_ids(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const col = await resolveColumn(ctx, found.database, found.table, "event_id", "eventid", "eventId");
  if (!col) {
    return { passed: false, message: "No event_id column found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table} WHERE \`${col}\` = '' OR \`${col}\` IS NULL`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed ? "No null/empty event IDs." : `Found ${count} null/empty event IDs.`,
    details: { count, column: col },
  };
}
