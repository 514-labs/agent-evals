import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_counts_match(ctx: AssertionContext): Promise<boolean> {
  const pgResult = await ctx.pg.query("SELECT count(*) AS n FROM app.products");
  const chRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.products",
  );
  return Number(pgResult.rows[0]?.n ?? 0) === Number(chRows[0]?.n ?? 0);
}

export async function old_queries_still_work(ctx: AssertionContext): Promise<boolean> {
  const pgResult = await ctx.pg.query(
    "SELECT id, name, price, category FROM app.products ORDER BY id",
  );
  const chRows = await queryRows<{ id: number; name: string; price: number; category: string }>(
    ctx,
    "SELECT id, name, price, category FROM analytics.products ORDER BY id",
  );
  if (pgResult.rows.length !== chRows.length) return false;

  for (let i = 0; i < pgResult.rows.length; i++) {
    const pg = pgResult.rows[i];
    const ch = chRows[i];
    if (pg.id !== ch.id || pg.name !== ch.name || pg.category !== ch.category) return false;
    if (Math.abs(Number(pg.price) - ch.price) > 0.01) return false;
  }
  return true;
}
