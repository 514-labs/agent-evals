import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, describeTable, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function dlq_schema_has_error_column(ctx: AssertionContext): Promise<AssertionResult> {
  const cols = await describeTable(ctx, "analytics", "dlq_events");
  const names = cols.map((c) => c.name.toLowerCase());
  const hasError = names.some((n) => n.includes("error"));
  return {
    passed: hasError,
    message: hasError ? "DLQ schema has error column." : "DLQ schema missing error column.",
    details: { names },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
