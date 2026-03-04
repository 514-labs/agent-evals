import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_counts_reconciled(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query("SELECT count(*) AS n FROM app.transactions");
  const pgCount = Number(pgResult.rows[0]?.n ?? 0);

  const chRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.transactions",
  );
  const chCount = Number(chRows[0]?.n ?? 0);

  const passed = chCount >= pgCount;
  return {
    passed,
    message: passed
      ? `Counts reconciled: pg=${pgCount}, ch=${chCount}.`
      : `PG ${pgCount}, CH ${chCount} — sink behind source.`,
    details: { pgCount, chCount },
  };
}

export async function amount_checksum_matches(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query("SELECT coalesce(sum(amount), 0) AS s FROM app.transactions");
  const pgSum = Number(pgResult.rows[0]?.s ?? 0);

  const chRows = await queryRows<{ s: number }>(
    ctx,
    "SELECT sum(amount) AS s FROM analytics.transactions",
  );
  const chSum = Number(chRows[0]?.s ?? 0);

  const passed = Math.abs(pgSum - chSum) < 0.01;
  return {
    passed,
    message: passed ? "Amount checksum matches." : `PG sum=${pgSum}, CH sum=${chSum}.`,
    details: { pgSum, chSum },
  };
}
