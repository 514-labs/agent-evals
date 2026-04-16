import type { AssertionContext, AssertionResult } from "@dec-bench/eval-core";

import { findProductEventsTable, resolveColumn } from "../../_shared/assertion-helpers";

async function queryRows<T>(ctx: AssertionContext, sql: string): Promise<T[]> {
  const result = await ctx.clickhouse.query({ query: sql, format: "JSONEachRow" });
  return (await (result as any).json()) as T[];
}

async function fetchJsonAnyPort(paths: string[]): Promise<any | null> {
  for (const port of [3000, 4000, 8080]) {
    for (const p of paths) {
      try {
        const res = await fetch(`http://localhost:${port}${p}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return await res.json();
      } catch {}
    }
  }
  return null;
}

export async function all_thirty_events_ingested(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findProductEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Product events table not found.", details: {} };
  }
  const rows = await queryRows<{ n: number }>(
    ctx,
    `SELECT count() AS n FROM ${found.database}.${found.table}`,
  );
  const count = Number(rows[0]?.n ?? 0);
  const passed = count >= 30;
  return {
    passed,
    message: passed ? `${count} events ingested (>= 30).` : `Expected 30 events, got ${count}.`,
    details: { count, location: `${found.database}.${found.table}` },
  };
}

export async function event_types_preserved(ctx: AssertionContext): Promise<AssertionResult> {
  const found = await findProductEventsTable(ctx);
  if (!found) {
    return { passed: false, message: "Product events table not found.", details: {} };
  }
  const typeCol = await resolveColumn(ctx, found.database, found.table, "event_type", "eventType");
  if (!typeCol) {
    return { passed: false, message: "No event_type column found.", details: {} };
  }
  const rows = await queryRows<{ t: string }>(
    ctx,
    `SELECT DISTINCT lower(\`${typeCol}\`) AS t FROM ${found.database}.${found.table} ORDER BY t`,
  );
  const types = rows.map((r) => r.t);
  const hasAll = ["cart", "purchase", "view"].every((t) => types.some((x) => x.includes(t)));
  return {
    passed: hasAll,
    message: hasAll ? "Event types preserved." : `Missing event types. Got: ${JSON.stringify(types)}.`,
    details: { types },
  };
}

export async function top_products_returns_data(): Promise<AssertionResult> {
  const data = await fetchJsonAnyPort(["/api/top-products", "/api/topProducts"]);
  const passed = Array.isArray(data) && data.length > 0;
  return {
    passed,
    message: passed ? `Top products API returns ${data.length} rows.` : "Top products API returned empty or invalid data.",
    details: { length: Array.isArray(data) ? data.length : 0 },
  };
}

export async function funnel_has_three_steps(): Promise<AssertionResult> {
  const data = await fetchJsonAnyPort(["/api/funnel", "/api/conversion-funnel"]);
  if (!Array.isArray(data) || data.length < 3) {
    return {
      passed: false,
      message: "Funnel API returned insufficient data.",
      details: { length: Array.isArray(data) ? data.length : 0 },
    };
  }
  const steps = data.map((d: any) => (d.step ?? d.event_type ?? "").toLowerCase());
  const passed = ["view", "cart", "purchase"].every((s) => steps.some((step: string) => step.includes(s)));
  return {
    passed,
    message: passed ? "Funnel has view, cart, and purchase steps." : `Missing steps. Got: ${JSON.stringify([...new Set(steps)])}.`,
    details: { steps: [...new Set(steps)] },
  };
}

export async function funnel_counts_are_monotonic(): Promise<AssertionResult> {
  const data = await fetchJsonAnyPort(["/api/funnel", "/api/conversion-funnel"]);
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
    byStep[step] = Number(row.unique_users ?? row.users ?? row.count ?? row.total_events ?? 0);
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
  const data = await fetchJsonAnyPort(["/api/hourly", "/api/hourly-activity"]);
  const passed = Array.isArray(data) && data.length > 0;
  return {
    passed,
    message: passed ? `Hourly API returns ${data.length} rows.` : "Hourly API returned empty or invalid data.",
    details: { length: Array.isArray(data) ? data.length : 0 },
  };
}

export async function revenue_checksum(ctx: AssertionContext): Promise<AssertionResult> {
  const pgResult = await ctx.pg.query(
    "SELECT COALESCE(SUM((properties->>'price')::numeric), 0) AS total FROM raw.product_events WHERE event_type = 'purchase'",
  );
  const pgTotal = Number(pgResult.rows[0]?.total ?? 0);

  const data = await fetchJsonAnyPort(["/api/top-products", "/api/topProducts"]);
  if (!Array.isArray(data)) {
    return {
      passed: false,
      message: "Top products API returned invalid data.",
      details: { pgTotal },
    };
  }

  const apiTotal = data.reduce(
    (sum: number, row: any) => sum + Number(row.revenue ?? row.total_revenue ?? 0),
    0,
  );
  const passed = Math.abs(pgTotal - apiTotal) < 0.01;
  return {
    passed,
    message: passed ? "Revenue checksum matches." : `Revenue mismatch: pg=${pgTotal}, api=${apiTotal}.`,
    details: { pgTotal, apiTotal },
  };
}
