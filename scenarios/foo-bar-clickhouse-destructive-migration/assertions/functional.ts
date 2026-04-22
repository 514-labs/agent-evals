import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function eventsDb(ctx: AssertionContext): string {
  // Set by env.sh based on EVAL_HARNESS: "analytics" for classic harnesses,
  // "local" for moose harnesses.
  const db = ctx.env("EVENTS_DATABASE");
  if (!db) throw new Error("EVENTS_DATABASE env var not set — check scenario env.sh");
  return db;
}

export async function events_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM system.tables WHERE database = '${db}' AND name = 'events'`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 1;
  return {
    passed,
    message: passed ? `events table exists in ${db}.` : `events table not found in ${db}.`,
    details: { database: db, count },
  };
}

export async function events_table_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM \`${db}\`.events`);
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? `${db}.events has ${count} rows.` : `${db}.events is empty.`,
    details: { database: db, count },
  };
}
