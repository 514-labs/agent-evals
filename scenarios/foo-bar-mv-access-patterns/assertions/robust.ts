import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findUserActivityTable, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function mv_populates_on_insert(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Base table not found.", details: {} };
  }

  // Check if any MV target tables exist and have data
  const mvTargets = await queryRows<{ database: string; name: string }>(
    ctx,
    `SELECT database, name FROM system.tables
     WHERE engine LIKE '%MergeTree%'
       AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
       AND name NOT IN (
         SELECT name FROM system.tables
         WHERE (lower(name) LIKE '%user_activity%' OR lower(name) LIKE '%useractivity%')
           AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
       )`,
  );

  if (mvTargets.length === 0) {
    return { passed: false, message: "No MV target tables found.", details: {} };
  }

  // At least one target should have rows (populated by the MV)
  let populatedCount = 0;
  for (const target of mvTargets) {
    const rows = await queryRows<{ n: number }>(
      ctx,
      `SELECT count() AS n FROM ${target.database}.${target.name}`,
    );
    if (Number(rows[0]?.n ?? 0) > 0) {
      populatedCount++;
    }
  }

  const passed = populatedCount >= 2;
  return {
    passed,
    message: passed
      ? `${populatedCount} of ${mvTargets.length} MV targets have data.`
      : `Only ${populatedCount} of ${mvTargets.length} MV targets populated — both daily_summary and top_users should have rows.`,
    details: { mvTargets: mvTargets.map((t) => t.name), populatedCount },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
