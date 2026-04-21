import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(
  ctx: AssertionContext,
  sql: string,
  query_params?: Record<string, unknown>,
): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow", query_params });
  return (await (result as any).json()) as T[];
}

async function readSeedMeta(ctx: AssertionContext, key: string): Promise<string | null> {
  const rows = await queryRows<{ value: string }>(
    ctx,
    "SELECT value FROM analytics._seed_meta WHERE key = {k:String}",
    { k: key },
  );
  return rows[0]?.value ?? null;
}

// Single structural check — engine, version column, and sorting key are co-properties
// of the target shape. Separate assertions fragment the diagnostic signal.
export async function table_schema_matches_target(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ engine: string; engine_full: string; sorting_key: string }>(
    ctx,
    "SELECT engine, engine_full, sorting_key FROM system.tables WHERE database = 'analytics' AND name = 'events'",
  );
  const engine = rows[0]?.engine ?? "";
  // engine_full may quote the version column identifier with backticks in some CH versions.
  const engineFull = rows[0]?.engine_full ?? "";
  const sortingKey = (rows[0]?.sorting_key ?? "").replace(/\s+/g, "");
  const engineOk = engine === "ReplacingMergeTree";
  const versionOk = /ReplacingMergeTree\s*\(\s*`?updated_at`?\s*\)/i.test(engineFull);
  const orderOk = sortingKey === "user_id,event_id";
  const passed = engineOk && versionOk && orderOk;
  const problems: string[] = [];
  if (!engineOk) problems.push(`engine='${engine}' (want ReplacingMergeTree)`);
  if (!versionOk) problems.push(`engine_full='${engineFull}' (want version column updated_at)`);
  if (!orderOk) problems.push(`sorting_key='${sortingKey}' (want user_id,event_id)`);
  return {
    passed,
    message: passed
      ? "Table is ReplacingMergeTree(updated_at) ORDER BY (user_id, event_id)."
      : `Schema mismatch: ${problems.join("; ")}.`,
    details: { engine, engineFull, sortingKey },
  };
}

export async function all_rows_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const raw = await readSeedMeta(ctx, "total_rows");
  if (raw === null) {
    return {
      passed: false,
      message: "Seed anchor missing: analytics._seed_meta has no 'total_rows' row.",
      details: {},
    };
  }
  const expected = Number(raw);
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
  const raw = await readSeedMeta(ctx, "unique_keys");
  if (raw === null) {
    return {
      passed: false,
      message: "Seed anchor missing: analytics._seed_meta has no 'unique_keys' row.",
      details: {},
    };
  }
  const expected = Number(raw);
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
  // Single join query — avoids N+1 and avoids string-interpolating user_id/event_id.
  const rows = await queryRows<{
    user_id: string;
    event_id: string;
    expected_latest_value: number;
    actual_value: number | null;
  }>(
    ctx,
    `SELECT sc.user_id AS user_id, sc.event_id AS event_id,
            sc.expected_latest_value AS expected_latest_value,
            e.value AS actual_value
     FROM analytics._seed_spotchecks AS sc
     LEFT JOIN (SELECT user_id, event_id, value FROM analytics.events FINAL) AS e
       ON sc.user_id = e.user_id AND sc.event_id = e.event_id`,
  );
  if (rows.length === 0) {
    return { passed: false, message: "Spotcheck anchor table is empty.", details: {} };
  }
  const misses = rows.filter((r) => {
    if (r.actual_value === null || r.actual_value === undefined) return true;
    return Math.abs(Number(r.actual_value) - Number(r.expected_latest_value)) > 1e-6;
  });
  const passed = misses.length === 0;
  return {
    passed,
    message: passed
      ? "All spot-checked duplicates return the latest value under FINAL."
      : `${misses.length}/${rows.length} spot-checks returned wrong value.`,
    details: { checked: rows.length, misses },
  };
}

// Moved from robust.ts: one-shot final-state check, belongs in correctness.
export async function no_dangling_temp_tables(ctx: AssertionContext): Promise<AssertionResult> {
  const allowed = new Set(["events", "_seed_meta", "_seed_spotchecks"]);
  const rows = await queryRows<{ name: string }>(
    ctx,
    "SELECT name FROM system.tables WHERE database = 'analytics'",
  );
  const unexpected = rows.map((r) => r.name).filter((name) => !allowed.has(name));
  const passed = unexpected.length === 0;
  return {
    passed,
    message: passed
      ? "No leftover temporary tables in analytics."
      : `Found unexpected tables: ${unexpected.join(", ")}.`,
    details: { unexpected, allowed: Array.from(allowed) },
  };
}
