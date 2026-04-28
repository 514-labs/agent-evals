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

const EXPECTED_ORDER_BY = "event_type, event_ts, event_id";

// Single structural check: engine MUST be MergeTree-family AND sorting_key
// MUST be the target ORDER BY. Returns all mismatches in one FAIL to avoid
// the "three separate FAILs for the same root cause" anti-pattern.
export async function table_schema_matches_target(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  // Tinybird's blue-green deploy can leave the old table visible in
  // system.tables alongside the new one. Order by most-recently-modified
  // and take one row so we're reading the live deployment. Atlas and
  // moose harnesses only ever have one row, so this is also correct for
  // them.
  const rows = await queryRows<{ engine: string; sorting_key: string }>(
    ctx,
    `SELECT engine, sorting_key
     FROM system.tables
     WHERE database = {db:String} AND name = 'events'
     ORDER BY metadata_modification_time DESC
     LIMIT 1`,
    { db },
  );
  if (rows.length === 0) {
    return {
      passed: false,
      message: `${db}.events not found — agent may have dropped the table without recreating.`,
      details: {},
    };
  }
  const engine = rows[0].engine;
  const sortingKey = rows[0].sorting_key.replace(/\s+/g, "");
  const expectedOrder = EXPECTED_ORDER_BY.replace(/\s+/g, "");
  const engineOk = /MergeTree/i.test(engine);
  const orderOk = sortingKey === expectedOrder;
  const problems: string[] = [];
  if (!engineOk) problems.push(`engine='${engine}' (want MergeTree family)`);
  if (!orderOk) problems.push(`sorting_key='${sortingKey}' (want ${expectedOrder})`);
  const passed = problems.length === 0;
  return {
    passed,
    message: passed
      ? `${db}.events has engine=${engine} ORDER BY (${EXPECTED_ORDER_BY}).`
      : `Schema mismatch: ${problems.join("; ")}.`,
    details: { engine, sortingKey },
  };
}

export async function all_rows_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const expectedRaw = await readSeedMeta(ctx, "total_rows");
  if (expectedRaw === null) {
    return {
      passed: false,
      message: `Seed anchor missing: ${db}._seed_meta has no 'total_rows'.`,
      details: {},
    };
  }
  const expected = Number(expectedRaw);
  const rows = await queryRows<{ n: number }>(ctx, `SELECT count() AS n FROM \`${db}\`.events`);
  const actual = Number(rows[0]?.n ?? 0);
  const passed = actual === expected;
  return {
    passed,
    message: passed ? `All ${expected} seed rows preserved.` : `Row count is ${actual}, expected ${expected}.`,
    details: { expected, actual },
  };
}

export async function spotcheck_rows_intact(ctx: AssertionContext): Promise<AssertionResult> {
  // Join _seed_spotchecks against events to confirm each spotcheck event_id
  // still exists with its original event_type/event_ts/user_id. Catches
  // "agent re-seeded with fresh data" — row count might match but content is wrong.
  const db = eventsDb(ctx);
  const rows = await queryRows<{
    event_id: string;
    expected_type: string;
    expected_ts: string;
    expected_user: string;
    actual_type: string | null;
    actual_ts: string | null;
    actual_user: string | null;
  }>(
    ctx,
    `SELECT
       sc.event_id AS event_id,
       sc.event_type AS expected_type,
       toString(sc.event_ts) AS expected_ts,
       sc.user_id AS expected_user,
       e.event_type AS actual_type,
       toString(e.event_ts) AS actual_ts,
       e.user_id AS actual_user
     FROM \`${db}\`._seed_spotchecks AS sc
     LEFT JOIN \`${db}\`.events AS e ON sc.event_id = e.event_id`,
  );
  if (rows.length === 0) {
    return { passed: false, message: `${db}._seed_spotchecks is empty.`, details: {} };
  }
  const misses = rows.filter(
    (r) =>
      r.actual_type !== r.expected_type ||
      r.actual_ts !== r.expected_ts ||
      r.actual_user !== r.expected_user,
  );
  const passed = misses.length === 0;
  return {
    passed,
    message: passed
      ? `All ${rows.length} spotcheck rows intact.`
      : `${misses.length}/${rows.length} spotcheck rows missing or mutated.`,
    details: { checked: rows.length, misses },
  };
}

export async function event_type_distribution_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  // Compare per-type counts against _seed_meta. Catches partial backfills
  // that drop whole classes of rows (e.g. filter clause missing 'signup').
  const db = eventsDb(ctx);
  const types = ["pv", "click", "purchase", "signup", "logout"];
  const expectedPairs: { type: string; expected: number }[] = [];
  for (const t of types) {
    const raw = await readSeedMeta(ctx, `count_${t}`);
    if (raw === null) {
      return {
        passed: false,
        message: `Seed anchor missing: ${db}._seed_meta has no 'count_${t}'.`,
        details: {},
      };
    }
    expectedPairs.push({ type: t, expected: Number(raw) });
  }
  const actualRows = await queryRows<{ event_type: string; n: number }>(
    ctx,
    `SELECT event_type, count() AS n FROM \`${db}\`.events GROUP BY event_type`,
  );
  const actualMap = new Map(actualRows.map((r) => [r.event_type, Number(r.n)]));
  const diffs = expectedPairs
    .map((p) => ({ type: p.type, expected: p.expected, actual: actualMap.get(p.type) ?? 0 }))
    .filter((d) => d.actual !== d.expected);
  const passed = diffs.length === 0;
  return {
    passed,
    message: passed
      ? `Per-event-type counts match seed.`
      : `${diffs.length} event_type count(s) diverged: ${diffs.map((d) => `${d.type} ${d.actual}/${d.expected}`).join(", ")}.`,
    details: { expectedPairs, actualMap: Object.fromEntries(actualMap), diffs },
  };
}
