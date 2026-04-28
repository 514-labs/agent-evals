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

export async function manifest_row_count_matches(
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
    passed: count === 600_000,
    message:
      count === 600_000
        ? "Loaded row count matches manifest."
        : `Expected 600000 rows, got ${count}.`,
    details: { expected: 600_000, actual: count },
  };
}

export async function order_amount_checksum_matches(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const amountCol = await resolveColumn(
    ctx,
    found.database,
    found.table,
    "amount_cents",
    "amountCents",
    "amount",
  );
  if (!amountCol) {
    return { passed: false, message: "Amount column not found.", details: {} };
  }

  const rows = await queryRows<{ amount_sum: number }>(
    ctx,
    `SELECT sum(toInt64OrZero(toString(\`${amountCol}\`))) AS amount_sum FROM ${found.database}.${found.table}`,
  );
  const actual = Number(rows[0]?.amount_sum ?? 0);
  return {
    passed: actual === 904_799_879,
    message:
      actual === 904_799_879
        ? "Amount checksum matches manifest-selected source rows."
        : `Expected amount checksum 904799879, got ${actual}.`,
    details: { expected: 904_799_879, actual, column: amountCol },
  };
}

export async function status_distribution_matches(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findOrdersTable(ctx);
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }

  const statusCol = await resolveColumn(
    ctx,
    found.database,
    found.table,
    "status",
  );
  if (!statusCol) {
    return { passed: false, message: "Status column not found.", details: {} };
  }

  const rows = await queryRows<{
    paid: number;
    refunded: number;
    failed: number;
  }>(
    ctx,
    `SELECT
       sum(if(\`${statusCol}\` = 'paid', 1, 0)) AS paid,
       sum(if(\`${statusCol}\` = 'refunded', 1, 0)) AS refunded,
       sum(if(\`${statusCol}\` = 'failed', 1, 0)) AS failed
     FROM ${found.database}.${found.table}`,
  );
  const actual = {
    paid: Number(rows[0]?.paid ?? 0),
    refunded: Number(rows[0]?.refunded ?? 0),
    failed: Number(rows[0]?.failed ?? 0),
  };
  const expected = { paid: 552_070, refunded: 30_032, failed: 17_898 };
  const passed =
    actual.paid === expected.paid &&
    actual.refunded === expected.refunded &&
    actual.failed === expected.failed;
  return {
    passed,
    message: passed
      ? "Status distribution matches manifest-selected source rows."
      : `Expected paid=${expected.paid}, refunded=${expected.refunded}, failed=${expected.failed}; got paid=${actual.paid}, refunded=${actual.refunded}, failed=${actual.failed}.`,
    details: {
      expected,
      actual,
      column: statusCol,
    },
  };
}
