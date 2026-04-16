import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findEventsTable } from "../../_shared/assertion-helpers";

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

export async function no_duplicate_header_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found.", details: {} };
  }
  const col = await resolveColumn(ctx, found.database, found.table, "event_id", "eventid", "eventId");
  if (!col) {
    return { passed: false, message: "No event_id column found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table} WHERE \`${col}\` = 'event_id'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed ? "No duplicate header rows." : `Found ${count} header rows.`,
    details: { count },
  };
}

export async function null_values_handled(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Events table not found.", details: {} };
  }
  const col = await resolveColumn(ctx, found.database, found.table, "value", "val");
  if (!col) {
    return { passed: false, message: "No value column found.", details: {} };
  }
  const rows = await queryRows<{ min_val: number }>(
    ctx,
    `SELECT min(\`${col}\`) AS min_val FROM ${found.database}.${found.table}`,
  );
  const minVal = Number(rows[0]?.min_val ?? -1);
  const passed = minVal >= 0;
  return {
    passed,
    message: passed ? "Null values handled." : `Min value ${minVal} indicates null handling issue.`,
    details: { minVal, column: col },
  };
}
