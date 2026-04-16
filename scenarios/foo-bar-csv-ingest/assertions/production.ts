import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findEventsTable, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function no_temporary_tables(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findEventsTable(ctx);
  const db = found?.database ?? "analytics";
  const result = await ctx.clickhouse.query({
    query: `SELECT count() AS n FROM system.tables WHERE database = '${db}' AND name LIKE '%tmp%'`,
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ n: number }>;
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 0;
  return {
    passed,
    message: passed ? "No temporary tables." : `Found ${count} tmp tables.`,
    details: { count },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
