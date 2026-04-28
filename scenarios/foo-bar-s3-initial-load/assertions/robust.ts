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

export async function no_duplicate_order_ids(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const orderIdCol = await resolveColumn(
    ctx,
    found.database,
    found.table,
    "order_id",
    "orderId",
  );
  if (!orderIdCol) {
    return {
      passed: false,
      message: "Order ID column not found.",
      details: {},
    };
  }

  const rows = await queryRows<{ duplicate_ids: number }>(
    ctx,
    `SELECT count() AS duplicate_ids
     FROM (
       SELECT \`${orderIdCol}\`
       FROM ${found.database}.${found.table}
       GROUP BY \`${orderIdCol}\`
       HAVING count() > 1
     )`,
  );
  const duplicateIds = Number(rows[0]?.duplicate_ids ?? 0);
  return {
    passed: duplicateIds === 0,
    message:
      duplicateIds === 0
        ? "No duplicate order IDs."
        : `Found ${duplicateIds} duplicate order IDs.`,
    details: { duplicateIds, column: orderIdCol },
  };
}

export async function replayed_object_was_not_loaded(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const sourceCol = await resolveColumn(
    ctx,
    found.database,
    found.table,
    "source_object",
    "sourceObject",
    "object_key",
    "objectKey",
  );
  if (!sourceCol) {
    return {
      passed: false,
      message: "Source object lineage column not found.",
      details: {},
    };
  }

  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n
     FROM ${found.database}.${found.table}
     WHERE position(toString(\`${sourceCol}\`), 'archive/replayed') > 0`,
  );
  const count = Number(rows[0]?.n ?? 0);
  return {
    passed: count === 0,
    message:
      count === 0
        ? "Replay/archive object was not loaded."
        : `Found ${count} rows from replay/archive objects.`,
    details: { count, column: sourceCol },
  };
}

export async function manifest_source_object_count_matches(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const sourceCol = await resolveColumn(
    ctx,
    found.database,
    found.table,
    "source_object",
    "sourceObject",
    "object_key",
    "objectKey",
  );
  if (!sourceCol) {
    return {
      passed: false,
      message: "Source object lineage column not found.",
      details: {},
    };
  }

  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT uniqExact(toString(\`${sourceCol}\`)) AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  return {
    passed: count === 15,
    message:
      count === 15
        ? "Loaded rows reference all 15 manifest-approved source objects."
        : `Expected 15 source objects, got ${count}.`,
    details: { expected: 15, actual: count, column: sourceCol },
  };
}
