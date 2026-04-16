import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findTables, findUserActivityTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function base_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  const passed = found !== null;
  return {
    passed,
    message: passed
      ? `Base table exists at ${found!.database}.${found!.table}.`
      : "User activity base table not found in any database.",
    details: { found },
  };
}

export async function base_table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Base table not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 10;
  return {
    passed,
    message: passed ? `Base table has ${count} rows.` : `Expected at least 10 rows, got ${count}.`,
    details: { count },
  };
}

export async function at_least_one_materialized_view_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const base = await findUserActivityTable(ctx);
  // Candidate MV target tables: any non-base MergeTree-family table or any MaterializedView
  const dailyMatches = await findTables(ctx, { concepts: ["daily"] });
  const topMatches = await findTables(ctx, { concepts: ["top"] });
  const summaryMatches = await findTables(ctx, { concepts: ["summar"] });
  const leaderboardMatches = await findTables(ctx, { concepts: ["leaderboard"] });

  const all = [...dailyMatches, ...topMatches, ...summaryMatches, ...leaderboardMatches];
  // Dedupe by database.table, exclude the base table
  const seen = new Set<string>();
  const targets = all.filter((t) => {
    const key = `${t.database}.${t.table}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (base && t.database === base.database && t.table === base.table) return false;
    return true;
  });

  const passed = targets.length >= 1;
  return {
    passed,
    message: passed
      ? `Found ${targets.length} MV target(s): ${targets.map((t) => t.table).join(", ")}.`
      : "No materialized view target tables found.",
    details: { tables: targets.map((t) => `${t.database}.${t.table}`) },
  };
}
