import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function findTableByPattern(
  ctx: AssertionContext,
  pattern: string,
): Promise<{ database: string; table: string } | null> {
  const rows = await queryRows<{ database: string; name: string }>(
    ctx,
    `SELECT database, name FROM system.tables
     WHERE lower(name) LIKE '${pattern}'
       AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
     ORDER BY length(name) ASC`,
  );
  return rows.length > 0 ? { database: rows[0].database, table: rows[0].name } : null;
}

export async function daily_summary_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTableByPattern(ctx, "%daily%summar%");
  if (!found) {
    return { passed: false, message: "Daily summary table/view not found (expected name containing 'daily' and 'summar').", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? `Daily summary has ${count} rows at ${found.database}.${found.table}.` : "Daily summary is empty.",
    details: { count, location: `${found.database}.${found.table}` },
  };
}

export async function daily_summary_has_expected_columns(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTableByPattern(ctx, "%daily%summar%");
  if (!found) {
    return { passed: false, message: "Daily summary table not found.", details: {} };
  }
  const rows = await queryRows<{ name: string }>(
    ctx,
    `SELECT lower(name) AS name FROM system.columns WHERE database = '${found.database}' AND table = '${found.table}'`,
  );
  const cols = rows.map((r) => r.name);
  // Expect some form of: day/date column, user_id, event_count, total_duration
  const hasDay = cols.some((c) => c.includes("day") || c.includes("date"));
  const hasUser = cols.some((c) => c.includes("user"));
  const hasCount = cols.some((c) => c.includes("count") || c.includes("cnt") || c.includes("events"));
  const hasDuration = cols.some((c) => c.includes("duration") || c.includes("total") || c.includes("sum"));
  const passed = hasDay && hasUser && (hasCount || hasDuration);
  return {
    passed,
    message: passed
      ? "Daily summary has expected columns."
      : `Missing columns. Got: ${JSON.stringify(cols)}. Need day+user+(count or duration).`,
    details: { cols, hasDay, hasUser, hasCount, hasDuration },
  };
}

export async function top_users_has_rows(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTableByPattern(ctx, "%top%user%");
  if (!found) {
    return { passed: false, message: "Top users table/view not found (expected name containing 'top' and 'user').", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count > 0;
  return {
    passed,
    message: passed ? `Top users has ${count} rows at ${found.database}.${found.table}.` : "Top users is empty.",
    details: { count, location: `${found.database}.${found.table}` },
  };
}

export async function top_users_has_duration_column(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTableByPattern(ctx, "%top%user%");
  if (!found) {
    return { passed: false, message: "Top users table not found.", details: {} };
  }
  const rows = await queryRows<{ name: string }>(
    ctx,
    `SELECT lower(name) AS name FROM system.columns WHERE database = '${found.database}' AND table = '${found.table}'`,
  );
  const cols = rows.map((r) => r.name);
  const hasDuration = cols.some((c) => c.includes("duration") || c.includes("total") || c.includes("sum"));
  const hasUser = cols.some((c) => c.includes("user"));
  const passed = hasDuration && hasUser;
  return {
    passed,
    message: passed
      ? "Top users has user and duration columns."
      : `Missing columns. Got: ${JSON.stringify(cols)}.`,
    details: { cols, hasDuration, hasUser },
  };
}
