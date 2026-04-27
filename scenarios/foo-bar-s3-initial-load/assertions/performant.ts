import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import {
  avoidsSelectStarQueries,
  findTable,
  type TableRef,
} from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({
    query: sql,
    format: "JSONEachRow",
  });
  return (await (result as any).json()) as T[];
}

async function findOrdersTable(
  ctx: AssertionContext,
): Promise<TableRef | null> {
  const exact = await queryRows<{
    database: string;
    name: string;
    engine: string;
    total_rows: number | null;
  }>(
    ctx,
    "SELECT database, name, engine, total_rows FROM system.tables WHERE database = 'analytics' AND name = 'initial_load_orders'",
  );
  if (exact.length > 0) {
    return {
      database: exact[0].database,
      table: exact[0].name,
      engine: exact[0].engine,
      total_rows: exact[0].total_rows ?? undefined,
    };
  }

  return findTable(ctx, { concepts: ["order"] });
}

export async function target_uses_mergetree_family(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const rows = await queryRows<{ engine: string }>(
    ctx,
    `SELECT engine FROM system.tables WHERE database = '${found.database}' AND name = '${found.table}'`,
  );
  const engine = rows[0]?.engine ?? "";
  return {
    passed: engine.includes("MergeTree"),
    message: engine.includes("MergeTree")
      ? `Target table uses ${engine}.`
      : `Target table uses ${engine || "unknown"} instead of a MergeTree-family engine.`,
    details: { engine, table: `${found.database}.${found.table}` },
  };
}

export async function sorting_key_supports_incremental_verification(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const rows = await queryRows<{ sorting_key: string }>(
    ctx,
    `SELECT sorting_key FROM system.tables WHERE database = '${found.database}' AND name = '${found.table}'`,
  );
  const sortingKey = (rows[0]?.sorting_key ?? "")
    .toLowerCase()
    .replace(/_/g, "");
  const passed =
    sortingKey.includes("orderts") || sortingKey.includes("orderid");
  return {
    passed,
    message: passed
      ? `Sorting key supports order timestamp or ID checks: ${rows[0]?.sorting_key ?? ""}.`
      : `Sorting key should include order_ts or order_id for incremental verification; got ${rows[0]?.sorting_key ?? ""}.`,
    details: { sortingKey: rows[0]?.sorting_key ?? "" },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
