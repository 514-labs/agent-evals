import { readFileSync } from "node:fs";

import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

const EXPECTED_DIR = "/scenario/expected";

const CANONICAL_QUERY = `
SELECT
  toDate(event_ts) AS day,
  count() AS event_count,
  uniqExact(user_id) AS unique_users
FROM analytics.events
WHERE region = 'us-east'
  AND event_ts >= toDateTime('2026-02-01 00:00:00')
  AND event_ts <  toDateTime('2026-02-08 00:00:00')
GROUP BY day
ORDER BY day
`;

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
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

export async function canonical_query_result_matches_golden(
  ctx: AssertionContext,
): Promise<AssertionResult> {
  const goldenRaw = readFileSync(`${EXPECTED_DIR}/golden-result.jsonl`, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  const golden = goldenRaw.map((line) => JSON.parse(line) as Record<string, unknown>);

  const actual = await queryRows<Record<string, unknown>>(ctx, CANONICAL_QUERY);

  const normalize = (rows: Record<string, unknown>[]) =>
    rows
      .map(
        (r) =>
          `${String(r.day)}|${String(r.event_count)}|${String(r.unique_users)}`,
      )
      .sort()
      .join(";");

  const expectedKey = normalize(golden);
  const actualKey = normalize(actual);
  const passed = expectedKey === actualKey;

  return {
    passed,
    message: passed
      ? `Canonical query result matches golden (${golden.length} rows).`
      : `Canonical query result diverged from golden — see details.`,
    details: {
      expectedRows: golden.length,
      actualRows: actual.length,
      expectedFirstRows: golden.slice(0, 3),
      actualFirstRows: actual.slice(0, 3),
    },
  };
}
