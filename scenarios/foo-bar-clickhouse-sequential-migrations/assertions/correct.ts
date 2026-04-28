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

const EXPECTED_ORDER_BY = "session_id, event_ts, event_id";

// Migration 1 landed: the session_id column exists and is String-typed.
export async function session_id_column_exists(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ type: string }>(
    ctx,
    `SELECT type FROM system.columns
     WHERE database = {db:String} AND table = 'events' AND name = 'session_id'
     LIMIT 1`,
    { db },
  );
  if (rows.length === 0) {
    return {
      passed: false,
      message: `${db}.events has no session_id column — migration #1 did not land.`,
      details: {},
    };
  }
  const type = rows[0].type;
  const passed = /String/i.test(type);
  return {
    passed,
    message: passed
      ? `session_id exists with type=${type}.`
      : `session_id exists but type='${type}' is not a String variant.`,
    details: { type },
  };
}

// Migration 2 landed: every historical row has a non-empty session_id.
export async function session_id_is_populated(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ empty: number; total: number }>(
    ctx,
    `SELECT countIf(session_id = '') AS empty, count() AS total FROM \`${db}\`.events`,
  );
  const empty = Number(rows[0]?.empty ?? 0);
  const total = Number(rows[0]?.total ?? 0);
  const passed = empty === 0 && total > 0;
  return {
    passed,
    message: passed
      ? `All ${total} rows have a non-empty session_id.`
      : `${empty}/${total} rows still have empty session_id — migration #2 (backfill) incomplete.`,
    details: { empty, total },
  };
}

// Migration 2 landed correctly: session_id matches the deterministic rule
// `concat(user_id, '_', toString(toUnixTimestamp(toStartOfDay(event_ts))))`
// for every row. Checked row-count-style (no sample rows returned in failure
// message to keep output bounded).
export async function session_id_matches_rule(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
  const rows = await queryRows<{ mismatches: number; total: number }>(
    ctx,
    `SELECT
       countIf(session_id != concat(user_id, '_', toString(toUnixTimestamp(toStartOfDay(event_ts))))) AS mismatches,
       count() AS total
     FROM \`${db}\`.events`,
  );
  const mismatches = Number(rows[0]?.mismatches ?? 0);
  const total = Number(rows[0]?.total ?? 0);
  const passed = mismatches === 0 && total > 0;
  return {
    passed,
    message: passed
      ? `All ${total} rows have a session_id matching the deterministic rule.`
      : `${mismatches}/${total} rows have a session_id that diverges from the rule.`,
    details: { mismatches, total },
  };
}

// Migration 3 landed: engine is MergeTree-family AND sorting_key is the
// post-#3 target. Orders by metadata_modification_time DESC LIMIT 1 so
// tinybird-forward's blue-green deploys don't show the old version.
export async function table_schema_matches_target(ctx: AssertionContext): Promise<AssertionResult> {
  const db = eventsDb(ctx);
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
  // Spotcheck rows now carry an expected_session_id computed at seed time
  // from the same rule. Verifies (a) the row still exists, (b) its
  // event_type/event_ts/user_id are unchanged, (c) its backfilled
  // session_id matches expectation.
  const db = eventsDb(ctx);
  const rows = await queryRows<{
    event_id: string;
    expected_type: string;
    expected_ts: string;
    expected_user: string;
    expected_session: string;
    actual_type: string | null;
    actual_ts: string | null;
    actual_user: string | null;
    actual_session: string | null;
  }>(
    ctx,
    `SELECT
       sc.event_id                   AS event_id,
       sc.event_type                 AS expected_type,
       toString(sc.event_ts)         AS expected_ts,
       sc.user_id                    AS expected_user,
       sc.expected_session_id        AS expected_session,
       e.event_type                  AS actual_type,
       toString(e.event_ts)          AS actual_ts,
       e.user_id                     AS actual_user,
       e.session_id                  AS actual_session
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
      r.actual_user !== r.expected_user ||
      r.actual_session !== r.expected_session,
  );
  const passed = misses.length === 0;
  return {
    passed,
    message: passed
      ? `All ${rows.length} spotcheck rows intact (including session_id).`
      : `${misses.length}/${rows.length} spotcheck rows missing or mutated.`,
    details: { checked: rows.length, misses },
  };
}

export async function event_type_distribution_preserved(ctx: AssertionContext): Promise<AssertionResult> {
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
