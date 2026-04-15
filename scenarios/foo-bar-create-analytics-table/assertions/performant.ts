import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries } from "../../_shared/assertion-helpers";

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

export async function user_date_range_query_under_50ms(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const start = Date.now();
  await ctx.clickhouse.query({
    query: `SELECT user_id, count() AS n FROM ${found.database}.${found.table} WHERE event_ts BETWEEN '2026-01-15' AND '2026-01-16' GROUP BY user_id`,
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 50;
  return {
    passed,
    message: passed
      ? `User date-range query completed in ${elapsed}ms.`
      : `User date-range query took ${elapsed}ms (limit 50ms).`,
    details: { elapsedMs: elapsed },
  };
}

export async function action_duration_query_under_50ms(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const start = Date.now();
  await ctx.clickhouse.query({
    query: `SELECT action, sum(duration_ms) AS total FROM ${found.database}.${found.table} GROUP BY action`,
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 50;
  return {
    passed,
    message: passed
      ? `Action duration query completed in ${elapsed}ms.`
      : `Action duration query took ${elapsed}ms (limit 50ms).`,
    details: { elapsedMs: elapsed },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
