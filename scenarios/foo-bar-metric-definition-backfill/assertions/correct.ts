import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function total_value_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query("SELECT coalesce(sum(value), 0) AS s FROM raw.events");
  const chRows = await queryRows<{ s: number }>(
    ctx,
    "SELECT sum(s) AS s FROM (SELECT day, sum(total_value) AS s FROM analytics.metric_daily GROUP BY day)",
  );
  const pgSum = Number(pgResult.rows[0]?.s ?? 0);
  const chSum = Number(chRows[0]?.s ?? 0);
  const passed = Math.abs(pgSum - chSum) < 0.01;
  return {
    passed,
    message: passed ? "Total value matches source." : `Postgres ${pgSum}, ClickHouse ${chSum}.`,
    details: { pgSum, chSum },
  };
}

export async function all_days_backfilled(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query(
    "SELECT count(DISTINCT date_trunc('day', event_ts)::date) AS n FROM raw.events",
  );
  const chRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM (SELECT day FROM analytics.metric_daily GROUP BY day)",
  );
  const pgDays = Number(pgResult.rows[0]?.n ?? 0);
  const chDays = Number(chRows[0]?.n ?? 0);
  const passed = chDays >= pgDays;
  return {
    passed,
    message: passed ? "All days backfilled." : `Postgres has ${pgDays} days, ClickHouse has ${chDays}.`,
    details: { pgDays, chDays },
  };
}
