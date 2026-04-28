import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const EXPECTED_DIR = "/scenario/expected";

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

// Always run integrity / golden-result probes with the query result cache
// disabled. Otherwise an agent who turned the cache on at the profile level
// could mask source-data corruption: the first cached fingerprint would keep
// returning even if the underlying table changed afterwards.
const NO_CACHE_SETTINGS = {
  use_query_cache: 0,
  enable_reads_from_query_cache: 0,
  enable_writes_to_query_cache: 0,
} as const;

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({
    query: sql,
    format: "JSONEachRow",
    clickhouse_settings: NO_CACHE_SETTINGS,
  });
  return (await (result as any).json()) as T[];
}

function readExpected(name: string): string {
  return readFileSync(`${EXPECTED_DIR}/${name}`, "utf8").trim();
}

async function scalarString(ctx: AssertionContext, sql: string): Promise<string> {
  const rows = await queryRows<Record<string, string>>(ctx, sql);
  const first = rows[0] ?? {};
  const values = Object.values(first);
  return String(values[0] ?? "");
}

export async function source_row_count_unchanged(ctx: AssertionContext): Promise<AssertionResult> {
  const expected = readExpected("source-row-count.txt");
  const actual = await scalarString(
    ctx,
    "SELECT toString(count()) AS v FROM analytics.events",
  );
  const passed = expected === actual;
  return {
    passed,
    message: passed
      ? `Source row count preserved (${actual}).`
      : `Source row count changed: expected ${expected}, got ${actual}.`,
    details: { expected, actual },
  };
}

export async function source_uniq_event_id_unchanged(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const expected = readExpected("source-uniq-event-id.txt");
  const actual = await scalarString(
    ctx,
    "SELECT toString(uniqExact(event_id)) AS v FROM analytics.events",
  );
  const passed = expected === actual;
  return {
    passed,
    message: passed
      ? `Distinct event_id count preserved (${actual}).`
      : `Distinct event_id count changed: expected ${expected}, got ${actual}.`,
    details: { expected, actual },
  };
}

export async function source_value_sum_unchanged(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const expected = readExpected("source-value-sum.txt");
  const actual = await scalarString(
    ctx,
    "SELECT toString(sum(value)) AS v FROM analytics.events",
  );
  const expectedNum = Number(expected);
  const actualNum = Number(actual);
  const tolerance = Math.max(1e-6, Math.abs(expectedNum) * 1e-9);
  const passed = Number.isFinite(actualNum) && Math.abs(actualNum - expectedNum) <= tolerance;
  return {
    passed,
    message: passed
      ? `sum(value) preserved (${actual}).`
      : `sum(value) changed: expected ${expected}, got ${actual}.`,
    details: { expected, actual, tolerance },
  };
}

export async function source_userid_len_sum_unchanged(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const expected = readExpected("source-userid-len-sum.txt");
  const actual = await scalarString(
    ctx,
    "SELECT toString(sum(length(user_id))) AS v FROM analytics.events",
  );
  const passed = expected === actual;
  return {
    passed,
    message: passed
      ? `sum(length(user_id)) preserved (${actual}).`
      : `sum(length(user_id)) changed: expected ${expected}, got ${actual}.`,
    details: { expected, actual },
  };
}

export async function source_tags_len_sum_unchanged(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const expected = readExpected("source-tags-len-sum.txt");
  const actual = await scalarString(
    ctx,
    "SELECT toString(sum(length(tags))) AS v FROM analytics.events",
  );
  const passed = expected === actual;
  return {
    passed,
    message: passed
      ? `sum(length(tags)) preserved (${actual}).`
      : `sum(length(tags)) changed: expected ${expected}, got ${actual}.`,
    details: { expected, actual },
  };
}

export async function source_priority_sum_unchanged(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const expected = readExpected("source-priority-sum.txt");
  const actual = await scalarString(
    ctx,
    "SELECT toString(sum(priority)) AS v FROM analytics.events",
  );
  const passed = expected === actual;
  return {
    passed,
    message: passed
      ? `sum(priority) preserved (${actual}).`
      : `sum(priority) changed: expected ${expected}, got ${actual}.`,
    details: { expected, actual },
  };
}

export async function canonical_query_result_matches_golden(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const goldenRaw = readFileSync(`${EXPECTED_DIR}/golden-result.jsonl`, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  const golden = goldenRaw.map((line) => JSON.parse(line) as Record<string, unknown>);

  const actual = await queryRows<Record<string, unknown>>(ctx, CANONICAL_QUERY);

  // Tolerances: integer-typed columns must match exactly. Floating-point
  // aggregates (avg, p50, p90) must match within a relative tolerance —
  // quantileTDigest is approximate (~1% nominal error) and parallel merge
  // order can perturb results between runs even on identical input. 3%
  // relative is the canonical "close enough for product analytics" bar.
  const FLOAT_TOLERANCE_REL = 3e-2;
  const FLOAT_TOLERANCE_ABS = 1e-6;
  const floatColumns = new Set(["avg_value", "p50", "p90"]);

  const closeEnough = (a: unknown, b: unknown) => {
    const an = Number(a);
    const bn = Number(b);
    if (!Number.isFinite(an) || !Number.isFinite(bn)) return false;
    const diff = Math.abs(an - bn);
    return (
      diff <= FLOAT_TOLERANCE_ABS ||
      diff <= Math.max(Math.abs(an), Math.abs(bn)) * FLOAT_TOLERANCE_REL
    );
  };

  const keyOf = (r: Record<string, unknown>) =>
    `${String(r.month)}|${String(r.region)}|${String(r.tag)}|${String(r.priority)}`;

  const expectedByKey = new Map(golden.map((r) => [keyOf(r), r]));
  const actualByKey = new Map(actual.map((r) => [keyOf(r), r]));

  const mismatches: Array<{ key: string; reason: string; expected: unknown; actual: unknown }> = [];

  for (const [k, exp] of expectedByKey) {
    const act = actualByKey.get(k);
    if (!act) {
      mismatches.push({ key: k, reason: "missing in actual", expected: exp, actual: null });
      continue;
    }
    for (const col of ["n", "unique_users"]) {
      if (String(exp[col]) !== String(act[col])) {
        mismatches.push({
          key: k,
          reason: `column ${col} changed`,
          expected: exp[col],
          actual: act[col],
        });
      }
    }
    for (const col of floatColumns) {
      if (!closeEnough(exp[col], act[col])) {
        mismatches.push({
          key: k,
          reason: `column ${col} outside tolerance`,
          expected: exp[col],
          actual: act[col],
        });
      }
    }
  }
  for (const k of actualByKey.keys()) {
    if (!expectedByKey.has(k)) {
      mismatches.push({
        key: k,
        reason: "extra row in actual",
        expected: null,
        actual: actualByKey.get(k),
      });
    }
  }

  const passed = mismatches.length === 0;
  return {
    passed,
    message: passed
      ? `Canonical cube query result matches golden (${golden.length} rows).`
      : `Canonical cube query result diverged from golden in ${mismatches.length} place(s).`,
    details: {
      expectedRows: golden.length,
      actualRows: actual.length,
      expectedFirstRows: golden.slice(0, 3),
      actualFirstRows: actual.slice(0, 3),
      firstMismatches: mismatches.slice(0, 5),
    },
  };
}
