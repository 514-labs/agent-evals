import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function row_count_unchanged(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query("SELECT count(*) AS n FROM app.orders");
  const count = Number(result.rows[0]?.n ?? 0);
  const passed = count === 500000;
  return {
    passed,
    message: passed ? "Row count unchanged." : `Expected 500000, got ${count}.`,
    details: { count },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}

export async function indexes_are_valid(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(`
    SELECT ic.relname AS index_name, ix.indisvalid
    FROM pg_class t
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    JOIN pg_index ix ON ix.indrelid = t.oid
    JOIN pg_class ic ON ic.oid = ix.indexrelid
    WHERE ns.nspname = 'app' AND t.relname = 'orders'
  `);
  const invalid = result.rows.filter((r: any) => !r.indisvalid);
  const passed = invalid.length === 0;
  return {
    passed,
    message: passed
      ? `All ${result.rows.length} indexes are valid.`
      : `${invalid.length} invalid indexes: ${invalid.map((r: any) => r.index_name).join(", ")}`,
    details: { totalIndexes: result.rows.length, invalidCount: invalid.length },
  };
}
