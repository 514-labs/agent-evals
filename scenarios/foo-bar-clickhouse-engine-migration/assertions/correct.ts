import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function readSeedMeta(ctx: AssertionContext, key: string): Promise<string | null> {
  const rows = await queryRows<{ value: string }>(
    ctx,
    `SELECT value FROM analytics._seed_meta WHERE key = '${key}'`,
  );
  return rows[0]?.value ?? null;
}

export async function engine_is_replacing_mergetree(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ engine: string }>(
    ctx,
    "SELECT engine FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const engine = rows[0]?.engine ?? "";
  const passed = engine === "ReplacingMergeTree";
  return {
    passed,
    message: passed ? "Engine is ReplacingMergeTree." : `Engine is '${engine}', expected ReplacingMergeTree.`,
    details: { engine },
  };
}

export async function version_column_is_updated_at(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ engine_full: string }>(
    ctx,
    "SELECT engine_full FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const engineFull = rows[0]?.engine_full ?? "";
  const passed = /ReplacingMergeTree\s*\(\s*updated_at\s*\)/i.test(engineFull);
  return {
    passed,
    message: passed
      ? "ReplacingMergeTree version column is updated_at."
      : `engine_full does not declare updated_at as version: '${engineFull}'.`,
    details: { engineFull },
  };
}

export async function order_by_is_user_id_event_id(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ sorting_key: string }>(
    ctx,
    "SELECT sorting_key FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const sortingKey = (rows[0]?.sorting_key ?? "").replace(/\s+/g, "");
  const passed = sortingKey === "user_id,event_id";
  return {
    passed,
    message: passed
      ? "ORDER BY is (user_id, event_id)."
      : `ORDER BY is '${sortingKey}', expected 'user_id,event_id'.`,
    details: { sortingKey },
  };
}

export async function all_rows_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const expected = Number(await readSeedMeta(ctx, "total_rows") ?? "0");
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events");
  const actual = Number(rows[0]?.n ?? 0);
  const passed = actual === expected;
  return {
    passed,
    message: passed
      ? `All ${expected} rows preserved.`
      : `Row count is ${actual}, expected ${expected}.`,
    details: { expected, actual },
  };
}

export async function final_query_deduplicates(ctx: AssertionContext): Promise<AssertionResult> {
  const expected = Number(await readSeedMeta(ctx, "unique_keys") ?? "0");
  const rows = await queryRows<{ n: number }>(ctx, "SELECT count() AS n FROM analytics.events FINAL");
  const actual = Number(rows[0]?.n ?? 0);
  const passed = actual === expected;
  return {
    passed,
    message: passed
      ? `FINAL returns ${expected} unique-key rows.`
      : `FINAL returns ${actual} rows, expected ${expected}.`,
    details: { expected, actual },
  };
}

export async function latest_updated_at_wins(ctx: AssertionContext): Promise<AssertionResult> {
  const spotchecks = await queryRows<{ user_id: string; event_id: string; expected_latest_value: number }>(
    ctx,
    "SELECT user_id, event_id, expected_latest_value FROM analytics._seed_spotchecks",
  );
  const misses: Array<{ user_id: string; event_id: string; expected: number; actual: number | null }> = [];
  for (const s of spotchecks) {
    const rows = await queryRows<{ value: number }>(
      ctx,
      `SELECT value FROM analytics.events FINAL WHERE user_id = '${s.user_id}' AND event_id = '${s.event_id}'`,
    );
    const actual = rows[0]?.value ?? null;
    if (actual === null || Math.abs(Number(actual) - Number(s.expected_latest_value)) > 1e-6) {
      misses.push({ user_id: s.user_id, event_id: s.event_id, expected: Number(s.expected_latest_value), actual: actual === null ? null : Number(actual) });
    }
  }
  const passed = spotchecks.length > 0 && misses.length === 0;
  return {
    passed,
    message: passed
      ? "All spot-checked duplicates return the latest value under FINAL."
      : spotchecks.length === 0
        ? "Spotcheck anchor table is empty."
        : `${misses.length}/${spotchecks.length} spot-checks returned wrong value.`,
    details: { checked: spotchecks.length, misses },
  };
}
