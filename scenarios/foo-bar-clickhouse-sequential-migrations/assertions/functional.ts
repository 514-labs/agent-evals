import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(
  ctx: AssertionContext,
  sql: string,
  query_params?: Record<string, unknown>,
): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow", query_params });
  return (await (result as any).json()) as T[];
}

function eventsDb(ctx: AssertionContext): string {
  const db = ctx.env("EVENTS_DATABASE");
  if (!db) throw new Error("EVENTS_DATABASE env var not set — check scenario env.sh");
  return db;
}

async function readSeedMeta(ctx: AssertionContext, key: string): Promise<string | null> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ value: string }>(
    ctx,
    `SELECT value FROM \`${db}\`._seed_meta WHERE key = {k:String}`,
    { k: key },
  );
  return rows[0]?.value ?? null;
}

export async function events_table_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM system.tables WHERE database = {db:String} AND name = 'events'`,
    { db },
  );
  const count = Number(rows[0]?.n ?? 0);
  // Tinybird's blue-green deploy may leave 2 entries transiently; any >=1 is fine here.
  const passed = count >= 1;
  return {
    passed,
    message: passed ? `events table exists in ${db}.` : `events table not found in ${db}.`,
    details: { database: db, count },
  };
}

export async function events_table_has_expected_row_count(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const expectedRaw = await readSeedMeta(ctx, "total_rows");
  if (expectedRaw === null) {
    return {
      passed: false,
      message: `Seed anchor missing: ${db}._seed_meta has no 'total_rows' row.`,
      details: {},
    };
  }
  const expected = Number(expectedRaw);
  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM \`${db}\`.events`);
  const actual = Number(rows[0]?.n ?? 0);
  const passed = actual === expected;
  return {
    passed,
    message: passed
      ? `${db}.events has ${actual} rows (matches seed).`
      : `${db}.events has ${actual} rows, expected ${expected}.`,
    details: { expected, actual },
  };
}
