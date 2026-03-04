import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

export async function dlq_schema_has_error_column(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ name: string }>(
    ctx,
    "SELECT name FROM system.columns WHERE database = 'analytics' AND table = 'dlq_events'",
  );
  const names = rows.map((r) => r.name.toLowerCase());
  const hasError = names.some((n) => n.includes("error"));
  return {
    passed: hasError,
    message: hasError ? "DLQ schema has error column." : "DLQ schema missing error column.",
    details: { names },
  };
}
