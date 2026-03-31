import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function no_duplicate_order_ids(ctx: AssertionContext): Promise<AssertionResult> {
  // Check that FINAL deduplication produces exactly 1 row per order_id.
  // If the agent didn't set up ReplacingMergeTree (or equivalent), duplicates will appear.
  const dupsRows = await queryRows<{ order_id: string; n: number }>(
    ctx,
    "SELECT order_id, count() AS n FROM analytics.orders FINAL GROUP BY order_id HAVING n > 1",
  );
  const passed = dupsRows.length === 0;
  return {
    passed,
    message: passed
      ? "No duplicate order IDs after FINAL."
      : `${dupsRows.length} order IDs have duplicates after FINAL.`,
    details: { duplicateCount: dupsRows.length, examples: dupsRows.slice(0, 5) },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
