import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function dau_matches_postgres(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query(
    "SELECT date_trunc('day', event_ts)::date AS day, count(DISTINCT user_id) AS dau FROM raw.events GROUP BY 1 ORDER BY 1",
  );
  const chRows = await queryRows<{ day: string; dau: number }>(
    ctx,
    "SELECT day, dau FROM analytics.daily_metrics ORDER BY day",
  );
  let passed = true;
  for (const pgRow of pgResult.rows) {
    const day = pgRow.day?.toISOString?.().slice(0, 10) ?? String(pgRow.day);
    const chRow = chRows.find((r) => String(r.day).startsWith(day));
    if (!chRow || Number(chRow.dau) !== Number(pgRow.dau)) {
      passed = false;
      break;
    }
  }
  return {
    passed,
    message: passed ? "DAU matches Postgres." : "DAU does not match Postgres.",
    details: { pgRows: pgResult.rows.length, chRows: chRows.length },
  };
}

export async function revenue_matches_postgres(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query("SELECT coalesce(sum(value), 0) AS s FROM raw.events");
  const chRows = await queryRows<{ s: number }>(ctx, "SELECT sum(revenue) AS s FROM analytics.daily_metrics");
  const pgSum = Number(pgResult.rows[0]?.s ?? 0);
  const chSum = Number(chRows[0]?.s ?? 0);
  const passed = Math.abs(pgSum - chSum) < 0.01;
  return {
    passed,
    message: passed ? "Revenue matches Postgres." : `Postgres ${pgSum}, ClickHouse ${chSum}.`,
    details: { pgSum, chSum },
  };
}
