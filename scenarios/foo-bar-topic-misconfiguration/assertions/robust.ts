import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, describeTable, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function orders_schema_has_required_columns(ctx: AssertionContext): Promise<AssertionResult> {
  const cols = await describeTable(ctx, "analytics", "orders");
  const names = cols.map((c) => c.name.toLowerCase());
  const hasOrderId = names.some((n) => n.includes("order") && n.includes("id"));
  const hasAmount = names.some((n) => n.includes("amount"));
  const passed = names.length >= 3 && (hasOrderId || names.includes("order_id")) && hasAmount;
  return {
    passed,
    message: passed ? "Orders schema has required columns." : `Schema incomplete. Got: ${JSON.stringify(names)}.`,
    details: { names },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
