import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, findTables } from "../../_shared/assertion-helpers";

export async function mvs_use_summingmergetree_or_aggregatingmergetree(ctx: AssertionContext): Promise<AssertionResult> {
  const dailyMatches = await findTables(ctx, { concepts: ["daily"], engines: ["MergeTree"] });
  const topMatches = await findTables(ctx, { concepts: ["top"], engines: ["MergeTree"] });
  const summaryMatches = await findTables(ctx, { concepts: ["summar"], engines: ["MergeTree"] });
  const leaderboardMatches = await findTables(ctx, { concepts: ["leaderboard"], engines: ["MergeTree"] });

  const seen = new Set<string>();
  const all = [...dailyMatches, ...topMatches, ...summaryMatches, ...leaderboardMatches].filter((t) => {
    const key = `${t.database}.${t.table}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (all.length === 0) {
    return { passed: false, message: "No MV target tables found.", details: {} };
  }

  const optimized = all.filter((t) => {
    const e = t.engine ?? "";
    return e.includes("Summing") || e.includes("Aggregating") || e.includes("Replacing");
  });
  const passed = optimized.length >= 1;
  return {
    passed,
    message: passed
      ? `${optimized.length} of ${all.length} MV targets use an optimized engine: ${optimized.map((t) => `${t.table}(${t.engine})`).join(", ")}.`
      : `MV targets use basic MergeTree: ${all.map((t) => `${t.table}(${t.engine})`).join(", ")}. SummingMergeTree or AggregatingMergeTree would be more efficient for aggregation views.`,
    details: { tables: all.map((t) => ({ name: t.table, engine: t.engine })) },
  };
}

export async function avoids_select_star_queries(): Promise<AssertionResult> {
  return avoidsSelectStarQueries();
}
