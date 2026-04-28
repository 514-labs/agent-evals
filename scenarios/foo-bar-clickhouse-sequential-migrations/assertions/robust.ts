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
  // 5 columns after migration: event_id, event_ts, event_type, user_id, session_id
  const passed = rows.length === 1 && Object.keys(rows[0] ?? {}).length >= 5;
  return {
    passed,
    message: passed
      ? "SELECT * returns a well-shaped row with >=5 columns (session_id included)."
      : "SELECT * failed or row has fewer than 5 columns (session_id may be missing).",
    details: { rowCount: rows.length, columns: Object.keys(rows[0] ?? {}) },
  };
}

// Sentinel-row mutation: ingest a row with a distinctive event_type AND a
// distinctive session_id that matches the backfill rule, then confirm it
// surfaces via BOTH filter predicates. Routes through Tinybird Events API
// when TB_WORKSPACE is set (ClickHouse interface on :7182 is read-only);
// other harnesses INSERT directly.
export async function insert_and_filter_roundtrip(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const sentinelId = `sentinel_${Date.now()}`;
  const sentinelType = "robust_probe";
  const sentinelUser = "usr_robust";
  const tbWorkspace = ctx.env("TB_WORKSPACE");
  const tbToken = ctx.env("TB_ADMIN_TOKEN");
  // Match the backfill rule so the sentinel is also rule-compliant.
  const now = new Date();
  const nowIso = now.toISOString().replace(/\.\d+Z$/, "");
  const startOfDayUnix = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
  const sentinelSession = `${sentinelUser}_${startOfDayUnix}`;
  try {
    if (tbWorkspace && tbToken) {
      const res = await fetch(
        "http://localhost:7181/v0/events?name=events&wait=true",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${tbToken}` },
          body: JSON.stringify({
            event_id: sentinelId,
            event_ts: nowIso,
            event_type: sentinelType,
            user_id: sentinelUser,
            session_id: sentinelSession,
          }),
        },
      );
      if (!res.ok) {
        return {
          passed: false,
          message: `Events API ingest failed: HTTP ${res.status} ${await res.text()}`,
          details: { sentinelId },
        };
      }
      const payload = (await res.json()) as { successful_rows?: number; quarantined_rows?: number };
      if (!payload.successful_rows) {
        return {
          passed: false,
          message: `Events API accepted request but 0 successful rows (quarantined=${payload.quarantined_rows ?? "?"}).`,
          details: { sentinelId, payload },
        };
      }
    } else {
      await ctx.clickhouse.command({
        query:
          `INSERT INTO \`${db}\`.events (event_id, event_ts, event_type, user_id, session_id) ` +
          `VALUES ({id:String}, now(), {et:String}, {u:String}, {sid:String})`,
        query_params: { id: sentinelId, et: sentinelType, u: sentinelUser, sid: sentinelSession },
      });
    }
  } catch (err) {
    return {
      passed: false,
      message: `Sentinel ingest failed: ${(err as Error).message}`,
      details: { sentinelId },
    };
  }
  const rows = await queryRows<{ event_id: string }>(
    ctx,
    `SELECT event_id FROM \`${db}\`.events WHERE event_type = {et:String} AND session_id = {sid:String}`,
    { et: sentinelType, sid: sentinelSession },
  );
  const found = rows.some((r) => r.event_id === sentinelId);
  return {
    passed: found,
    message: found
      ? "Sentinel row visible via (event_type, session_id) filter after ingest."
      : "Ingest accepted but sentinel row not returned by filter.",
    details: { sentinelId, rowsFound: rows.length },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
