import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function row_count_matches_source(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query("SELECT count(*) AS n FROM app.events");
  const sourceCount = Number(pgResult.rows[0]?.n ?? 0);

  const chRows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.events",
  );
  const targetCount = Number(chRows[0]?.n ?? 0);

  const passed = targetCount >= sourceCount;
  return {
    passed,
    message: passed
      ? `Row count matches: source=${sourceCount}, target=${targetCount}.`
      : `Source ${sourceCount}, target ${targetCount}.`,
    details: { sourceCount, targetCount },
  };
}

export async function event_types_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query("SELECT DISTINCT event_type FROM app.events ORDER BY event_type");
  const pgTypes = pgResult.rows.map((r) => r.event_type);

  const chRows = await queryRows<{ event_type: string }>(
    ctx,
    "SELECT DISTINCT event_type FROM analytics.events ORDER BY event_type",
  );
  const chTypes = chRows.map((r) => r.event_type);

  const passed = JSON.stringify(pgTypes) === JSON.stringify(chTypes);
  return {
    passed,
    message: passed ? "Event types preserved." : `PG: ${pgTypes.join(",")}, CH: ${chTypes.join(",")}.`,
    details: { pgTypes, chTypes },
  };
}
