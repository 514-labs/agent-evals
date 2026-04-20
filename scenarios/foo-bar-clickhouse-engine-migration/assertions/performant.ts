import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function final_query_completes_quickly(ctx: AssertionContext): Promise<AssertionResult> {
  const thresholdMs = 1000;
  const start = Date.now();
  await ctx.clickhouse.query({
    query: "SELECT count() FROM analytics.events FINAL",
    format: "JSONEachRow",
  });
  const elapsed = Date.now() - start;
  const passed = elapsed <= thresholdMs;
  return {
    passed,
    message: passed
      ? `FINAL count() completed in ${elapsed}ms (<= ${thresholdMs}ms).`
      : `FINAL count() took ${elapsed}ms (> ${thresholdMs}ms).`,
    details: { elapsedMs: elapsed, thresholdMs },
  };
}
