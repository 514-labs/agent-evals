import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

export async function orders_schema_has_required_columns(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = (await (await ctx.clickhouse.query({
    query: "SELECT name FROM system.columns WHERE database = 'analytics' AND table = 'orders'",
    format: "JSONEachRow",
  }) as any).json()) as Array<{ name: string }>;
  const names = rows.map((r) => r.name.toLowerCase());
  const hasOrderId = names.some((n) => n.includes("order") && n.includes("id"));
  const hasAmount = names.some((n) => n.includes("amount"));
  const passed = names.length >= 3 && (hasOrderId || names.includes("order_id")) && hasAmount;
  return {
    passed,
    message: passed ? "Orders schema has required columns." : `Schema incomplete. Got: ${JSON.stringify(names)}.`,
    details: { names },
  };
}
