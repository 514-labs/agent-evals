import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, describeTable, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function required_columns_present(ctx: AssertionContext): Promise<AssertionResult> {
  const cols = await describeTable(ctx, "analytics", "sales");
  const names = cols.map((c) => c.name);
  const required = ["id", "product_id", "quantity", "amount", "sale_date"];
  const missing = required.filter((c) => !names.includes(c));
  const passed = missing.length === 0;
  return {
    passed,
    message: passed ? "Required columns present." : `Missing: ${missing.join(", ")}.`,
    details: { names, missing },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
