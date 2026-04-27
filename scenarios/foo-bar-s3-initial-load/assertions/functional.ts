import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import {
  findTable,
  resolveColumn,
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

export async function target_orders_table_exists(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  return {
    passed: found !== null,
    message: found
      ? `Orders table exists at ${found.database}.${found.table}.`
      : "No orders table found. Expected analytics.initial_load_orders or another non-system orders table.",
    details: { found },
  };
}

export async function target_table_has_rows(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  return {
    passed: count > 0,
    message:
      count > 0 ? `Orders table has ${count} rows.` : "Orders table is empty.",
    details: { count, table: `${found.database}.${found.table}` },
  };
}

export async function required_order_columns_exist(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const expected = [
    ["order_id", "orderId"],
    ["order_ts", "orderTs", "timestamp"],
    ["customer_id", "customerId"],
    ["amount_cents", "amountCents", "amount"],
    ["status"],
    ["channel"],
    ["country"],
    ["promo_code", "promoCode"],
    ["source_object", "sourceObject", "object_key", "objectKey"],
  ];

  const missing: string[] = [];
  const resolved: Record<string, string> = {};
  for (const candidates of expected) {
    const column = await resolveColumn(
      ctx,
      found.database,
      found.table,
      ...candidates,
    );
    if (!column) {
      missing.push(candidates[0]);
    } else {
      resolved[candidates[0]] = column;
    }
  }

  return {
    passed: missing.length === 0,
    message:
      missing.length === 0
        ? "All required order columns exist."
        : `Missing required columns: ${missing.join(", ")}.`,
    details: { missing, resolved, table: `${found.database}.${found.table}` },
  };
}
