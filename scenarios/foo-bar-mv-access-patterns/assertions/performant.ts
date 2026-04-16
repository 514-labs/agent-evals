import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function mvs_use_summingmergetree_or_aggregatingmergetree(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string; engine: string }>(
    ctx,
    `SELECT name, engine FROM system.tables
     WHERE database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
       AND engine LIKE '%MergeTree%'
       AND (lower(name) LIKE '%daily%' OR lower(name) LIKE '%top%' OR lower(name) LIKE '%summary%' OR lower(name) LIKE '%leaderboard%')`,
  );

  if (rows.length === 0) {
    return { passed: false, message: "No MV target tables found.", details: {} };
  }

  const optimized = rows.filter((r) =>
    r.engine.includes("Summing") || r.engine.includes("Aggregating") || r.engine.includes("Replacing"),
  );
  const passed = optimized.length >= 1;
  return {
    passed,
    message: passed
      ? `${optimized.length} of ${rows.length} MV targets use an optimized engine: ${optimized.map((r) => `${r.name}(${r.engine})`).join(", ")}.`
      : `MV targets use basic MergeTree: ${rows.map((r) => `${r.name}(${r.engine})`).join(", ")}. SummingMergeTree or AggregatingMergeTree would be more efficient for aggregation views.`,
    details: { tables: rows.map((r) => ({ name: r.name, engine: r.engine })) },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
