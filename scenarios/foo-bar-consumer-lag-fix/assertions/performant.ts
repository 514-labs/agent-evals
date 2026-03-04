import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function sink_query_under_100ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT count() FROM analytics.events_sink",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed < 100;
  return {
    passed,
    message: passed ? "Sink query under 100ms." : `Sink query took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
