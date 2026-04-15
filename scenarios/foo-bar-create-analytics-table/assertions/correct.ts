import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function findTable(ctx: AssertionContext): Promise<{ database: string; table: string } | null> {
  const rows = await queryRows<{ database: string; name: string }>(
    ctx,
    "SELECT database, name FROM system.tables WHERE name = 'user_activity' AND database NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')",
  );
  return rows.length > 0 ? { database: rows[0].database, table: rows[0].name } : null;
}

export async function table_has_expected_columns(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const rows = await queryRows<{ name: string; type: string }>(
    ctx,
    `SELECT name, type FROM system.columns WHERE database = '${found.database}' AND table = '${found.table}' ORDER BY name`,
  );
  const columnNames = rows.map((r) => r.name).sort();
  const expected = ["action", "duration_ms", "event_id", "event_ts", "user_id"];
  const passed = JSON.stringify(columnNames) === JSON.stringify(expected);
  return {
    passed,
    message: passed
      ? "Table has all expected columns."
      : `Expected columns ${JSON.stringify(expected)}, got ${JSON.stringify(columnNames)}.`,
    details: { expected, actual: columnNames },
  };
}

export async function column_types_are_compatible(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findTable(ctx);
  if (!found) {
    return { passed: false, message: "Table user_activity not found.", details: {} };
  }
  const rows = await queryRows<{ name: string; type: string }>(
    ctx,
    `SELECT name, type FROM system.columns WHERE database = '${found.database}' AND table = '${found.table}'`,
  );
  const typeMap: Record<string, string> = {};
  for (const row of rows) {
    typeMap[row.name] = row.type;
  }

  const checks: Array<{ column: string; ok: boolean; actual: string }> = [];
  const stringLike = (t: string) => /string/i.test(t);
  const dateLike = (t: string) => /datetime/i.test(t);
  const numericLike = (t: string) => /float|decimal|int|uint/i.test(t);

  checks.push({ column: "event_id", ok: stringLike(typeMap["event_id"] ?? ""), actual: typeMap["event_id"] ?? "missing" });
  checks.push({ column: "event_ts", ok: dateLike(typeMap["event_ts"] ?? ""), actual: typeMap["event_ts"] ?? "missing" });
  checks.push({ column: "user_id", ok: stringLike(typeMap["user_id"] ?? ""), actual: typeMap["user_id"] ?? "missing" });
  checks.push({ column: "action", ok: stringLike(typeMap["action"] ?? ""), actual: typeMap["action"] ?? "missing" });
  checks.push({ column: "duration_ms", ok: numericLike(typeMap["duration_ms"] ?? ""), actual: typeMap["duration_ms"] ?? "missing" });

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
  const found = await findTable(ctx);
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
