import type { AssertionContext } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function all_thirty_events_ingested(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.product_events",
  );
  return Number(rows[0]?.n ?? 0) === 30;
}

export async function event_types_preserved(ctx: AssertionContext): Promise<boolean> {
  const rows = await queryRows<{ t: string }>(
    ctx,
    "SELECT DISTINCT event_type AS t FROM analytics.product_events ORDER BY t",
  );
  const types = rows.map((r) => r.t).sort();
  return JSON.stringify(types) === JSON.stringify(["cart", "purchase", "view"]);
}

export async function top_products_returns_data(): Promise<boolean> {
  const data = await fetchJson("http://localhost:3000/api/top-products");
  return Array.isArray(data) && data.length > 0;
}

export async function funnel_has_three_steps(): Promise<boolean> {
  const data = await fetchJson("http://localhost:3000/api/funnel");
  if (!Array.isArray(data) || data.length < 3) return false;
  const steps = data.map((d: any) => (d.step ?? d.event_type ?? "").toLowerCase());
  return steps.includes("view") && steps.includes("cart") && steps.includes("purchase");
}

export async function funnel_counts_are_monotonic(): Promise<boolean> {
  const data = await fetchJson("http://localhost:3000/api/funnel");
  if (!Array.isArray(data) || data.length < 3) return false;

  const byStep: Record<string, number> = {};
  for (const row of data) {
    const step = (row.step ?? row.event_type ?? "").toLowerCase();
    byStep[step] = Number(row.unique_users ?? row.users ?? row.count ?? 0);
  }

  const views = byStep["view"] ?? 0;
  const carts = byStep["cart"] ?? 0;
  const purchases = byStep["purchase"] ?? 0;
  return views >= carts && carts >= purchases && purchases > 0;
}

export async function hourly_returns_data(): Promise<boolean> {
  const data = await fetchJson("http://localhost:3000/api/hourly");
  return Array.isArray(data) && data.length > 0;
}

export async function revenue_checksum(ctx: AssertionContext): Promise<boolean> {
  const pgResult = await ctx.pg.query(
    "SELECT COALESCE(SUM((properties->>'price')::numeric), 0) AS total FROM raw.product_events WHERE event_type = 'purchase'",
  );
  const pgTotal = Number(pgResult.rows[0]?.total ?? 0);

  const data = await fetchJson("http://localhost:3000/api/top-products");
  if (!Array.isArray(data)) return false;

  const apiTotal = data.reduce(
    (sum: number, row: any) => sum + Number(row.revenue ?? 0),
    0,
  );

  return Math.abs(pgTotal - apiTotal) < 0.01;
}
