import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function no_temp_or_backup_tables_in_analytics(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    `SELECT name FROM system.tables
     WHERE database = 'analytics'
       AND (name LIKE '%tmp%'
         OR name LIKE '%temp%'
         OR name LIKE '%backup%'
         OR name LIKE '%bak%'
         OR name LIKE '%_old'
         OR name LIKE '%_orig'
         OR name LIKE '%_copy')`,
  );
  const offenders = rows.map((r) => r.name);
  const passed = offenders.length === 0;
  return {
    passed,
    message: passed
      ? "No temporary or backup tables left in analytics database."
      : `Found leftover tables in analytics: ${offenders.join(", ")}`,
    details: { offenders },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
