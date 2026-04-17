import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findUserActivityTable } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function table_has_expected_columns(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const rows = await queryRows<{ name: string; type: string }>(
    ctx,
    `SELECT name, type FROM system.columns WHERE database = '${found.database}' AND table = '${found.table}' ORDER BY name`,
  );
  const columnNames = rows.map((r) => r.name.toLowerCase()).sort();
  // Accept both snake_case (event_id) and camelCase (eventid) column names
  const expectedGroups = [
    ["action"],
    ["duration_ms", "durationms"],
    ["event_id", "eventid"],
    ["event_ts", "eventts"],
    ["user_id", "userid"],
  ];
  const passed = expectedGroups.every((group) =>
    group.some((col) => columnNames.includes(col)),
  );
  return {
    passed,
    message: passed
      ? "Table has all expected columns."
      : `Expected columns ${JSON.stringify(expectedGroups.map((g) => g[0]))}, got ${JSON.stringify(columnNames)}.`,
    details: { expectedGroups, actual: columnNames },
  };
}

export async function column_types_are_compatible(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const rows = await queryRows<{ name: string; type: string }>(
    ctx,
    `SELECT lower(name) AS name, type FROM system.columns WHERE database = '${found.database}' AND table = '${found.table}'`,
  );
  const typeMap: Record<string, string> = {};
  for (const row of rows) {
    typeMap[row.name] = row.type;
  }

  const checks: Array<{ column: string; ok: boolean; actual: string }> = [];
  const stringLike = (t: string) => /string/i.test(t);
  const dateLike = (t: string) => /datetime/i.test(t);
  const numericLike = (t: string) => /float|decimal|int|uint/i.test(t);

  const col = (name: string) => typeMap[name] ?? typeMap[name.replace(/_/g, "")] ?? "missing";
  checks.push({ column: "event_id", ok: stringLike(col("event_id")), actual: col("event_id") });
  checks.push({ column: "event_ts", ok: dateLike(col("event_ts")), actual: col("event_ts") });
  checks.push({ column: "user_id", ok: stringLike(col("user_id")), actual: col("user_id") });
  checks.push({ column: "action", ok: stringLike(col("action")), actual: col("action") });
  checks.push({ column: "duration_ms", ok: numericLike(col("duration_ms")), actual: col("duration_ms") });

  const failures = checks.filter((c) => !c.ok);
  const passed = failures.length === 0;
  return {
    passed,
    message: passed
      ? "All column types are compatible."
      : `Incompatible types: ${failures.map((f) => `${f.column}=${f.actual}`).join(", ")}.`,
    details: { checks },
  };
}

export async function sample_data_loaded(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findUserActivityTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 10;
  return {
    passed,
    message: passed ? `Sample data loaded (${count} rows).` : `Expected at least 10 rows, got ${count}.`,
    details: { count },
  };
}
