import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import {
  findTables,
  findUserActivityTable,
  scanWorkspaceForHardcodedConnections,
} from "../../_shared/assertion-helpers";

export async function mv_populates_on_insert(ctx: AssertionContext): Promise<AssertionResult> {
  const base = await findUserActivityTable(ctx);
  if (!base) {
    return { passed: false, message: "Base table not found.", details: {} };
  }

  // Collect candidate MV target tables by concept match
  const daily = await findTables(ctx, { concepts: ["daily"], engines: ["MergeTree"] });
  const top = await findTables(ctx, { concepts: ["top"], engines: ["MergeTree"] });
  const summary = await findTables(ctx, { concepts: ["summar"], engines: ["MergeTree"] });
  const leaderboard = await findTables(ctx, { concepts: ["leaderboard"], engines: ["MergeTree"] });

  const seen = new Set<string>();
  const mvTargets = [...daily, ...top, ...summary, ...leaderboard].filter((t) => {
    const key = `${t.database}.${t.table}`;
    if (seen.has(key)) return false;
    seen.add(key);
    // Exclude the base table
    return !(t.database === base.database && t.table === base.table);
  });

  if (mvTargets.length === 0) {
    return { passed: false, message: "No MV target tables found.", details: {} };
  }

  // total_rows comes from findTables; treat as populated if > 0
  const populated = mvTargets.filter((t) => (t.total_rows ?? 0) > 0);
  const passed = populated.length >= 2;
  return {
    passed,
    message: passed
      ? `${populated.length} of ${mvTargets.length} MV targets have data.`
      : `Only ${populated.length} of ${mvTargets.length} MV targets populated — both daily_summary and top_users should have rows.`,
    details: {
      mvTargets: mvTargets.map((t) => `${t.database}.${t.table} (${t.total_rows ?? 0} rows)`),
      populatedCount: populated.length,
    },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
