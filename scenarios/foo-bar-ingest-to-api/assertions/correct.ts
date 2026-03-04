import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function all_thirty_events_ingested(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ n: number }>(
    ctx,
    "SELECT count() AS n FROM analytics.product_events",
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count === 30;
  return {
    passed,
    message: passed ? "All 30 events ingested." : `Expected 30 events, got ${count}.`,
    details: { count },
  };
}

export async function event_types_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const rows = await queryRows<{ t: string }>(
    ctx,
    "SELECT DISTINCT event_type AS t FROM analytics.product_events ORDER BY t",
  );
  const types = rows.map((r) => r.t).sort();
  const expected = ["cart", "purchase", "view"];
  const passed = JSON.stringify(types) === JSON.stringify(expected);
  return {
    passed,
    message: passed ? "Event types preserved." : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(types)}.`,
    details: { types },
  };
}

export async function top_products_returns_data(): Promise<AssertionResult> {
  const data = await fetchJson("http://localhost:3000/api/top-products");
  const passed = Array.isArray(data) && data.length > 0;
  return {
    passed,
    message: passed ? "Top products API returns data." : "Top products API returned empty or invalid data.",
    details: { length: Array.isArray(data) ? data.length : 0 },
  };
}

export async function funnel_has_three_steps(): Promise<AssertionResult> {
  const data = await fetchJson("http://localhost:3000/api/funnel");
  if (!Array.isArray(data) || data.length < 3) {
    return {
      passed: false,
      message: "Funnel API returned insufficient data.",
      details: { length: Array.isArray(data) ? data.length : 0 },
    };
  }
  const steps = data.map((d: any) => (d.step ?? d.event_type ?? "").toLowerCase());
  const passed = steps.includes("view") && steps.includes("cart") && steps.includes("purchase");
  return {
    passed,
    message: passed ? "Funnel has view, cart, and purchase steps." : `Missing steps. Got: ${JSON.stringify([...new Set(steps)])}.`,
    details: { steps: [...new Set(steps)] },
  };
}

export async function funnel_counts_are_monotonic(): Promise<AssertionResult> {
  const data = await fetchJson("http://localhost:3000/api/funnel");
  if (!Array.isArray(data) || data.length < 3) {
    return {
      passed: false,
      message: "Funnel API returned insufficient data.",
      details: { length: Array.isArray(data) ? data.length : 0 },
    };
  }

  const byStep: Record<string, number> = {};
  for (const row of data) {
    const step = (row.step ?? row.event_type ?? "").toLowerCase();
    byStep[step] = Number(row.unique_users ?? row.users ?? row.count ?? 0);
  }

  const views = byStep["view"] ?? 0;
  const carts = byStep["cart"] ?? 0;
  const purchases = byStep["purchase"] ?? 0;
  const passed = views >= carts && carts >= purchases && purchases > 0;
  return {
    passed,
    message: passed ? "Funnel counts are monotonic." : `Monotonic check failed: views=${views}, carts=${carts}, purchases=${purchases}.`,
    details: { views, carts, purchases },
  };
}

export async function hourly_returns_data(): Promise<AssertionResult> {
  const data = await fetchJson("http://localhost:3000/api/hourly");
  const passed = Array.isArray(data) && data.length > 0;
  return {
    passed,
    message: passed ? "Hourly API returns data." : "Hourly API returned empty or invalid data.",
    details: { length: Array.isArray(data) ? data.length : 0 },
  };
}

export async function revenue_checksum(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query(
    "SELECT COALESCE(SUM((properties->>'price')::numeric), 0) AS total FROM raw.product_events WHERE event_type = 'purchase'",
  );
  const pgTotal = Number(pgResult.rows[0]?.total ?? 0);

  const data = await fetchJson("http://localhost:3000/api/top-products");
  if (!Array.isArray(data)) {
    return {
      passed: false,
      message: "Top products API returned invalid data.",
      details: { pgTotal },
    };
  }

  const apiTotal = data.reduce(
    (sum: number, row: any) => sum + Number(row.revenue ?? 0),
    0,
  );
  const passed = Math.abs(pgTotal - apiTotal) < 0.01;
  return {
    passed,
    message: passed ? "Revenue checksum matches." : `Revenue mismatch: pg=${pgTotal}, api=${apiTotal}.`,
    details: { pgTotal, apiTotal },
  };
}
