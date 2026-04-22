import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function eventsDb(ctx: AssertionContext): string {
  const db = ctx.env("EVENTS_DATABASE");
  if (!db) throw new Error("EVENTS_DATABASE env var not set — check scenario env.sh");
  return db;
}

const EXPECTED_ORDER_BY = "event_type, event_ts, event_id";
const EXPECTED_ROW_COUNT = 8;

export async function order_by_is_event_type_first(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ sorting_key: string }>(
    ctx,
    `SELECT sorting_key FROM system.tables WHERE database = '${db}' AND name = 'events'`,
  );
  const sortingKey = rows[0]?.sorting_key ?? "";
  const passed = sortingKey.replace(/\s/g, "") === EXPECTED_ORDER_BY.replace(/\s/g, "");
  return {
    passed,
    message: passed
      ? `ORDER BY is '${sortingKey}'.`
      : `Expected ORDER BY '${EXPECTED_ORDER_BY}', got '${sortingKey}'.`,
    details: { expected: EXPECTED_ORDER_BY, actual: sortingKey },
  };
}

export async function all_eight_rows_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM \`${db}\`.events`);
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === EXPECTED_ROW_COUNT;
  return {
    passed,
    message: passed ? `All ${EXPECTED_ROW_COUNT} rows preserved.` : `Expected ${EXPECTED_ROW_COUNT} rows, got ${count}.`,
    details: { expected: EXPECTED_ROW_COUNT, actual: count },
  };
}

export async function seed_rows_identifiable_by_event_id(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ event_id: string }>(
    ctx,
    `SELECT event_id FROM \`${db}\`.events ORDER BY event_id`,
  );
  const ids = rows.map((r) => r.event_id).sort();
  const expected = ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"];
  const passed = JSON.stringify(ids) === JSON.stringify(expected);
  return {
    passed,
    message: passed ? "All 8 seed event_ids present." : `event_id set mismatch.`,
    details: { expected, actual: ids },
  };
}
