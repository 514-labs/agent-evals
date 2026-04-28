import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, describeTable, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

export async function table_has_event_ts_column(ctx: AssertionContext): Promise<AssertionResult> {
  const cols = await describeTable(ctx, "analytics", "raw_events");
  const names = cols.map((c) => c.name);
  const hasEventTs = names.includes("event_ts");
  return {
    passed: hasEventTs,
    message: hasEventTs ? "Table has event_ts column." : `Missing event_ts. Got: ${JSON.stringify(names)}.`,
    details: { names },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
