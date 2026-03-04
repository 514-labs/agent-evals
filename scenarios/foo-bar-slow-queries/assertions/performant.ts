import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function purchase_query_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT toDate(event_ts) AS day, count() AS events FROM analytics.events_log WHERE event_type = 'purchase' GROUP BY day ORDER BY day",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "Purchase query under 200ms." : `Purchase query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}

export async function user_filter_query_under_200ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT toStartOfHour(event_ts) AS hour, count() AS cnt FROM analytics.events_log WHERE user_id = 'usr_0042' GROUP BY hour ORDER BY hour",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 200;
  return {
    passed,
    message: passed ? "User filter query under 200ms." : `User filter query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
