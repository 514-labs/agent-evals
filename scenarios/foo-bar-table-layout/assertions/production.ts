import type { AssertionContext } from "@dec-bench/eval-core";

export async function connection_env_vars_available(ctx: AssertionContext): Promise<boolean> {
  return Boolean(ctx.env("CLICKHOUSE_URL"));
}

export async function storage_reduced(ctx: AssertionContext): Promise<boolean> {
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
  return Number(rows[0]?.bytes ?? Infinity) < Number(srcRows[0]?.bytes ?? 0);
}
