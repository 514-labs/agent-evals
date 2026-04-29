import { llmJudge, type AssertionContext, type AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function order_by_includes_region(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ create_table_query: string }>(
    ctx,
    "SELECT create_table_query FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const query = rows[0]?.create_table_query ?? "";
  const hasRegion = /ORDER BY.*region|order by.*region/i.test(query);
  const hasEventTs = /ORDER BY.*event_ts|order by.*event_ts/i.test(query);
  const passed = hasRegion && hasEventTs;
  return {
    passed,
    message: passed ? "ORDER BY includes region and event_ts." : "ORDER BY does not match filter columns.",
    details: { hasRegion, hasEventTs },
  };
}

export const orderby_choice_is_well_reasoned = llmJudge({
  rubric: `Read the agent's session log. Pass if the agent inspected actual query
patterns (sampling queries, reading metadata, or examining filter columns) before
choosing the new ORDER BY. Fail if the agent picked an ORDER BY without inspecting
query patterns first, or guessed based on table or column names alone.

Mark the verdict with category "no-evidence-of-pattern-inspection" when failing.`,
  inputs: ["sessionLog"],
  tools: ["clickhouse-readonly"],
});
