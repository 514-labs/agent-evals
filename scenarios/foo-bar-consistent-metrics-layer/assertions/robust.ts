import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { avoidsSelectStarQueries, scanWorkspaceForHardcodedConnections } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function dau_is_distinct_users(ctx: AssertionContext): Promise<AssertionResult> {
  // Pick an arbitrary day that has data and derive the expected DAU from Postgres source
  const dayRows = await queryRows<{ day: string }>(
    ctx,
    "SELECT day FROM analytics.daily_metrics ORDER BY day LIMIT 1",
  );
  const day = dayRows[0]?.day;
  if (!day) {
    return { passed: false, message: "No rows in daily_metrics.", details: {} };
  }

  const chRows = await queryRows<{ dau: number }>(
    ctx,
    `SELECT dau FROM analytics.daily_metrics WHERE day = '${day}'`,
  );
  const chDau = Number(chRows[0]?.dau ?? 0);

  // Derive expected DAU from source
  const pgResult = await ctx.pg.query(
    `SELECT count(DISTINCT user_id) AS n FROM raw.events WHERE event_ts::date = $1`,
    [day],
  );
  const expectedDau = Number(pgResult.rows[0]?.n ?? 0);

  const passed = expectedDau > 0 && chDau === expectedDau;
  return {
    passed,
    message: passed
      ? `DAU on ${day} matches source (${chDau} distinct users).`
      : `DAU mismatch on ${day}: ClickHouse=${chDau}, Postgres=${expectedDau}.`,
    details: { day, chDau, expectedDau },
  };
}

export async function no_hardcoded_connection_strings(): Promise<AssertionResult> {
  return scanWorkspaceForHardcodedConnections();
}
