import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

async function queryRows<T>(
  ctx: AssertionContext,
  sql: string,
  query_params?: Record<string, unknown>,
): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow", query_params });
  return (await (result as any).json()) as T[];
}

function eventsDb(ctx: AssertionContext): string {
  const db = ctx.env("EVENTS_DATABASE");
  if (!db) throw new Error("EVENTS_DATABASE env var not set — check scenario env.sh");
  return db;
}

export async function select_star_works(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<Record<string, unknown>>(
    ctx,
    `SELECT * FROM \`${db}\`.events LIMIT 1`,
  );
  const passed = rows.length === 1 && Object.keys(rows[0] ?? {}).length >= 4;
  return {
    passed,
    message: passed ? "SELECT * returns a well-shaped row." : "SELECT * failed or row has fewer than 4 columns.",
    details: { rowCount: rows.length, columns: Object.keys(rows[0] ?? {}) },
  };
}

// Mutation test: INSERT a sentinel row with a distinctive event_type and
// verify it surfaces in filter queries. If the agent partially rebuilt the
// table (e.g. a read-only staging copy that isn't the live table), this
// INSERT either errors or the SELECT can't find it.
export async function insert_and_filter_roundtrip(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const sentinelId = `sentinel_${Date.now()}`;
  const sentinelType = "robust_probe"; // not in the 5 seed types
  try {
    await ctx.clickhouse.command({
      query:
        `INSERT INTO \`${db}\`.events (event_id, event_ts, event_type, user_id) ` +
        `VALUES ({id:String}, now(), {et:String}, 'usr_robust')`,
      query_params: { id: sentinelId, et: sentinelType },
    });
  } catch (err) {
    return {
      passed: false,
      message: `INSERT of sentinel row failed: ${(err as Error).message}`,
      details: { sentinelId },
    };
  }
  const rows = await queryRows<{ event_id: string }>(
    ctx,
    `SELECT event_id FROM \`${db}\`.events WHERE event_type = {et:String}`,
    { et: sentinelType },
  );
  const found = rows.some((r) => r.event_id === sentinelId);
  return {
    passed: found,
    message: found
      ? "Sentinel row visible via event_type filter after INSERT."
      : "INSERT accepted but sentinel row not returned by event_type filter.",
    details: { sentinelId, rowsFound: rows.length },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
