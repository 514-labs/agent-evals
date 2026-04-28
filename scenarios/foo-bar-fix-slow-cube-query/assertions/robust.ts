import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const CANONICAL_QUERY = `
SELECT
  formatDateTime(toStartOfMonth(event_ts), '%Y-%m-01') AS month,
  region,
  arrayJoin(tags) AS tag,
  priority,
  count() AS n,
  avg(value) AS avg_value,
  quantileTDigest(0.5)(value) AS p50,
  quantileTDigest(0.9)(value) AS p90,
  uniqExact(user_id) AS unique_users,
  COUNT() OVER () AS total
FROM analytics.events
WHERE event_ts >= toDateTime('2026-01-01 00:00:00')
  AND event_ts <  toDateTime('2026-07-01 00:00:00')
  AND value IS NOT NULL
  AND event_type != 'deleted'
GROUP BY month, region, tag, priority
ORDER BY month, region, tag, priority
LIMIT 50
`;

const FLOAT_TOLERANCE_REL = 3e-2;
const FLOAT_TOLERANCE_ABS = 1e-6;
const FLOAT_COLUMNS = ["avg_value", "p50", "p90"];

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

function closeEnough(a: unknown, b: unknown): boolean {
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isFinite(an) || !Number.isFinite(bn)) return false;
  const diff = Math.abs(an - bn);
  return (
    diff <= FLOAT_TOLERANCE_ABS ||
    diff <= Math.max(Math.abs(an), Math.abs(bn)) * FLOAT_TOLERANCE_REL
  );
}

function keyOf(r: Record<string, unknown>): string {
  return `${String(r.month)}|${String(r.region)}|${String(r.tag)}|${String(r.priority)}`;
}

function compareRuns(
  runA: Record<string, unknown>[],
  runB: Record<string, unknown>[],
): { equal: boolean; mismatch?: string } {
  if (runA.length !== runB.length) {
    return { equal: false, mismatch: `row count differs: ${runA.length} vs ${runB.length}` };
  }
  const byKey = new Map(runB.map((r) => [keyOf(r), r]));
  for (const a of runA) {
    const b = byKey.get(keyOf(a));
    if (!b) return { equal: false, mismatch: `key ${keyOf(a)} missing in second run` };
    for (const col of ["n", "unique_users"]) {
      if (String(a[col]) !== String(b[col])) {
        return { equal: false, mismatch: `${keyOf(a)}.${col}: ${a[col]} vs ${b[col]}` };
      }
    }
    for (const col of FLOAT_COLUMNS) {
      if (!closeEnough(a[col], b[col])) {
        return { equal: false, mismatch: `${keyOf(a)}.${col}: ${a[col]} vs ${b[col]}` };
      }
    }
  }
  return { equal: true };
}

export async function canonical_query_stable_across_3_runs(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const runs: Record<string, unknown>[][] = [];
  for (let i = 0; i < 3; i++) {
    runs.push(await queryRows<Record<string, unknown>>(ctx, CANONICAL_QUERY));
  }

  const ab = compareRuns(runs[0], runs[1]);
  const bc = compareRuns(runs[1], runs[2]);
  const passed = ab.equal && bc.equal;

  return {
    passed,
    message: passed
      ? "Canonical cube query returned the same result across 3 runs (integer columns exact, t-digest within 3%)."
      : `Canonical cube query result varies between runs — non-deterministic fix. ${ab.mismatch ?? bc.mismatch ?? ""}`,
    details: {
      runs: runs.length,
      sampleRows: runs.map((r) => r.slice(0, 1)),
    },
  };
}
