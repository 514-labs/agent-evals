import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function quality_checks_under_500ms(ctx: AssertionContext): Promise<AssertionResult> {
  const start = Date.now();

  await ctx.pg.query("SELECT count(*) FROM raw.events WHERE event_id IS NULL");
  await ctx.pg.query(`
    SELECT event_id, count(*) FROM raw.events
    WHERE event_id IS NOT NULL
    GROUP BY event_id, event_type, user_id, event_ts
    HAVING count(*) > 1
  `);
  await ctx.pg.query("SELECT count(*) FROM raw.events WHERE properties ? 'device_type'");
  await ctx.pg.query("SELECT count(*) FROM raw.events WHERE event_ts < '2025-01-01'");

  const elapsed = Date.now() - start;
  const passed = elapsed < 500;
  return {
    passed,
    message: passed ? "Quality checks under 500ms." : `Quality checks took ${elapsed}ms.`,
    details: { elapsedMs: elapsed },
  };
}
