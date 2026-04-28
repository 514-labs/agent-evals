import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { hasColumn } from "../../_shared/assertion-helpers";

export async function pg_weight_column_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.pg.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'products' AND column_name = 'weight_kg'",
  );
  const passed = result.rows.length === 1;
  return {
    passed,
    message: passed ? "PG weight_kg column exists." : "PG weight_kg column not found.",
    details: { found: result.rows.length },
  };
}

export async function ch_weight_column_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const passed = await hasColumn(ctx, "analytics", "products", "weight_kg");
  return {
    passed,
    message: passed ? "CH weight_kg column exists." : "CH weight_kg column not found.",
    details: {},
  };
}
