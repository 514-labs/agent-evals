import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function projection_is_materialized_for_existing_data(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const found = await findTable(ctx, { concepts: ["order"] });
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }
  const rows = await queryRows<{ projection_rows: number; main_rows: number }>(
    ctx,
    `WITH
       (SELECT sum(rows) FROM system.projection_parts
        WHERE database = '${found.database}' AND table = '${found.table}' AND active = 1) AS projection_rows,
       (SELECT count() FROM \`${found.database}\`.\`${found.table}\`) AS main_rows
     SELECT projection_rows, main_rows`,
  );
  const projRows = Number(rows[0]?.projection_rows ?? 0);
  const mainRows = Number(rows[0]?.main_rows ?? 0);
  const coverage = mainRows > 0 ? projRows / mainRows : 0;
  const passed = coverage >= 0.99;
  return {
    passed,
    message: passed
      ? `Projection covers ${(coverage * 100).toFixed(1)}% of existing rows (${projRows} of ${mainRows}).`
      : projRows === 0
        ? `Projection is declared but has zero materialized parts. ADD PROJECTION only covers new inserts; you need ALTER TABLE ${found.table} MATERIALIZE PROJECTION <name> to backfill the existing ${mainRows} rows.`
        : `Projection covers only ${(coverage * 100).toFixed(1)}% of existing rows (${projRows} of ${mainRows}). Existing parts are still being scanned for productSku queries.`,
    details: { projection_rows: projRows, main_rows: mainRows, coverage },
  };
}

export async function order_by_unchanged(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx, { concepts: ["order"] });
  if (!found) {
    return { passed: false, message: "Orders table not found.", details: {} };
  }
  const rows = await queryRows<{ sorting_key: string }>(
    ctx,
    `SELECT sorting_key FROM system.tables
     WHERE database = '${found.database}' AND name = '${found.table}'`,
  );
  const sortingKey = (rows[0]?.sorting_key ?? "").trim();
  const matchesPrimary =
    sortingKey.includes("customerId") && sortingKey.includes("orderTs");
  return {
    passed: matchesPrimary,
    message: matchesPrimary
      ? `Orders ORDER BY is preserved: ${sortingKey}.`
      : `Orders ORDER BY changed to "${sortingKey}". The primary access pattern (customer history) must remain optimized — express the productSku access pattern as a projection, not a new ORDER BY.`,
    details: { sorting_key: sortingKey },
  };
}
