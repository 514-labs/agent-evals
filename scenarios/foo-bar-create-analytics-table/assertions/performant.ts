import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, findUserActivityTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function order_by_key_supports_date_range_queries(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const rows = await queryRows<{ sorting_key: string }>(
    ctx,
    `SELECT sorting_key FROM system.tables WHERE database = '${found.database}' AND name = '${found.table}'`,
  );
  const sortingKey = rows[0]?.sorting_key ?? "";
  const keyColumns = sortingKey.split(",").map((c) => c.trim().toLowerCase());

  // event_ts (or eventTs in Moose) should appear in the ORDER BY key for efficient date-range filtering.
  const hasEventTs = keyColumns.some((c) => c.includes("event_ts") || c.includes("eventts"));
  return {
    passed: hasEventTs,
    message: hasEventTs
      ? `ORDER BY key includes event_ts for date-range queries: ${sortingKey}`
      : `ORDER BY key (${sortingKey}) does not include event_ts — date-range queries will scan all granules.`,
    details: { sortingKey, keyColumns },
  };
}

export async function order_by_key_is_not_single_column(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const rows = await queryRows<{ sorting_key: string }>(
    ctx,
    `SELECT sorting_key FROM system.tables WHERE database = '${found.database}' AND name = '${found.table}'`,
  );
  const sortingKey = rows[0]?.sorting_key ?? "";
  const keyColumns = sortingKey.split(",").map((c) => c.trim()).filter((c) => c.length > 0);

  const passed = keyColumns.length >= 2;
  return {
    passed,
    message: passed
      ? `ORDER BY key has ${keyColumns.length} columns: ${sortingKey}`
      : `ORDER BY key has only ${keyColumns.length} column (${sortingKey}) — a compound key would better serve both query patterns.`,
    details: { sortingKey, keyColumns, columnCount: keyColumns.length },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
