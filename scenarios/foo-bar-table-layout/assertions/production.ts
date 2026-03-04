import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<AssertionResult> {
  const hasClickHouse = Boolean(ctx.env("CLICKHOUSE_URL"));
  const passed = hasClickHouse;
  return {
    passed,
    message: passed ? "Connection env vars available." : "Missing CLICKHOUSE_URL.",
    details: { hasClickHouse },
  };
}

export async function storage_reduced(ctx: AssertionContext): Promise<AssertionResult> {
  const result = await ctx.clickhouse.query({
    query: "SELECT sum(bytes_on_disk) AS bytes FROM system.parts WHERE database = 'analytics' AND table = 'metrics_optimized' AND active",
    format: "JSONEachRow",
  });
  const rows = (await (result as any).json()) as Array<{ bytes: number }>;
  const srcResult = await ctx.clickhouse.query({
    query: "SELECT sum(bytes_on_disk) AS bytes FROM system.parts WHERE database = 'raw' AND table = 'metrics' AND active",
    format: "JSONEachRow",
  });
  const srcRows = (await (srcResult as any).json()) as Array<{ bytes: number }>;
  const optimizedBytes = Number(rows[0]?.bytes ?? Infinity);
  const rawBytes = Number(srcRows[0]?.bytes ?? 0);
  const passed = optimizedBytes < rawBytes;
  return {
    passed,
    message: passed ? "Storage reduced." : `Optimized ${optimizedBytes} >= raw ${rawBytes}.`,
    details: { optimizedBytes, rawBytes },
  };
}
