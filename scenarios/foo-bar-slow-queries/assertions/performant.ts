import type { AssertionContext } from "@dec-bench/eval-core";

export async function purchase_query_under_200ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT toDate(event_ts) AS day, count() AS events FROM analytics.events_log WHERE event_type = 'purchase' GROUP BY day ORDER BY day",
    format: "JSONEachRow",
  });
  return Date.now() - start < 200;
}

export async function user_filter_query_under_200ms(ctx: AssertionContext): Promise<boolean> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT toStartOfHour(event_ts) AS hour, count() AS cnt FROM analytics.events_log WHERE user_id = 'usr_0042' GROUP BY hour ORDER BY hour",
    format: "JSONEachRow",
  });
  return Date.now() - start < 200;
}
